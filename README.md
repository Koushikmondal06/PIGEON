# PIGEON

SMS-based crypto wallet backend: AI intent (Gemini), Algorand onboarding (no KMD — password-encrypted mnemonic), and send flow on TestNet.

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

## Wallet creation and storage (no KMD, password-encrypted, on-chain)

Wallets are created with **`algosdk.generateAccount()`** (no KMD). The mnemonic is **encrypted with a user-chosen password** (AES-256-GCM + PBKDF2) and stored **on-chain** in an Algorand smart contract using **Box Storage**; the password is **never stored anywhere** — not on-chain, not off-chain.

- **Onboard**: request must include `password`; we create the account, encrypt the mnemonic with it, and store the encrypted value + address **on-chain** in a Box keyed by the user's phone number.
- **Send**: request must include `password`; we read the encrypted mnemonic **from the chain**, decrypt it in-memory, sign the tx, submit to Algorand TestNet, then **discard the decrypted data immediately**.
- **No database**: there is no SQLite, no file-based DB. The Algorand blockchain **is** the database.

> ⚠️ The password is the **only** way to decrypt the mnemonic. If lost, the wallet **cannot be recovered**.

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

## Example requests

Base URL: `http://localhost:3000` (or your `PORT`). All requests: `POST /api/sms`, `Content-Type: application/json`.

**1. Get intent only** (no `password`; returns intent + params only, does not create wallet or send):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"send 10 ALGO to 9912345678"}'
```
Example response:
```json
{
  "ok": true,
  "from": "+919123456789",
  "message": "send 10 ALGO to 9912345678",
  "intent": "send",
  "params": { "amount": "10", "asset": "ALGO", "to": "9912345678" }
}
```

**2. Onboard** (create account; **requires `password`** — used to encrypt mnemonic, never stored):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"I want to sign up","password":"mySecretPass123"}'
```
Example response:
```json
{
  "ok": true,
  "from": "+919123456789",
  "message": "I want to sign up",
  "intent": "onboard",
  "params": {},
  "onboarding": { "alreadyOnboarded": false, "address": "XJ2W...ALGO_ADDR" }
}
```
Fund the returned `address` on [TestNet faucet](https://bank.testnet.algorand.network/).

**3. Send ALGO** (**requires `password`** — decrypts wallet and signs the transaction):
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"from":"+919123456789","message":"send 1 ALGO to RECIPIENT_ALGO_ADDRESS","password":"mySecretPass123"}'
```
Recipient can be an Algorand address or an onboarded phone number. Example response:
```json
{
  "ok": true,
  "intent": "send",
  "params": { "amount": "1", "asset": "ALGO", "to": "RECIPIENT_ALGO_ADDRESS" },
  "send": { "success": true, "txId": "TX_ID_FROM_NETWORK" }
}
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