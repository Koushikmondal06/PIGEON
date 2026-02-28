/**
 * On-chain data layer for Solana — mirrors onchain.ts (Algorand version).
 *
 * All user data is stored on the Solana blockchain via the Pigeon Anchor
 * program using PDA (Program Derived Address) accounts.
 * The password is NEVER stored; only the AES-256-GCM encrypted mnemonic
 * goes on-chain.
 */

import "dotenv/config";
import {
    Connection,
    PublicKey,
    Keypair,
    clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import type { Pigeon } from "./contract/solana/pigeon";
import pigeonIdl from "./contract/solana/pigeon.json";

// ─── Environment ────────────────────────────────────────────────────────────

const SOLANA_RPC_URL =
    process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");

const SOLANA_PROGRAM_ID = new PublicKey(
    process.env.SOLANA_PROGRAM_ID ?? pigeonIdl.address
);

const ADMIN_PRIVATE_KEY = process.env.SOLANA_ADMIN_PRIVATE_KEY ?? "";

// ─── Singletons ─────────────────────────────────────────────────────────────

let _connection: Connection | null = null;
let _program: Program<Pigeon> | null = null;
let _adminKeypair: Keypair | null = null;

function getConnection(): Connection {
    if (!_connection) {
        _connection = new Connection(SOLANA_RPC_URL, "confirmed");
    }
    return _connection;
}

function getAdminKeypair(): Keypair {
    if (!_adminKeypair) {
        if (!ADMIN_PRIVATE_KEY) {
            throw new Error(
                "SOLANA_ADMIN_PRIVATE_KEY is not set — cannot interact with the Pigeon program"
            );
        }
        // Accept base58 or JSON array format
        try {
            const parsed = JSON.parse(ADMIN_PRIVATE_KEY);
            _adminKeypair = Keypair.fromSecretKey(Uint8Array.from(parsed));
        } catch {
            // Try base58 import
            const bs58 = require("bs58");
            _adminKeypair = Keypair.fromSecretKey(bs58.decode(ADMIN_PRIVATE_KEY));
        }
    }
    return _adminKeypair;
}

function getProgram(): Program<Pigeon> {
    if (!_program) {
        const connection = getConnection();
        const admin = getAdminKeypair();
        const wallet = new Wallet(admin);
        const provider = new AnchorProvider(connection, wallet, {
            commitment: "confirmed",
        });

        _program = new Program<Pigeon>(
            pigeonIdl as Pigeon,
            provider
        );
    }
    return _program;
}

// ─── PDA helpers ────────────────────────────────────────────────────────────

function getPigeonStatePda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("pigeon-state")],
        SOLANA_PROGRAM_ID
    );
}

function getUserPda(phone: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("user"), Buffer.from(phone)],
        SOLANA_PROGRAM_ID
    );
}

// ─── Public interface (same shape as onchain.ts / old db.ts) ────────────────

export interface OnboardedUser {
    phone: string;
    address: string | null;
    encrypted_mnemonic: string | null;
    created_at: number;
}

/**
 * Look up a user on-chain by phone number.
 * Returns null if not found (mirrors `findOnboardedUser` from onchain.ts).
 */
export async function findOnboardedUserSolana(
    phone: string
): Promise<OnboardedUser | null> {
    const normalised = normalizePhone(phone);
    const program = getProgram();
    const [userPda] = getUserPda(normalised);

    try {
        const account = await program.account.userAccount.fetch(userPda);
        return {
            phone: account.phone,
            address: account.address || null,
            encrypted_mnemonic: account.encryptedMnemonic || null,
            created_at: account.createdAt.toNumber(),
        };
    } catch {
        // Account doesn't exist → user not found
        return null;
    }
}

/**
 * Store a new user on-chain.
 * Mirrors `insertOnboardedUser` from onchain.ts.
 */
export async function insertOnboardedUserSolana(
    phone: string,
    address: string,
    encryptedMnemonic: string
): Promise<void> {
    const normalised = normalizePhone(phone);
    const program = getProgram();
    const admin = getAdminKeypair();
    const [pigeonStatePda] = getPigeonStatePda();
    const [userPda] = getUserPda(normalised);

    const createdAt = new BN(Math.floor(Date.now() / 1000));

    await program.methods
        .onboardUser(
            normalised,
            String(address ?? ""),
            String(encryptedMnemonic ?? ""),
            createdAt
        )
        .accounts({
            pigeonState: pigeonStatePda,
            userAccount: userPda,
            admin: admin.publicKey,
        })
        .rpc();
}

/**
 * Update an existing user's on-chain data.
 */
export async function updateOnboardedUserSolana(
    phone: string,
    address: string,
    encryptedMnemonic: string
): Promise<void> {
    const normalised = normalizePhone(phone);
    const program = getProgram();
    const admin = getAdminKeypair();
    const [pigeonStatePda] = getPigeonStatePda();
    const [userPda] = getUserPda(normalised);

    await program.methods
        .updateUser(normalised, address, encryptedMnemonic)
        .accounts({
            pigeonState: pigeonStatePda,
            userAccount: userPda,
            admin: admin.publicKey,
        })
        .rpc();
}

/**
 * Delete a user from on-chain storage.
 */
export async function deleteOnboardedUserSolana(
    phone: string
): Promise<void> {
    const normalised = normalizePhone(phone);
    const program = getProgram();
    const admin = getAdminKeypair();
    const [pigeonStatePda] = getPigeonStatePda();
    const [userPda] = getUserPda(normalised);

    await program.methods
        .deleteUser(normalised)
        .accounts({
            pigeonState: pigeonStatePda,
            userAccount: userPda,
            admin: admin.publicKey,
        })
        .rpc();
}

/**
 * Get total onboarded users count.
 */
export async function getTotalUsersSolana(): Promise<number> {
    const program = getProgram();
    const [pigeonStatePda] = getPigeonStatePda();

    const state = await program.account.pigeonState.fetch(pigeonStatePda);
    return state.totalUsers.toNumber();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "").trim() || phone;
}
