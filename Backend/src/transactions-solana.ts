import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { findOnboardedUserSolana } from "./onchain-solana";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const EXPLORER_BASE = "https://explorer.solana.com/tx";
const CLUSTER_PARAM = SOLANA_RPC_URL.includes("testnet") ? "?cluster=testnet"
  : SOLANA_RPC_URL.includes("devnet") ? "?cluster=devnet" : "";

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export interface TxnSummary {
  txId: string;
  type: string;
  roundTime: string;
  amount?: string;
  sender: string;
  receiver?: string;
  explorerUrl: string;
}

export interface GetTxnResult {
  success: boolean;
  address?: string;
  transactions?: TxnSummary[];
  error?: string;
}

/**
 * Fetch the last N transactions for a user's Solana wallet.
 */
export async function getTransactionsSolana(
  phone: string,
  limit: number = 5
): Promise<GetTxnResult> {
  console.log("getTransactionsSolana called with phone:", phone);

  if (!phone?.trim()) return { success: false, error: "Phone number is required" };

  const user = await findOnboardedUserSolana(phone);
  if (!user?.address) {
    return { success: false, error: "Account not found or not onboarded" };
  }

  try {
    const connection = getConnection();
    const pubkey = new PublicKey(user.address);

    // Get recent transaction signatures
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit,
    });

    if (signatures.length === 0) {
      return {
        success: true,
        address: user.address,
        transactions: [],
      };
    }

    // Fetch parsed transaction details
    const txIds = signatures.map((s) => s.signature);
    const parsedTxns = await connection.getParsedTransactions(txIds, {
      maxSupportedTransactionVersion: 0,
    });

    const txns: TxnSummary[] = signatures.map((sig, idx) => {
      const parsed = parsedTxns[idx];
      let type = "unknown";
      let amount: string | undefined;
      let sender = "";
      let receiver: string | undefined;

      if (parsed) {
        // Try to extract transfer info from parsed instructions
        const instructions = parsed.transaction.message.instructions;
        for (const ix of instructions) {
          if ("parsed" in ix && ix.program === "system") {
            const info = (ix as any).parsed;
            if (info.type === "transfer") {
              type = "transfer";
              sender = info.info.source;
              receiver = info.info.destination;
              amount = (Number(info.info.lamports) / LAMPORTS_PER_SOL).toFixed(9);
            }
          }
        }

        // Fallback: use fee payer as sender
        if (!sender) {
          sender = parsed.transaction.message.accountKeys[0]?.pubkey?.toBase58() ?? "";
        }
      }

      return {
        txId: sig.signature,
        type,
        roundTime: sig.blockTime
          ? new Date(sig.blockTime * 1000).toISOString()
          : "unknown",
        amount,
        sender,
        receiver,
        explorerUrl: `${EXPLORER_BASE}/${sig.signature}${CLUSTER_PARAM}`,
      };
    });

    return {
      success: true,
      address: user.address,
      transactions: txns,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to fetch transactions: ${message}` };
  }
}
