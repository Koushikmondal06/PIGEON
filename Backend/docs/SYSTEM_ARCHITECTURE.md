# PIGEON System Architecture

This architecture reflects the target end-to-end flow for SMS-driven transactions with threshold cryptography.

## Architecture Overview

```text
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

## Component Mapping to This Repository

1. SMS Ingress (ESP32 GSM Mod / SMS Handler)
   - Endpoint: `POST /api/esp32-sms-webhook`
   - Implementation: `Backend/src/webhook.ts`
   - Role: accepts `{ from, message, deviceId }`, normalizes payload, forwards into processing pipeline.

2. Backend (Threshold Crypto Orchestration Layer)
   - Entry: `Backend/src/server.ts`
   - Core handlers: `Backend/src/send.ts`, `Backend/src/onboard.ts`, `Backend/src/fund.ts`, `Backend/src/balance.ts`, `Backend/src/transactions.ts`
   - Role: command routing, execution control, response shaping.

3. AI Intent Processing
   - Implementation: `Backend/src/intent.ts`
   - Usage points: `Backend/src/server.ts`, `Backend/src/webhook.ts`
   - Role: classifies SMS messages into intents and extracts transaction parameters.

4. Phone Number Validation
   - Primary normalization/lookup path: onboarding and user lookup by `from` phone in `Backend/src/onchain.ts`
   - Role: identity binding between SMS sender and wallet record.

5. DKG & TSS Engine (Threshold ECDSA)
   - Architectural role: signing subsystem for secure transaction authorization.
   - Backend integration point: transaction-signing path behind send execution (`Backend/src/send.ts`).

6. Network Execution (Ethereum / Arbitrum Sepolia)
   - Architectural role: final settlement network for signed transactions.
   - Trigger point: send flow after successful intent parse + validation + signing.

7. SMS Response / Confirmation
   - ESP32 response mode: reply returned by `POST /api/esp32-sms-webhook` for device-side SMS send.
   - httpSMS response mode: `sendSmsViaHttpSms(...)` in `Backend/src/webhook.ts`.

## End-to-End Sequence

1. User sends SMS command.
2. ESP32 receives message and forwards it to backend webhook.
3. Backend runs AI intent extraction and parameter parsing.
4. Backend validates sender phone + account linkage.
5. Backend routes request to DKG/TSS signing path.
6. Signed transaction is submitted to Arbitrum Sepolia.
7. Confirmation (success/failure, transaction details) is sent back by SMS.

## Notes

- The same processing pipeline also supports the httpSMS gateway (`POST /api/sms-webhook`) in addition to ESP32.
- Wallet secret material should remain encrypted-at-rest and only be decrypted for in-memory signing operations.