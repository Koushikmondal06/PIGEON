# PIGEON - SMS-Based Payment & Account Management System

## System Architecture Overview

An SMS-driven backend system that processes financial transactions, manages user accounts, and executes blockchain-based payments through intent detection and natural language processing.

```text
┌────────────────────────────────────────────────────────┐
│                      User Phone                        │
└──────────────────────────┬─────────────────────────────┘
                           │ (SMS)
┌──────────────────────────▼─────────────────────────────┐
│                      SMS Gateway                       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 SMS Handler (Receive)                  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                  Intent Parser / NLP                   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│              Command Router (Algo Layer)               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                   Business Services                    │
│                                                        │
│ ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ │
│ │Account Service│ │Payment Service│ │ Wallet/Chain   │ │
│ └───────────────┘ └───────────────┘ └────────────────┘ │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│              Blockchain / Payment Network              │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                    Result Processor                    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                  SMS Handler (Send)                    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                      SMS Gateway                       │
└──────────────────────────┬─────────────────────────────┘
                           │ (Confirmation SMS)
┌──────────────────────────▼─────────────────────────────┐
│                      User Phone                        │
└────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. **SMS Gateway** (External Service)
- Receives inbound SMS messages from users
- Sends outbound SMS responses back to users
- Manages message queuing and delivery status
- Integrates with telecom providers
- **Responsibility**: Message transport layer

### 2. **SMS Handler - Receive Module** (Backend Entry Point)
- **Location**: Backend API Service
- **Function**: 
  - Validates incoming SMS messages
  - Extracts sender phone number and message content
  - Checks message format and length constraints
  - Authenticates user against database
  - Logs all incoming requests
  - Formats message for downstream processing
- **Output**: Standardized message object passed to Intent Parser

### 3. **Intent Parser / NLP Engine** (Algo Layer)
- **Function**:
  - Analyzes message content to determine user intent
  - Recognizes operation types: `SEND`, `RECEIVE`, `CREATE_ACCOUNT`, `CHECK_BALANCE`, `PAYMENT`
  - Extracts entities: recipient phone, amount, account details
  - Validates syntax and parameters
  - Returns structured intent object
- **Intent Types**:
  - `CREATE_ACCOUNT`: New user account registration
  - `SEND_FUNDS`: Transfer money to recipient
  - `RECEIVE_FUNDS`: Accept incoming transfers
  - `PAY_BILL`: Execute payment transactions
  - `CHECK_BALANCE`: Query wallet balance
- **Output**: Intent object with operation type and extracted parameters

### 4. **Command Router** (Orchestration & Algorithm Layer)
- **Function**:
  - Routes intents to appropriate business services
  - Enforces business logic and validation rules
  - Manages transaction workflow orchestration
  - Handles error scenarios and fallbacks
  - Rate limiting and fraud detection
  - Transaction state management
- **Routing Logic**:
  ```
  if intent == CREATE_ACCOUNT
    → Account Service (Create new user)
  
  if intent == SEND_FUNDS || PAY_BILL
    → Payment Service (Initiate transaction)
    → Wallet/Chain Service (Execute on blockchain)
  
  if intent == RECEIVE_FUNDS
    → Payment Service (Accept transfer)
    → Wallet/Chain Service (Update wallet)
  
  if intent == CHECK_BALANCE
    → Wallet/Chain Service (Query balance)
  ```

---

## Business Services Layer

### **Account Service**
- **Operations**:
  - User registration and account creation
  - KYC (Know Your Customer) verification
  - Profile management
  - Account status tracking
- **Workflow for CREATE_ACCOUNT intent**:
  1. Validate new user phone number (not already registered)
  2. Create user record in database
  3. Generate unique wallet address
  4. Initialize account with zero balance
  5. Return account creation confirmation
  6. Pass to SMS Handler for confirmation SMS

### **Payment Service**
- **Operations**:
  - Validate transaction feasibility
  - Check sender balance and limits
  - Verify recipient exists
  - Initiate payment transactions
  - Track transaction status
  - Handle transaction rollbacks
- **Pre-Payment Validation**:
  - Account exists and is active
  - Sender has sufficient balance
  - Daily/weekly transaction limits not exceeded
  - Recipient account is active
  - Amount is within acceptable range

### **Wallet/Chain Service**
- **Operations**:
  - Interface with blockchain/payment network
  - Execute smart contract transactions
  - Query wallet balances
  - Manage cryptographic operations
  - Handle security and fund custody
- **Blockchain Interactions**:
  - Store transaction records on-chain
  - Execute payment transfers
  - Maintain transaction immutability
  - Enable transparent audit trail


---

## Database Schema (Logical)

```
Users Table
├─ user_id (PK)
├─ phone_number (UNIQUE)
├─ wallet_address
├─ account_status (ACTIVE/INACTIVE)
├─ created_at
└─ kyc_verified

Transactions Table
├─ transaction_id (PK)
├─ sender_id (FK)
├─ recipient_id (FK)
├─ amount
├─ type (SEND/RECEIVE/PAY)
├─ status (PENDING/SUCCESS/FAILED)
├─ blockchain_hash
├─ created_at
└─ completed_at

Wallets Table
├─ wallet_id (PK)
├─ user_id (FK)
├─ balance
├─ blockchain_address
├─ currency
└─ last_updated
```

---

## Error Handling & SMS Responses

| Scenario | Response SMS |
|----------|--------------|
| **Insufficient Balance** | "❌ Failed: Insufficient balance. Current: 1000" |
| **Invalid Account** | "❌ Failed: Recipient account not found" |
| **Limit Exceeded** | "❌ Daily limit exceeded. Limit: 50000, Used: 45000" |
| **Format Error** | "❌ Invalid format. Try: SEND 1000 to [phone]" |
| **Success** | "✓ Transaction successful. Ref: [TXN_ID]. Balance: [NEW_BALANCE]" |
| **Account Created** | "✓ Account created! ID: [USER_ID]. Start sending money now." |

---

## Security Measures

- **Message encryption** in transit via SMS Gateway
- **Rate limiting** to prevent spam and abuse
- **Two-factor authentication** for sensitive operations
- **Blockchain immutability** for transaction audit trail
- **Fund custody** via smart contracts
- **Phone number validation** and verification
- **Transaction limits** based on account tier
- **KYC compliance** for regulatory requirements

---

## Technology Stack (Recommended)

| Layer | Technology |
|-------|-----------|
| **SMS Gateway** | Twilio / AWS SNS / Local Provider API |
| **Backend** | Node.js/Express, Python/Django, or Java/Spring |
| **Intent Parser** | NLP.js, Rasa, or OpenAI API |
| **Database** | PostgreSQL / MongoDB |
| **Blockchain** | Ethereum, Polygon, Stellar, or custom chain |
| **Caching** | Redis (for balance queries) |
| **Queue** | RabbitMQ / Kafka (async transaction processing) |
| **Logging** | ELK Stack / CloudWatch |