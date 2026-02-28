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
import bs58 from "bs58";
import { findOnboardedUserSolana } from "./onchain-solana";
import { decryptMnemonic } from "./crypto/mnemonic";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const EXPLORER_BASE = "https://explorer.solana.com/tx";
const CLUSTER_PARAM = SOLANA_RPC_URL.includes("testnet") ? "?cluster=testnet"
  : SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : "";

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export interface SendParams {
  amount: string;  // in SOL
  asset?: string;  // "SOL"; only SOL supported for now
  to: string;      // recipient address or phone number
}

export interface SendResult {
  success: boolean;
  txId?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Send SOL from the user's account (identified by phone) to a recipient.
 * Requires the user's password to decrypt the secret key and sign the transaction.
 */
export async function sendSol(
  phone: string,
  password: string,
  params: SendParams
): Promise<SendResult> {
  console.log("sendSol called with phone:", phone);

  if (!phone?.trim()) return { success: false, error: "Phone (from) is required" };
  if (!password?.trim()) return { success: false, error: "Password is required to send (decrypt wallet)" };
  if (!params.to?.trim()) return { success: false, error: "Recipient (to) is required" };

  const amountSol = parseFloat(params.amount);
  if (Number.isNaN(amountSol) || amountSol <= 0) {
    return { success: false, error: "Invalid amount" };
  }
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  let toAddress = params.to.trim();

  // Check if it's a valid Solana public key
  let toPubkey: PublicKey;
  try {
    toPubkey = new PublicKey(toAddress);
    // Validate it's on the ed25519 curve
    if (!PublicKey.isOnCurve(toPubkey)) {
      throw new Error("not on curve");
    }
  } catch {
    // Not a valid address, treat as a phone number and look up on-chain
    const toUser = await findOnboardedUserSolana(toAddress);
    if (toUser?.address) {
      toAddress = toUser.address;
      toPubkey = new PublicKey(toAddress);
    } else {
      return {
        success: false,
        error: `Invalid recipient "${params.to}". Use a valid Solana address or an onboarded phone number.`,
      };
    }
  }

  // Look up sender
  const user = await findOnboardedUserSolana(phone);
  if (!user?.encrypted_mnemonic || !user?.address) {
    return { success: false, error: "Account not found or not onboarded with password-protected wallet" };
  }

  let senderKeypair: Keypair;
  try {
    const secretKeyBase58 = decryptMnemonic(user.encrypted_mnemonic, password);
    const secretKey = bs58.decode(secretKeyBase58);
    senderKeypair = Keypair.fromSecretKey(secretKey);

    if (senderKeypair.publicKey.toBase58() !== user.address) {
      return { success: false, error: "Wallet address mismatch" };
    }
  } catch {
    return { success: false, error: "Wrong password (decrypt failed)" };
  }

  try {
    const connection = getConnection();

    // Check sender balance
    const balance = await connection.getBalance(senderKeypair.publicKey);
    const fee = 5000; // ~5000 lamports per signature
    const rentExempt = 890880; // approximate rent-exempt minimum for a system account
    const totalRequired = lamports + fee;

    if (balance < totalRequired) {
      return {
        success: false,
        error: `Insufficient balance. Required: ${(totalRequired / LAMPORTS_PER_SOL).toFixed(9)} SOL (includes fee), Available: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`,
      };
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const txId = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);
    const explorerUrl = `${EXPLORER_BASE}/${txId}${CLUSTER_PARAM}`;

    return {
      success: true,
      txId,
      explorerUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Transaction failed: ${message}` };
  }
}
