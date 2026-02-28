# PIGEON - SMS-Based Payment & Account Management System

## System Architecture Overview

An SMS-driven backend system that processes financial transactions, manages user accounts, and executes blockchain-based payments through intent detection and natural language processing.

```
User Phone
   ↓ (SMS)
SMS Gateway
   ↓
SMS Handler (Receive)
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
SMS Handler (Send)
   ↓
SMS Gateway
   ↓
User Phone (Confirmation SMS)
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

## Data Flow Sequence

### **Scenario 1: User Sends Funds**

```
Step 1: SMS Receive
├─ User sends: "SEND 5000 to 1234567890"
├─ SMS Gateway receives message
└─ SMS Handler parses and authenticates user

Step 2: Intent Detection
├─ Intent Parser analyzes message
├─ Extracts: operation=SEND, amount=5000, recipient=1234567890
└─ Returns Intent Object

Step 3: Command Routing
├─ Router receives intent
├─ Validates sender account exists
├─ Routes to Payment Service
└─ Routes to Wallet/Chain Service

Step 4: Business Logic
├─ Payment Service checks:
│  ├─ Sender balance ≥ 5000
│  ├─ Recipient account exists
│  └─ Transaction limits not exceeded
├─ Wallet Service:
│  ├─ Retrieves current balance from blockchain
│  ├─ Executes transfer transaction
│  ├─ Updates blockchain ledger
│  └─ Returns transaction hash

Step 5: Result Processing
├─ Aggregates transaction result
├─ Generates confirmation message
├─ Stores transaction in database
└─ Prepares SMS response

Step 6: SMS Response
├─ SMS Handler composes: "✓ Sent 5000 to 1234567890. Ref: [TXNID]"
├─ Sends via SMS Gateway
└─ Confirmation delivered to user
```

### **Scenario 2: New Account Creation**

```
Step 1: SMS Receive
├─ User sends: "CREATE ACCOUNT"
├─ SMS Gateway receives
└─ SMS Handler processes

Step 2: Intent Detection
├─ Intent Parser recognizes CREATE_ACCOUNT intent
└─ Extracts user phone number

Step 3: Command Routing
├─ Routes to Account Service
└─ Validation check (phone not already registered)

Step 4: Account Creation
├─ Account Service creates user profile
├─ Generates wallet address
├─ Initializes zero balance wallet
├─ Stores in database
└─ Wallet/Chain Service creates on-chain wallet record

Step 5: Result Processing
├─ Success confirmation prepared
└─ User details compiled for SMS

Step 6: SMS Response
├─ Sends: "✓ Account created! Your ID: [USER_ID]. Balance: 0"
└─ SMS delivered to user
```

### **Scenario 3: Payment Execution**

```
Step 1: SMS Receive
├─ User sends: "PAY 2500 for Bill"
└─ SMS Handler validates

Step 2: Intent Parsing
├─ Recognizes PAY intent
├─ Amount: 2500
└─ Purpose: Bill

Step 3: Route to Payment Service
├─ Validate bill ID exists
├─ Check sender can pay
└─ Lock funds temporarily

Step 4: Chain Execution
├─ Wallet Service executes transaction
├─ Blockchain records payment
├─ Updates bill status to PAID
└─ Returns transaction confirmation

Step 5: Confirmation SMS
├─ Compose: "✓ Payment of 2500 processed. Bill Ref: [ID]"
└─ Send to user
```

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