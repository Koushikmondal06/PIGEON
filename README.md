# PIGEON

flowchart TD
    A[📱 User Phone] -->|SMS| B[📡 SMS Gateway]
    B --> C[🧩 SMS Handler]
    C --> D[🧠 Intent Parser / NLP]
    D --> E[🎯 Command Router (Algo Layer)]
    E --> F1[👤 Account Service]
    E --> F2[💸 Payment Service]
    E --> F3[🔗 Wallet / Chain Service]
    F2 --> G[⛓️ Blockchain / Payment Network]
    G --> H[📊 Result Processor]
    H --> C
    C --> B
    B -->|Confirmation SMS|