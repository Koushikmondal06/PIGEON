import { GoogleGenAI } from "@google/genai";

export type IntentType = "send" | "get_balance" | "get_txn" | "onboard" | "get_address" | "fund" | "get_pvt_key" | "unknown";

export interface IntentParams {
  amount?: string;
  asset?: string;
  to?: string;
  txnId?: string;
  password?: string;
}

export interface IntentResult {
  intent: IntentType;
  params: IntentParams;
  rawMessage: string;
}

const INTENT_PROMPT = `You are an intent classifier for SMS-based crypto wallet commands.
Given a user message, return a JSON object with:
- "intent": one of "send" | "get_balance" | "get_txn" | "onboard" | "get_address" | "fund" | "unknown"
  - "send": user wants to send crypto (e.g. "send 30 ALGO to 9912345678 password mypass123")
  - "get_balance": user wants to check balance (e.g. "balance", "how much ALGO do I have")
  - "get_txn": user wants transaction history or status (e.g. "last transaction", "txn status")
  - "onboard": new user wants to onboard / sign up / create wallet (e.g. "create wallet password mypass123", "sign me up password secret", "register password abc")
  - "get_address": user wants to get their wallet address (e.g. "my address", "show my address")
  - "fund": user wants to receive a free 1 ALGO testnet token to fund their wallet (e.g. "fund me", "fund", "give me ALGO", "top up my wallet", "fund my account")
  - "get_pvt_key": user wants to export or see their private key / secret key / mnemonic / recovery phrase (e.g. "get pvt key", "private key", "export key", "show mnemonic", "recovery phrase", "secret key")
  - "unknown": unclear or unrelated
- "params": object with extracted fields when relevant:
  - for "send": amount (string number), asset (e.g. "ALGO"), to (recipient address/phone), password (user's wallet password)
  - for "onboard": password (the password the user wants to use to protect their wallet)
  - for "get_txn": txnId if user asked about a specific transaction
  - omit fields that are not present in the message

IMPORTANT: The "password" field is critical for "send" and "onboard" intents. Extract it from phrases like "password mypass", "pass mypass", "pw mypass", "pin 1234", or the last word/phrase after the keyword "password".

Reply with ONLY valid JSON, no markdown or extra text. Examples:
{"intent":"onboard","params":{"password":"mypass123"}}
{"intent":"send","params":{"amount":"5","asset":"ALGO","to":"9912345678","password":"mypass123"}}
{"intent":"fund","params":{}}
{"intent":"get_pvt_key","params":{}}`;

function parseIntentJson(text: string): IntentResult["intent"] {
  const t = text.trim().toLowerCase();
  if (["send", "get_balance", "get_txn", "onboard", "get_address", "fund", "get_pvt_key", "unknown"].includes(t)) return t as IntentResult["intent"];
  return "unknown";
}

function parseParams(obj: unknown): IntentParams {
  if (obj == null || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  return {
    amount: typeof o.amount === "string" ? o.amount : undefined,
    asset: typeof o.asset === "string" ? o.asset : undefined,
    to: typeof o.to === "string" ? o.to : undefined,
    txnId: typeof o.txnId === "string" ? o.txnId : undefined,
    password: typeof o.password === "string" ? o.password : undefined,
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
