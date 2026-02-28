import express from 'express';
import { getIntent, type IntentResult, type ChainType } from './intent';
// ── Algorand modules ──
import { sendAlgo } from './send';
import { getBalance } from './balance';
import { getAddress } from './address';
import { onboardUser } from './onboard';
import { fundUser } from './fund';
import { getTransactions } from './transactions';
// ── Solana modules ──
import { sendSol } from './send-solana';
import { getBalanceSolana } from './balance-solana';
import { getAddressSolana } from './address-solana';
import { onboardUserSolana } from './onboard-solana';
import { fundUserSolana } from './fund-solana';
import { getTransactionsSolana } from './transactions-solana';

// ─── httpSMS CloudEvents Payload Types ───────────────────────────────────────

export interface HttpSmsEventData {
  contact: string;       // sender phone (incoming) or recipient (outgoing)
  content: string;       // SMS body text
  message_id?: string;
  id?: string;           // present on outgoing events
  owner: string;         // your httpSMS phone number
  request_id?: string;
  sim?: string;          // SIM1 or SIM2
  timestamp: string;
  user_id: string;
}

export interface HttpSmsEvent {
  data: HttpSmsEventData;
  datacontenttype: string;
  id: string;
  source: string;
  specversion: string;
  time: string;
  type:
  | 'message.phone.received'
  | 'message.phone.sent'
  | 'message.phone.delivered'
  | 'message.send.failed'
  | 'message.send.expired'
  | 'message.call.missed'
  | string;
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// ─── httpSMS Send API ────────────────────────────────────────────────────────

const HTTPSMS_API_URL = 'https://api.httpsms.com/v1/messages/send';

/**
 * Send an SMS reply through the httpSMS API.
 * Requires HTTPSMS_API_KEY and HTTPSMS_OWNER_PHONE env vars.
 */
async function sendSmsViaHttpSms(to: string, content: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const ownerPhone = process.env.HTTPSMS_OWNER_PHONE;

  if (!apiKey || !ownerPhone) {
    console.warn('httpSMS API key or owner phone not configured — skipping SMS reply');
    return { success: false, error: 'HTTPSMS_API_KEY or HTTPSMS_OWNER_PHONE not set' };
  }

  try {
    const res = await fetch(HTTPSMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        content,
        from: ownerPhone,
        to,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`httpSMS send failed (${res.status}):`, body);
      return { success: false, error: `httpSMS API ${res.status}: ${body}` };
    }

    const json = await res.json();
    console.log('httpSMS reply sent successfully:', json);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('httpSMS send error:', msg);
    return { success: false, error: msg };
  }
}

// ─── Pending Sessions (two-step password flow) ─────────────────────────────

interface PendingSession {
  action: 'send' | 'onboard' | 'get_pvt_key';
  /** Send params (only for 'send') */
  sendParams?: { amount: string; asset?: string; to: string };
  /** Which blockchain this session targets */
  chain: ChainType;
  createdAt: number;
}

/** phone → pending session awaiting password */
const pendingSessions = new Map<string, PendingSession>();

/** Sessions expire after 5 minutes */
const SESSION_TTL_MS = 5 * 60 * 1000;

function normalizeSessionPhone(phone: string): string {
  return phone.replace(/\D/g, '').trim() || phone;
}

// ─── Webhook Processing ─────────────────────────────────────────────────────

interface SmsProcessResult {
  reply: string;
  containedPassword: boolean;
}

/**
 * Process an incoming SMS from httpSMS webhook, classify intent via Gemini,
 * execute the action, and return a human-readable reply.
 *
 * Two-step flow for send & onboard:
 *   Step 1 — user sends command (no password) → system asks for password
 *   Step 2 — user replies with just the password → system executes + warns to delete
 */
async function processIncomingSms(from: string, rawMessage: string): Promise<SmsProcessResult> {
  // Strip non-printable / non-ASCII garbage bytes (SIM800L buffer padding, etc.)
  const message = rawMessage.replace(/[^\x20-\x7E]/g, '').trim();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: '!!! Server error: AI classifier not configured', containedPassword: false };
  }

  const normPhone = normalizeSessionPhone(from);

  // ── Check if there's a pending session waiting for a password ──────────
  const pending = pendingSessions.get(normPhone);
  if (pending) {
    pendingSessions.delete(normPhone);

    // Check session expiry
    if (Date.now() - pending.createdAt > SESSION_TTL_MS) {
      return { reply: '!!! Session expired. Please start your command again.', containedPassword: false };
    }

    const password = message.trim();
    if (!password) {
      return { reply: '!!! Empty password received. Please start your command again.', containedPassword: false };
    }

    // Execute the pending action with the password
    if (pending.action === 'onboard') {
      return await executeOnboard(from, password, pending.chain);
    }
    if (pending.action === 'send' && pending.sendParams) {
      return await executeSend(from, password, pending.sendParams, pending.chain);
    }
    if (pending.action === 'get_pvt_key') {
      return await executeGetPvtKey(from, password, pending.chain);
    }

    return { reply: '!!! Something went wrong with the pending session. Please try again.', containedPassword: false };
  }

  // ── Normal intent classification ───────────────────────────────────────
  try {
    const intentResult: IntentResult = await getIntent(message, apiKey);
    const chain: ChainType = intentResult.params.chain ?? 'algorand';
    const isSolana = chain === 'solana';
    const assetLabel = isSolana ? 'SOL' : 'ALGO';
    console.log('Intent classified:', intentResult.intent, intentResult.params, '| chain:', chain);

    switch (intentResult.intent) {
      case 'get_balance': {
        const result = isSolana
          ? await getBalanceSolana(from, { asset: intentResult.params.asset })
          : await getBalance(from, { asset: intentResult.params.asset });
        if (result.success) {
          return { reply: `$$ Balance: ${result.balance} ${result.asset ?? assetLabel}`, containedPassword: false };
        }
        return { reply: `!!! Balance check failed: ${result.error ?? 'Unknown error'}`, containedPassword: false };
      }

      case 'get_address': {
        const result = isSolana
          ? await getAddressSolana(from)
          : await getAddress(from);
        if (result.success) {
          return { reply: `>> Your ${assetLabel} address:\n${result.address}`, containedPassword: false };
        }
        return { reply: `!!! Address lookup failed: ${result.error ?? 'Unknown error'}`, containedPassword: false };
      }

      case 'get_txn': {
        const txnResult = isSolana
          ? await getTransactionsSolana(from, 5)
          : await getTransactions(from, 5);
        if (txnResult.success && txnResult.transactions?.length) {
          const lines = txnResult.transactions.map((tx, i) => {
            const dir = tx.sender === txnResult.address ? '<Sent' : '>Received';
            const amt = tx.amount ? `${tx.amount} ${assetLabel}` : tx.type;
            const date = tx.roundTime.slice(0, 10);
            return `${i + 1}. ${dir} ${amt} (${date})\n   ${tx.explorerUrl}`;
          });
          return { reply: `# Last ${txnResult.transactions.length} transactions:\n\n${lines.join('\n\n')}`, containedPassword: false };
        }
        if (txnResult.success) {
          return { reply: '# No transactions found for your account.', containedPassword: false };
        }
        return { reply: `!!! Transaction history failed: ${txnResult.error ?? 'Unknown error'}`, containedPassword: false };
      }

      case 'send': {
        const to = intentResult.params.to ?? '';
        const amount = intentResult.params.amount ?? '0';
        if (!to) {
          return { reply: `!!! Recipient is required.\nFormat: send [amount] ${assetLabel} to [address/phone]`, containedPassword: false };
        }

        // If user included password in the message, execute immediately
        if (intentResult.params.password) {
          return await executeSend(from, intentResult.params.password, { amount, asset: intentResult.params.asset, to }, chain);
        }

        // Step 1: Store pending session and ask for password
        pendingSessions.set(normPhone, {
          action: 'send',
          sendParams: { amount, asset: intentResult.params.asset, to },
          chain,
          createdAt: Date.now(),
        });
        return {
          reply: `<< Send ${amount} ${assetLabel} to ${to}\n\n~~ Reply with your password to confirm:`,
          containedPassword: false,
        };
      }

      case 'onboard': {
        // If user included password in the message, execute immediately
        if (intentResult.params.password) {
          return await executeOnboard(from, intentResult.params.password, chain);
        }

        // Step 1: Store pending session and ask for password
        pendingSessions.set(normPhone, {
          action: 'onboard',
          chain,
          createdAt: Date.now(),
        });
        return {
          reply: `Let's create your ${assetLabel} wallet!\n\n~~ Choose a password and reply with it.\n!!! Remember it — it cannot be recovered!`,
          containedPassword: false,
        };
      }

      case 'fund': {
        const fundResult = isSolana
          ? await fundUserSolana(from)
          : await fundUser(from);
        if (fundResult.success) {
          const fundAmt = isSolana ? '0.1 SOL' : '1 ALGO';
          return { reply: `# Funded ${fundAmt} to your wallet!\n# ${fundResult.explorerUrl}`, containedPassword: false };
        }
        return { reply: `!!! Fund failed: ${fundResult.error ?? 'Unknown error'}`, containedPassword: false };
      }

      case 'get_pvt_key': {
        // If user included password in the message, execute immediately
        if (intentResult.params.password) {
          return await executeGetPvtKey(from, intentResult.params.password, chain);
        }

        // Step 1: Ask for password
        pendingSessions.set(normPhone, {
          action: 'get_pvt_key',
          chain,
          createdAt: Date.now(),
        });
        return {
          reply: '*** To export your private key, reply with your password:',
          containedPassword: false,
        };
      }

      default:
        return { reply: '?? Could not understand your request. Try:\n• "balance" — check balance\n• "SOL balance" — check Solana balance\n• "address" / "SOL address" — get wallet address\n• "create wallet" / "create wallet on solana" — create a new wallet\n• "send [amount] ALGO/SOL to [address/phone]" — send crypto\n• "fund me" — get testnet tokens\n• "get pvt key" — export your private key\n• "get txn" — last 5 transactions', containedPassword: false };
    }
  } catch (err) {
    console.error('Intent processing error:', err);
    return { reply: `!!! Processing failed: ${err instanceof Error ? err.message : String(err)}`, containedPassword: false };
  }
}

// ─── Action executors (step 2) ──────────────────────────────────────────────

async function executeOnboard(from: string, password: string, chain: ChainType = 'algorand'): Promise<SmsProcessResult> {
  const isSolana = chain === 'solana';
  const assetLabel = isSolana ? 'SOL' : 'ALGO';
  const onboardResult = isSolana
    ? await onboardUserSolana(from, password)
    : await onboardUser(from, password);
  if (onboardResult.alreadyOnboarded) {
    return { reply: `# You are already onboarded on ${assetLabel}!\nAddress: ${onboardResult.address ?? 'N/A'}`, containedPassword: true };
  }
  if (onboardResult.error) {
    return { reply: `!!! Onboard failed: ${onboardResult.error}`, containedPassword: true };
  }
  return {
    reply: `Welcome! Your ${assetLabel} wallet has been created.\nAddress: ${onboardResult.address ?? 'N/A'}`,
    containedPassword: true,
  };
}

async function executeSend(
  from: string,
  password: string,
  params: { amount: string; asset?: string; to: string },
  chain: ChainType = 'algorand'
): Promise<SmsProcessResult> {
  const isSolana = chain === 'solana';
  const assetLabel = isSolana ? 'SOL' : 'ALGO';
  const sendResult = isSolana
    ? await sendSol(from, password, {
        amount: params.amount,
        asset: params.asset,
        to: params.to,
      })
    : await sendAlgo(from, password, {
        amount: params.amount,
        asset: params.asset,
        to: params.to,
      });
  if (sendResult.success) {
    const explorerLine = 'explorerUrl' in sendResult && sendResult.explorerUrl
      ? `\n# ${sendResult.explorerUrl}`
      : '';
    return {
      reply: `<< Sent ${params.amount} ${assetLabel} to ${params.to}${explorerLine}`,
      containedPassword: true,
    };
  }
  return { reply: `!!! Send failed: ${sendResult.error ?? 'Unknown error'}`, containedPassword: true };
}

async function executeGetPvtKey(from: string, password: string, chain: ChainType = 'algorand'): Promise<SmsProcessResult> {
  const isSolana = chain === 'solana';
  const { decryptMnemonic } = await import('./crypto/mnemonic');

  let user;
  if (isSolana) {
    const { findOnboardedUserSolana } = await import('./onchain-solana');
    user = await findOnboardedUserSolana(from);
  } else {
    const { findOnboardedUser } = await import('./onchain');
    user = await findOnboardedUser(from);
  }

  if (!user?.encrypted_mnemonic || !user?.address) {
    return { reply: '!!! Account not found or not onboarded.', containedPassword: true };
  }

  try {
    const secret = decryptMnemonic(user.encrypted_mnemonic, password);
    const label = isSolana ? 'Your Solana secret key (base58)' : 'Your 25-word recovery phrase';
    return {
      reply: `# ${label}:\n\n${secret}\n\n!!!! NEVER share this with anyone! Delete this message immediately after saving it securely.`,
      containedPassword: true,
    };
  } catch {
    return { reply: '!!! Wrong password. Could not decrypt your private key.', containedPassword: true };
  }
}

// ─── JWT Validation (optional) ──────────────────────────────────────────────

/**
 * Validate the httpSMS webhook JWT signature.
 * If HTTPSMS_WEBHOOK_SIGNING_KEY is not set, validation is skipped.
 */
function validateWebhookSignature(authHeader: string | undefined): boolean {
  const signingKey = process.env.HTTPSMS_WEBHOOK_SIGNING_KEY;

  // If no signing key configured, skip validation (dev mode)
  if (!signingKey) {
    return true;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Webhook missing Authorization Bearer token');
    return false;
  }

  try {
    const token = authHeader.slice(7);
    // Decode JWT parts (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format');
      return false;
    }

    // Verify HMAC-SHA256 signature
    const crypto = require('crypto');
    const signatureInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = crypto
      .createHmac('sha256', signingKey)
      .update(signatureInput)
      .digest('base64url');

    if (expectedSig !== parts[2]) {
      console.warn('JWT signature mismatch');
      return false;
    }

    // Check token expiry
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.warn('JWT token expired');
      return false;
    }

    return true;
  } catch (err) {
    console.error('JWT validation error:', err);
    return false;
  }
}

// ─── Route Setup ────────────────────────────────────────────────────────────

/**
 * Mount httpSMS webhook routes on the Express app.
 */
export function setupWebhookRoutes(app: express.Express): void {

  // ── Dedup: track recently processed event IDs ───────────────────────────
  const processedEvents = new Set<string>();
  const DEDUP_TTL_MS = 5 * 60 * 1000; // keep IDs for 5 minutes

  // ── httpSMS Webhook Endpoint ──────────────────────────────────────────────
  app.post('/api/sms-webhook', express.json({ type: '*/*' }), async (req, res) => {
    try {
      const event = req.body as HttpSmsEvent;

      // Validate basic CloudEvents structure
      if (!event.type || !event.data) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload: missing "type" or "data" field',
        });
      }

      // Validate webhook signature (if signing key is configured)
      if (!validateWebhookSignature(req.headers.authorization)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      console.log(`[httpSMS] Event received: ${event.type} | id=${event.id}`);

      // ── Deduplicate: skip if we already processed this event ID ─────────
      if (event.id && processedEvents.has(event.id)) {
        console.log(`[httpSMS] Duplicate event ignored: ${event.id}`);
        return res.status(200).json({
          success: true,
          message: `Duplicate event ${event.id} ignored`,
        });
      }
      if (event.id) {
        processedEvents.add(event.id);
        setTimeout(() => processedEvents.delete(event.id), DEDUP_TTL_MS);
      }

      // ── Only process incoming SMS ───────────────────────────────────────
      if (event.type !== 'message.phone.received') {
        console.log(`[httpSMS] Acknowledged non-received event: ${event.type}`);
        return res.status(200).json({
          success: true,
          message: `Event ${event.type} acknowledged`,
        });
      }

      const senderPhone = event.data.contact;
      const smsContent = event.data.content;
      const ownerPhone = event.data.owner;

      if (!senderPhone || !smsContent) {
        return res.status(400).json({
          success: false,
          error: 'Missing data.contact or data.content in received event',
        });
      }

      console.log(`[httpSMS] Incoming SMS from ${senderPhone} to ${ownerPhone}: "${smsContent}"`);

      // Process intent and generate reply
      const { reply: replyText, containedPassword } = await processIncomingSms(senderPhone, smsContent);
      console.log(`[httpSMS] Reply to ${senderPhone}: "${replyText}"`);

      // Send reply back via httpSMS API
      const sendResult = await sendSmsViaHttpSms(senderPhone, replyText);

      // If the user's SMS contained a password, send a follow-up security warning
      if (containedPassword) {
        const securityWarning = '## SECURITY WARNING: Your previous message contained your password in plain text. Please DELETE it from your message history immediately for your safety.';
        // Small delay so the warning arrives as a separate message after the main reply
        setTimeout(async () => {
          try {
            await sendSmsViaHttpSms(senderPhone, securityWarning);
            console.log(`[httpSMS] Security warning sent to ${senderPhone}`);
          } catch (err) {
            console.error('[httpSMS] Failed to send security warning:', err);
          }
        }, 2000);
      }

      res.status(200).json({
        success: true,
        message: 'SMS processed and reply sent',
        data: {
          from: senderPhone,
          owner: ownerPhone,
          intent_reply: replyText,
          sms_sent: sendResult.success,
          sms_send_error: sendResult.error,
          security_warning_queued: containedPassword,
        },
      });

    } catch (error) {
      console.error('[httpSMS] Webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ── ESP32/SIM800L Webhook Endpoint ───────────────────────────────────────────
  app.post('/api/esp32-sms-webhook', express.json({ type: '*/*' }), async (req, res) => {
    try {
      const { from, message, deviceId } = req.body;

      // Validate ESP32 payload
      if (!from || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing "from" or "message" in ESP32 payload',
        });
      }

      // Sanitize message: strip non-printable / non-ASCII chars and take first line only
      const sanitized = message
        .split(/[\r\n]/)[0]                     // first line only
        .replace(/[^\x20-\x7E]/g, '')           // printable ASCII only
        .trim();

      if (!sanitized) {
        return res.status(400).json({
          success: false,
          error: 'Message is empty after sanitization',
        });
      }

      console.log(`[ESP32] SMS from ${from} (device: ${deviceId || 'unknown'}): "${sanitized}"`);

      // Convert to httpSMS format for processing
      const httpSmsEvent: HttpSmsEvent = {
        type: 'message.phone.received',
        data: {
          contact: from,
          content: sanitized,
          owner: 'ESP32-SIM800L',
          sim: 'SIM1',
          timestamp: new Date().toISOString(),
          user_id: deviceId || 'esp32-device',
        },
        datacontenttype: 'application/json',
        id: `esp32-${deviceId || 'unknown'}-${Date.now()}`,
        source: '/v1/messages/receive',
        specversion: '1.0',
        time: new Date().toISOString(),
      };

      // Process intent and generate reply
      const { reply: replyText, containedPassword } = await processIncomingSms(from, sanitized);
      console.log(`[ESP32] Reply to ${from}: "${replyText}"`);

      // For ESP32, we return the reply text for the device to send
      res.status(200).json({
        success: true,
        message: 'SMS processed successfully',
        data: {
          from,
          reply: replyText,
          containedPassword,
          deviceId: deviceId || 'unknown',
          // ESP32 should send this reply via SIM800L
          send_reply: true,
        },
      });

    } catch (error) {
      console.error('[ESP32] Webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/webhook-health', (_req, res) => {
    res.json({
      success: true,
      message: 'SMS webhook service is running',
      timestamp: new Date().toISOString(),
      endpoints: {
        httpsms: 'POST /api/sms-webhook (httpSMS CloudEvents)',
        esp32: 'POST /api/esp32-sms-webhook (ESP32/SIM800L)',
        health: 'GET /api/webhook-health',
      },
      config: {
        httpsms_api_key: process.env.HTTPSMS_API_KEY ? '> configured' : '!!! missing',
        httpsms_owner_phone: process.env.HTTPSMS_OWNER_PHONE ? '> configured' : '!!! missing',
        webhook_signing_key: process.env.HTTPSMS_WEBHOOK_SIGNING_KEY ? '> configured' : '!!! not set (validation disabled)',
        gemini_api_key: process.env.GEMINI_API_KEY ? '> configured' : '!!! missing',
      },
    });
  });

  console.log('SMS webhook routes configured:');
  console.log('- POST /api/sms-webhook (httpSMS CloudEvents format)');
  console.log('- POST /api/esp32-sms-webhook (ESP32/SIM800L simple format)');
  console.log('- GET /api/webhook-health (health check)');
}
