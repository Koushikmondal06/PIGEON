# PIGEON

SMS-based crypto wallet backend: AI intent (Gemini), **multi-chain** onboarding (**Algorand** + **Solana**) with password-encrypted mnemonic, and send flow on TestNet/Devnet.

---

## How to run (Backend)

**Prerequisites:** Node.js 18+

1. **Go to the backend and install dependencies**
   ```bash
   cd Backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at least:
   - **`GEMINI_API_KEY`** — required for `/api/sms` intent detection. Get one at [Google AI Studio](https://aistudio.google.com/apikey).
   - **Algorand** (optional): `ALGOD_SERVER` defaults to TestNet (`https://testnet-api.algonode.cloud`). No KMD needed.
   - **Solana** (optional): `SOLANA_RPC_URL` (defaults to devnet), `SOLANA_PROGRAM_ID`, and `SOLANA_ADMIN_PRIVATE_KEY` (64-byte JSON array from `~/.config/solana/id.json`).

3. **Start the server**
   - **Development** (watch mode):
     ```bash
     npm run dev
     ```
   - **Production** (build then run):
     ```bash
     npm run build
     npm start
     ```

4. **Check it**
   - Server listens on **http://localhost:3000** (or set `PORT` in `.env`).
   - See [Example requests](#example-requests) below for `curl` examples.

---

## Wallet creation and storage (password-encrypted, on-chain)

Wallets are created natively on each chain — **`algosdk.generateAccount()`** for Algorand, **`Keypair.generate()`** for Solana. The secret material (Algorand mnemonic / Solana secret key) is **encrypted with a user-chosen password** (AES-256-GCM + PBKDF2) and stored **on-chain**; the password is **never stored anywhere** — not on-chain, not off-chain.

| | Algorand | Solana |
|---|---|---|
| **Account creation** | `algosdk.generateAccount()` | `Keypair.generate()` |
| **Secret stored** | 25-word mnemonic (encrypted) | base58 secret key (encrypted) |
| **On-chain storage** | Box Storage (keyed by `"u" + phone`) | PDA account (seed: `["user", phone]`) |
| **Encryption** | AES-256-GCM + PBKDF2 | AES-256-GCM + PBKDF2 |

- **Onboard**: request must include `password`; we create the account, encrypt the secret with it, and store the encrypted value + address **on-chain** keyed by the user's phone number.
- **Send**: request must include `password`; we read the encrypted secret **from the chain**, decrypt it in-memory, sign the tx, submit to the network, then **discard the decrypted data immediately**.
- **No database**: there is no SQLite, no file-based DB. The blockchain **is** the database.

> ⚠️ The password is the **only** way to decrypt the secret. If lost, the wallet **cannot be recovered**.

---

## Smart Contract — On-Chain Storage (`Pigeon-Contract`)

The `ContractPigeon` smart contract (written in [Algorand TypeScript](https://github.com/algorandfoundation/puya-ts)) replaces traditional database storage. All user data lives **on-chain** in Algorand **Box Storage**.

### Data Model

| Field | Type | Description |
|---|---|---|
| **phone** (Box key) | `arc4.Str` | Normalised phone number (digits only) — used as the Box key with prefix `u` |
| **address** | `arc4.Str` | Algorand wallet address generated during onboarding |
| **encryptedMnemonic** | `arc4.Str` | AES-256-GCM encrypted mnemonic (base64 string) — **only decryptable with user's password** |
| **createdAt** | `arc4.Uint64` | Unix timestamp of onboarding |

### Contract Methods

| Method | Access | Description |
|---|---|---|
| `createApplication()` | Creator | Sets the deployer as admin |
| `onboardUser(phone, address, encryptedMnemonic, createdAt)` | Admin | Register a new user on-chain (creates a Box) |
| `updateUser(phone, address, encryptedMnemonic)` | Admin | Update user data (preserves `createdAt`) |
| `deleteUser(phone)` | Admin | Remove user and free Box storage |
| `getUser(phone)` | Anyone | Read full user record |
| `userExists(phone)` | Anyone | Check if phone is onboarded |
| `getUserAddress(phone)` | Anyone | Get wallet address for a phone |
| `getTotalUsers()` | Anyone | Get total onboarded user count |

### Security Model

```
User SMS ──▶ "create wallet password mySecret"
                    │
                    ▼
            Backend generates Algorand account
            Encrypts mnemonic: AES-256-GCM(mnemonic, PBKDF2(password))
            Calls smart contract: onboardUser(phone, address, encryptedBlob)
                    │
                    ▼
            On-Chain Box Storage (Algorand)
            ┌──────────────────────────────────┐
            │ Box "u9123456789"                │
            │   address: "XJ2W...ALGO_ADDR"    │
            │   encryptedMnemonic: "salt:iv:…" │  ← AES-256-GCM encrypted
            │   createdAt: 1740000000          │
            └──────────────────────────────────┘

            Password is NEVER stored (not on-chain, not off-chain)
            Decryption happens in-memory only when user sends password
```

### How to deploy (step-by-step)

**Prerequisites:**
- [AlgoKit CLI](https://github.com/algorandfoundation/algokit-cli) installed
- Node.js 22+
- A funded Algorand TestNet account (the "deployer/admin")

**Step 1 — Create a deployer account** (if you don't have one):
```bash
# Generate a new account
algokit task wallet create

# Fund it on TestNet faucet:
# https://bank.testnet.algorand.network/
```

**Step 2 — Build the contract:**
```bash
cd Pigeon-Contract/projects/Pigeon-Contract
npm install
npm run build
```
This compiles `contract.algo.ts` → TEAL and generates the typed client `ContractPigeonClient.ts`.

**Step 3 — Configure deployer `.env`:**
```bash
cd Pigeon-Contract/projects/Pigeon-Contract
cp .env.example .env   # or create .env manually
```
Add your deployer mnemonic:
```
DEPLOYER_MNEMONIC=word1 word2 word3 ... word25
```

**Step 4 — Deploy to TestNet:**
```bash
npm run deploy
```
Output will show the **App ID** — copy it:
```
ContractPigeon deployed at <APP_ID>, total users: 0
```
The deploy script automatically funds the app account with 1 ALGO for Box MBR costs.

**Step 5 — Configure the backend:**
```bash
cd Backend
cp .env.example .env
```
Set these in `Backend/.env`:
```
PIGEON_APP_ID=<APP_ID from Step 4>
ADMIN_MNEMONIC=<same 25-word mnemonic from Step 3>
```

**Step 6 — Start the backend:**
```bash
cd Backend
npm install
npm run dev
```

**Step 7 — Test it:**
```bash
# Onboard a new user
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"create wallet password mySecret123","password":"mySecret123"}'

# Check the address (stored on-chain)
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"my address"}'
```

> Each onboarded user creates a Box on-chain. Box cost = `2500 + 400 × (keyLen + valueLen)` microAlgos. Make sure the app account stays funded.

### Contract source

- **Contract**: [`contract.algo.ts`](Pigeon-Contract/projects/Pigeon-Contract/smart_contracts/contract_pigeon/contract.algo.ts)
- **Deploy config**: [`deploy-config.ts`](Pigeon-Contract/projects/Pigeon-Contract/smart_contracts/contract_pigeon/deploy-config.ts)
- **Generated client**: [`ContractPigeonClient.ts`](Pigeon-Contract/projects/Pigeon-Contract/smart_contracts/artifacts/contract_pigeon/ContractPigeonClient.ts) — auto-generated typed TypeScript client used by the backend to call the contract with type-safe methods

---

## Solana Smart Contract (`Solana-Contract`)

The **Pigeon** Solana program (written with [Anchor](https://www.anchor-lang.com/)) mirrors the Algorand `ContractPigeon` contract 1-to-1. All user data lives **on-chain** in Solana **PDA (Program Derived Address)** accounts.

**Program ID:** `4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8`

### Solana Data Model

| Algorand Concept | Solana Equivalent |
|---|---|
| Global State (`admin`, `totalUsers`) | PDA `PigeonState` (seed: `"pigeon-state"`) |
| Box Storage (`"u" + phone → UserData`) | PDA `UserAccount` (seed: `["user", phone_bytes]`) |
| `createApplication()` | `initialize()` |
| `onboardUser()` | `onboard_user()` |
| `updateUser()` | `update_user()` |
| `deleteUser()` | `delete_user()` |
| `getUser()` / `userExists()` / etc. | `get_user()` / `user_exists()` / etc. |

### Solana Contract Deploy

```bash
# Build
cd Solana-Contract
anchor build

# Test (local validator)
anchor test

# Deploy to devnet
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

### Solana Backend Integration

The Solana backend has **full feature parity** with Algorand — every operation (onboard, send, balance, fund, address, transactions, export key) works identically on both chains.

#### Environment Variables

Set these in `Backend/.env`:
```env
SOLANA_RPC_URL=https://api.testnet.solana.com
SOLANA_PROGRAM_ID=4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8
SOLANA_ADMIN_PRIVATE_KEY=[45,65,186,...,133]   # 64-byte JSON array from ~/.config/solana/id.json
```

#### Solana Backend Modules

| Module | File | Algorand Equivalent | Description |
|---|---|---|---|
| On-chain CRUD | [`onchain-solana.ts`](Backend/src/onchain-solana.ts) | `onchain.ts` | Read/write user data to Solana PDA accounts |
| Onboard | [`onboard-solana.ts`](Backend/src/onboard-solana.ts) | `onboard.ts` | Generate Keypair, encrypt secret key, store on-chain |
| Send | [`send-solana.ts`](Backend/src/send-solana.ts) | `send.ts` | Decrypt key, sign `SystemProgram.transfer`, supports phone-to-phone |
| Balance | [`balance-solana.ts`](Backend/src/balance-solana.ts) | `balance.ts` | Query SOL balance via `connection.getBalance()` |
| Fund | [`fund-solana.ts`](Backend/src/fund-solana.ts) | `fund.ts` | Admin sends 0.1 SOL to user (rate-limited 1/day) |
| Address | [`address-solana.ts`](Backend/src/address-solana.ts) | `address.ts` | Return user's Solana wallet address |
| Transactions | [`transactions-solana.ts`](Backend/src/transactions-solana.ts) | `transactions.ts` | Fetch recent txns with Solana Explorer links |

#### Chain Selection

The server routes to Algorand or Solana based on (in priority order):
1. **Explicit `chain` field** in the request body: `"chain": "solana"` or `"chain": "algorand"`
2. **Intent detection** from the message — Gemini detects keywords like "SOL", "Solana" → `solana`; "ALGO", "Algorand" → `algorand`
3. **Default**: `algorand` (if nothing specified)

#### Solana Flow Diagram

```
User SMS ──▶ "create wallet on solana password mySecret"
                    │
                    ▼
            Backend generates Solana Keypair
            Encrypts secret key: AES-256-GCM(bs58(secretKey), PBKDF2(password))
            Calls Pigeon program: onboard_user(phone, address, encryptedBlob)
                    │
                    ▼
            On-Chain PDA Account (Solana)
            ┌──────────────────────────────────┐
            │ PDA ["user", "9123456789"]       │
            │   address: "2iYz...SOL_ADDR"     │
            │   encrypted_mnemonic: "salt:iv:…"│  ← AES-256-GCM encrypted
            │   created_at: 1740000000         │
            └──────────────────────────────────┘

            Password is NEVER stored (not on-chain, not off-chain)
            Decryption happens in-memory only when user sends password
```

### Solana Contract Source

- **Program**: [`programs/pigeon/src/lib.rs`](Solana-Contract/programs/pigeon/src/lib.rs)
- **IDL**: [`target/idl/pigeon.json`](Solana-Contract/target/idl/pigeon.json)
- **Tests**: [`tests/pigeon.ts`](Solana-Contract/tests/pigeon.ts)

See [`Solana-Contract/README.md`](Solana-Contract/README.md) for full details.

---

## Example requests

Base URL: `http://localhost:3000` (or your `PORT`). All requests: `POST /api/sms`, `Content-Type: application/json`.

> **Chain selection**: Add `"chain": "solana"` to use Solana, or omit / use `"chain": "algorand"` for Algorand (default). The AI also auto-detects from keywords like "SOL" or "ALGO".

### Algorand Examples

**1. Onboard** (create Algorand wallet; **requires `password`**):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"I want to sign up","password":"mySecretPass123"}'
```
```json
{
  "ok": true,
  "chain": "algorand",
  "intent": "onboard",
  "onboarding": { "alreadyOnboarded": false, "address": "XJ2W...ALGO_ADDR" }
}
```

**2. Send ALGO** (**requires `password`**):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"send 1 ALGO to RECIPIENT_ADDR","password":"mySecretPass123"}'
```
```json
{
  "ok": true,
  "chain": "algorand",
  "intent": "send",
  "send": { "success": true, "txId": "TX_ID" }
}
```

**3. Check balance**:
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"balance"}'
```

### Solana Examples

**4. Onboard on Solana** (create Solana wallet; **requires `password`**):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"create wallet on solana","password":"mySecretPass123","chain":"solana"}'
```
```json
{
  "ok": true,
  "chain": "solana",
  "intent": "onboard",
  "onboarding": { "alreadyOnboarded": false, "address": "2iYz...SOL_ADDR" }
}
```

**5. Send SOL** (**requires `password`**; recipient can be a Solana address or onboarded phone):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"send 0.1 SOL to RECIPIENT_ADDR password mySecretPass123","password":"mySecretPass123","chain":"solana"}'
```
```json
{
  "ok": true,
  "chain": "solana",
  "intent": "send",
  "send": { "success": true, "txId": "TX_SIG", "explorerUrl": "https://explorer.solana.com/tx/TX_SIG?cluster=testnet" }
}
```

**6. Check SOL balance**:
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"SOL balance","chain":"solana"}'
```
```json
{
  "ok": true,
  "chain": "solana",
  "balance": { "success": true, "balance": "0.1", "asset": "SOL", "address": "2iYz..." }
}
```

**7. Fund (testnet SOL from admin)**:
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"fund me","chain":"solana"}'
```
```json
{
  "ok": true,
  "chain": "solana",
  "fund": { "success": true, "txId": "TX_SIG", "explorerUrl": "https://explorer.solana.com/tx/..." }
}
```

**8. Get Solana address**:
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"my address","chain":"solana"}'
```

**9. Transaction history (Solana)**:
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"last transactions","chain":"solana"}'
```

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   SMS Messages  │───▶│  ESP32 GSM Mod   │───▶│   Backend           │
│   (User Input)  │     │  SMS Handler     │     │  (Threshold Crypto) │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                              │                           │
                              │                           ▼
                              │                  ┌─────────────────────┐
                              │                  │   AI Intent         │
                              │                  │   Processing        │
                              │                  └─────────────────────┘
                              │                           │
                              │                           ▼
                              │                  ┌─────────────────────┐
                              │                  │  Phone Number       │
                              │                  │  Validation         │
                              │                  └─────────────────────┘
                              │                           │
                              ▼                           ▼
                    ┌──────────────────┐    ┌─────────────────────┐
                    │  SMS Response    │◀───│  DKG & TSS Engine  │
                    │  (Transaction    │    │  (Threshold ECDSA)  │
                    │   Confirmation)  │    └─────────────────────┘
                    └──────────────────┘              │
                                                      ▼
                                            ┌─────────────────────┐
                                            │  Ethereum Network   │
                                            │  (Arbitrum Sepolia) │
                                            └─────────────────────┘
```


```
User SMS ──▶ Android App (SMSReceiver) 
                  │
                  ▼
            POST /api/ai  ──▶  Regex Parser (fast)
                                    │
                              ┌─────┴─────┐
                              │ success?   │
                              ▼            ▼
                           Use it     ASI1 AI (fallback)
                              │            │
                              └─────┬──────┘
                                    ▼
                            Intent Routing
                        ┌───────┼────────┐
                        ▼       ▼        ▼
                   get-addr  balance  transaction
                      │        │         │
                      ▼        ▼         ▼
                    DKG    chain-RPC   TSS Sign → Broadcast
                      │        │         │
                      └────────┴─────────┘
                                │
                                ▼
                         JSON Response
                                │
                                ▼
                    Android App (SMSSender) ──▶ SMS to User
```