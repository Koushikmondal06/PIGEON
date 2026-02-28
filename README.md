# PIGEON - SMS-Based Payment & Account Management System

## System Architecture Overview

PIGEON is an SMS-first transaction system with AI intent processing, phone-aware routing, and threshold-signing orchestration.

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   SMS Messages  │───▶│  ESP32 GSM Mod   │───▶│       Backend       │
│   (User Input)  │    │  SMS Handler     │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
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
                    │  SMS Response    │◀───│  DKG & TSS Engine   │
                    │  (Transaction    │    │  (Threshold ECDSA)  │
                    │   Confirmation)  │    └─────────────────────┘
                    └──────────────────┘              │
                                                      ▼
                                            ┌─────────────────────┐
                                            │       On-Chain      │
                                            │     Algo Testnet    │
                                            └─────────────────────┘
```

## Architecture Docs

- Detailed architecture and code mapping: [Backend/docs/SYSTEM_ARCHITECTURE.md](Backend/docs/SYSTEM_ARCHITECTURE.md)
- Wallet encryption and key handling: [Backend/docs/WALLET_STORAGE.md](Backend/docs/WALLET_STORAGE.md)
- SMS gateway setup (httpSMS + ESP32): [Backend/sms-gateway-setup.md](Backend/sms-gateway-setup.md)

