# PIGEON

User Phone
   ↓ (SMS)
SMS Gateway
   ↓
SMS Handler
   ↓
Intent Parser / NLP
   ↓
Command Router (Algo Layer)
   ↓
Business Services
   ├── Account Service
   ├── Payment Service
   └── Wallet/Chain Service
   ↓
Blockchain / Payment Network
   ↓
Result Processor
   ↓
SMS Handler (Response)
   ↓
SMS Gateway
   ↓
User Phone (Confirmation SMS)