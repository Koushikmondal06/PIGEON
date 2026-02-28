import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { findOnboardedUserSolana } from "./onchain-solana";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export interface BalanceParams {
  asset?: string; // "SOL"; only SOL supported for now
}

export interface BalanceResult {
  success: boolean;
  balance?: string;
  asset?: string;
  address?: string;
  error?: string;
}

/**
 * Get SOL balance for the user's account (identified by phone).
 */
export async function getBalanceSolana(
  phone: string,
  params: BalanceParams = {}
): Promise<BalanceResult> {
  console.log("getBalanceSolana called with phone:", phone);

  if (!phone?.trim()) return { success: false, error: "Phone is required" };

  const user = await findOnboardedUserSolana(phone);
  if (!user?.address) {
    return { success: false, error: "Account not found or not onboarded" };
  }

  try {
    const connection = getConnection();
    const pubkey = new PublicKey(user.address);
    const lamports = await connection.getBalance(pubkey);
    const balanceSol = lamports / LAMPORTS_PER_SOL;

    return {
      success: true,
      balance: balanceSol.toString(),
      asset: "SOL",
      address: user.address,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to get balance: ${message}` };
  }
}
