import { GoogleGenAI } from "@google/genai";

export type IntentType = "send" | "get_balance" | "get_txn" | "onboard" | "get_address" | "fund" | "get_pvt_key" | "unknown";

export type ChainType = "algorand" | "solana";

export interface IntentParams {
  amount?: string;
  asset?: string;
  to?: string;
  txnId?: string;
  password?: string;
  chain?: ChainType;
}

export interface IntentResult {
  intent: IntentType;
  params: IntentParams;
  rawMessage: string;
}

const INTENT_PROMPT = `You are an intent classifier for SMS-based crypto wallet commands.
This wallet supports TWO blockchains: Algorand (ALGO) and Solana (SOL).
Given a user message, return a JSON object with:
- "intent": one of "send" | "get_balance" | "get_txn" | "onboard" | "get_address" | "fund" | "unknown"
  - "send": user wants to send crypto (e.g. "send 30 ALGO to 9912345678 password mypass123", "send 2 SOL to 9912345678 password mypass123")
  - "get_balance": user wants to check balance (e.g. "balance", "how much SOL do I have", "ALGO balance")
  - "get_txn": user wants transaction history or status (e.g. "last transaction", "txn status")
  - "onboard": new user wants to onboard / sign up / create wallet (e.g. "create wallet password mypass123", "sign me up on solana password secret")
  - "get_address": user wants to get their wallet address (e.g. "my address", "show my solana address")
  - "fund": user wants to receive free testnet tokens to fund their wallet (e.g. "fund me", "fund", "give me SOL")
  - "get_pvt_key": user wants to export or see their private key / secret key / mnemonic / recovery phrase
  - "unknown": unclear or unrelated
- "params": object with extracted fields when relevant:
  - for "send": amount (string number), asset (e.g. "ALGO" or "SOL"), to (recipient address/phone), password (user's wallet password)
  - for "onboard": password (the password the user wants to use), chain ("algorand" or "solana") if user specifies
  - for "get_balance": asset ("ALGO" or "SOL") if specified
  - for "get_txn": txnId if user asked about a specific transaction
  - chain: "algorand" or "solana" — infer from context: if user mentions SOL/Solana → "solana", if ALGO/Algorand → "algorand". If unclear, omit.
  - omit fields that are not present in the message

IMPORTANT: The "password" field is critical for "send" and "onboard" intents. Extract it from phrases like "password mypass", "pass mypass", "pw mypass", "pin 1234", or the last word/phrase after the keyword "password".

Reply with ONLY valid JSON, no markdown or extra text. Examples:
{"intent":"onboard","params":{"password":"mypass123","chain":"solana"}}
{"intent":"send","params":{"amount":"5","asset":"SOL","to":"9912345678","password":"mypass123","chain":"solana"}}
{"intent":"send","params":{"amount":"5","asset":"ALGO","to":"9912345678","password":"mypass123","chain":"algorand"}}
{"intent":"fund","params":{"chain":"solana"}}
{"intent":"get_pvt_key","params":{}}`;

function parseIntentJson(text: string): IntentResult["intent"] {
  const t = text.trim().toLowerCase();
  if (["send", "get_balance", "get_txn", "onboard", "get_address", "fund", "get_pvt_key", "unknown"].includes(t)) return t as IntentResult["intent"];
  return "unknown";
}

function parseParams(obj: unknown): IntentParams {
  if (obj == null || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  const chain = typeof o.chain === "string" && (o.chain === "algorand" || o.chain === "solana")
    ? o.chain as ChainType
    : undefined;
  // Also infer chain from asset if not explicitly set
  const asset = typeof o.asset === "string" ? o.asset : undefined;
  const inferredChain = chain
    ?? (asset?.toUpperCase() === "SOL" ? "solana" : undefined)
    ?? (asset?.toUpperCase() === "ALGO" ? "algorand" : undefined);
  return {
    amount: typeof o.amount === "string" ? o.amount : undefined,
    asset,
    to: typeof o.to === "string" ? o.to : undefined,
    txnId: typeof o.txnId === "string" ? o.txnId : undefined,
    password: typeof o.password === "string" ? o.password : undefined,
    chain: inferredChain,
  };
}

export async function getIntent(
  message: string,
  apiKey: string
): Promise<IntentResult> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${INTENT_PROMPT}\n\nUser message: ${message}`,
  });

  const raw = (response.text ?? "").trim();
  const rawMessage = message;

  // Strip markdown code block if present
  let jsonStr = raw;
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr) as {
      intent?: string;
      params?: unknown;
    };
    const intent = parseIntentJson(parsed.intent ?? "unknown");
    const params = parseParams(parsed.params);
    return { intent, params, rawMessage };
  } catch {
    return {
      intent: "unknown",
      params: {},
      rawMessage,
    };
  }
}
