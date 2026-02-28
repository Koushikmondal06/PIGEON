import { findOnboardedUserSolana } from "./onchain-solana";

export interface AddressResult {
  success: boolean;
  address?: string;
  phone?: string;
  error?: string;
}

/**
 * Get Solana wallet address for the user's account (identified by phone).
 */
export async function getAddressSolana(phone: string): Promise<AddressResult> {
  console.log("getAddressSolana called with phone:", phone);

  if (!phone?.trim()) return { success: false, error: "Phone is required" };

  const user = await findOnboardedUserSolana(phone);
  if (!user?.address) {
    return { success: false, error: "Account not found or not onboarded" };
  }

  return {
    success: true,
    address: user.address,
    phone: user.phone,
  };
}
