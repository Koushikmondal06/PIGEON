import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { findOnboardedUserSolana, insertOnboardedUserSolana } from "./onchain-solana";
import { encryptMnemonic } from "./crypto/mnemonic";

export interface OnboardResult {
  alreadyOnboarded: boolean;
  address?: string;
  error?: string;
}

/**
 * Onboard a user on Solana: generate Keypair, encrypt secret key with user password, store on-chain.
 * Password is required and is never stored; it encrypts the base58-encoded secret key.
 */
export async function onboardUserSolana(phone: string, password: string): Promise<OnboardResult> {
  console.log("onboardUserSolana called with phone:", phone);

  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return { alreadyOnboarded: false, error: "Phone number (from) is required for onboarding" };
  }
  if (!password || typeof password !== "string" || !password.trim()) {
    return { alreadyOnboarded: false, error: "Password is required for onboarding (used to encrypt your wallet)" };
  }

  const existing = await findOnboardedUserSolana(phone);
  if (existing?.address && existing?.encrypted_mnemonic) {
    return {
      alreadyOnboarded: true,
      address: existing.address,
    };
  }
  if (existing?.address && !existing?.encrypted_mnemonic) {
    return {
      alreadyOnboarded: false,
      error: "Account exists from legacy flow; please contact support or use a new phone number",
    };
  }

  try {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    // Encode the full 64-byte secret key as base58 for storage
    const secretKeyBase58 = bs58.encode(keypair.secretKey);

    // Encrypt the secret key with user's password (uses AES-256-GCM)
    const encrypted = encryptMnemonic(secretKeyBase58, password);

    // Store on-chain: address + encrypted secret key
    await insertOnboardedUserSolana(phone, address, encrypted);

    return {
      alreadyOnboarded: false,
      address,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { alreadyOnboarded: false, error: `Onboard failed: ${message}` };
  }
}
