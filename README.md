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

