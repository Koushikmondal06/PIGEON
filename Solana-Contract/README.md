# Pigeon — Solana Smart Contract

Solana program (Anchor framework) that mirrors the Algorand `ContractPigeon` smart contract 1-to-1.

## Architecture

| Algorand Concept | Solana Equivalent |
|---|---|
| Global State (`admin`, `totalUsers`) | PDA account `PigeonState` (seed: `"pigeon-state"`) |
| Box Storage (`"u" + phone → UserData`) | PDA account `UserAccount` (seed: `["user", phone_bytes]`) |
| `createApplication()` | `initialize()` |
| `onboardUser()` | `onboard_user()` |
| `updateUser()` | `update_user()` |
| `deleteUser()` | `delete_user()` |
| `getUser()` | `get_user()` |
| `userExists()` | `user_exists()` |
| `getUserAddress()` | `get_user_address()` |
| `getTotalUsers()` | `get_total_users()` |

## Program ID

```
4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8
```

## Data Model

### PigeonState (singleton PDA)
| Field | Type | Description |
|---|---|---|
| `admin` | `Pubkey` | Admin who can mutate state |
| `total_users` | `u64` | Total onboarded users |
| `bump` | `u8` | PDA bump seed |

### UserAccount (per-user PDA)
| Field | Type | Max Size | Description |
|---|---|---|---|
| `phone` | `String` | 20 chars | Normalised phone number |
| `address` | `String` | 64 chars | Solana wallet address (base58) |
| `encrypted_mnemonic` | `String` | 512 chars | AES-256-GCM encrypted mnemonic |
| `created_at` | `u64` | 8 bytes | Unix timestamp |
| `bump` | `u8` | 1 byte | PDA bump seed |

## Prerequisites

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v2.0+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (v0.32+)
- [Rust](https://rustup.rs/) (stable)

## Build

```bash
cd Solana-Contract
anchor build
```

## Test

```bash
anchor test
```

This spins up a local Solana validator, deploys the program, and runs the test suite.

## Deploy to Devnet

```bash
# Configure for devnet
solana config set --url devnet

# Fund your wallet
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet
```

## Backend Integration

The backend integration file is at `Backend/src/onchain-solana.ts`.

### Required Environment Variables

```env
# Solana RPC endpoint (defaults to devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Program ID (defaults to IDL address)
SOLANA_PROGRAM_ID=4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8

# Admin private key (JSON array or base58 format)
SOLANA_ADMIN_PRIVATE_KEY=[1,2,3,...,64]
```

### Usage

```typescript
import {
  findOnboardedUserSolana,
  insertOnboardedUserSolana,
  updateOnboardedUserSolana,
  deleteOnboardedUserSolana,
  getTotalUsersSolana,
} from "./onchain-solana";

// Find user
const user = await findOnboardedUserSolana("1234567890");

// Onboard user
await insertOnboardedUserSolana("1234567890", "SolanaAddress...", "encryptedMnemonicBase64...");

// Update user
await updateOnboardedUserSolana("1234567890", "NewAddress...", "newEncryptedMnemonic...");

// Delete user
await deleteOnboardedUserSolana("1234567890");

// Get total users
const total = await getTotalUsersSolana();
```

## Security

- Only the admin (deployer) can call mutation instructions (`onboard_user`, `update_user`, `delete_user`)
- User accounts are PDAs derived from phone numbers — no collisions possible
- Encrypted mnemonics use AES-256-GCM; passwords are never stored on-chain
- Account closure refunds rent to admin
