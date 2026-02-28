import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { findOnboardedUserSolana } from "./onchain-solana";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const SOLANA_ADMIN_PRIVATE_KEY = process.env.SOLANA_ADMIN_PRIVATE_KEY ?? "";
const EXPLORER_BASE = "https://explorer.solana.com/tx";
const CLUSTER_PARAM = SOLANA_RPC_URL.includes("testnet") ? "?cluster=testnet"
  : SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : "";

const FUND_AMOUNT_SOL = 0.1; // Fund 0.1 SOL on testnet (reasonable amount)
const FUND_AMOUNT_LAMPORTS = Math.floor(FUND_AMOUNT_SOL * LAMPORTS_PER_SOL);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** In-memory rate-limit tracker: phone → last fund timestamp */
const lastFundMap = new Map<string, number>();

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

function getAdminKeypair(): Keypair {
  if (!SOLANA_ADMIN_PRIVATE_KEY) {
    throw new Error("SOLANA_ADMIN_PRIVATE_KEY is not set — cannot fund users");
  }
  try {
    const parsed = JSON.parse(SOLANA_ADMIN_PRIVATE_KEY);
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    const bs58 = require("bs58");
    return Keypair.fromSecretKey(bs58.decode(SOLANA_ADMIN_PRIVATE_KEY));
  }
}

export interface FundResult {
  success: boolean;
  txId?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Fund a user's Solana wallet with testnet SOL from the admin wallet.
 * Limited to once per user per day.
 */
export async function fundUserSolana(phone: string): Promise<FundResult> {
  console.log("fundUserSolana called with phone:", phone);

  if (!phone?.trim()) return { success: false, error: "Phone number is required" };

  if (!SOLANA_ADMIN_PRIVATE_KEY) {
    return { success: false, error: "Admin wallet not configured on server" };
  }

  // ── Rate limit: 1 fund per user per day ──
  const normalised = phone.replace(/\D/g, "").trim() || phone;
  const lastFund = lastFundMap.get(normalised);
  if (lastFund) {
    const elapsed = Date.now() - lastFund;
    if (elapsed < ONE_DAY_MS) {
      const hoursLeft = Math.ceil((ONE_DAY_MS - elapsed) / (60 * 60 * 1000));
      return {
        success: false,
        error: `You can only be funded once per day. Try again in ~${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
      };
    }
  }

  // Look up user's on-chain address
  const user = await findOnboardedUserSolana(phone);
  if (!user?.address) {
    return { success: false, error: "User not found or not onboarded. Please onboard first." };
  }

  try {
    const connection = getConnection();
    const adminKeypair = getAdminKeypair();
    const recipientPubkey = new PublicKey(user.address);

    // Check admin balance
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    const totalRequired = FUND_AMOUNT_LAMPORTS + 5000; // amount + fee

    if (adminBalance < totalRequired) {
      return {
        success: false,
        error: `Admin wallet has insufficient balance. Available: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
      };
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: FUND_AMOUNT_LAMPORTS,
      })
    );

    const txId = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);
    const explorerUrl = `${EXPLORER_BASE}/${txId}${CLUSTER_PARAM}`;

    // Record successful fund timestamp
    lastFundMap.set(normalised, Date.now());

    return {
      success: true,
      txId,
      explorerUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Fund transaction failed: ${message}` };
  }
}
