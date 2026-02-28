/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pigeon.json`.
 */
export type Pigeon = {
  "address": "4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8",
  "metadata": {
    "name": "pigeon",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Pigeon SMS Wallet - Solana Program (mirrors Algorand ContractPigeon)"
  },
  "docs": [
    "─────────────────────────────────────────────────────────────────────────────",
    "Pigeon — Solana Program",
    "",
    "Mirrors the Algorand `ContractPigeon` smart contract 1-to-1.",
    "",
    "Storage layout:",
    "• `PigeonState`  (PDA seed: \"pigeon-state\")          — singleton global state",
    "• `UserAccount`  (PDA seed: \"user\", phone_bytes)     — one per onboarded user",
    "",
    "Phone numbers (digits-only, max 20 chars) are used directly as PDA seeds.",
    "Only the `admin` (set at initialization) may call mutation instructions.",
    "─────────────────────────────────────────────────────────────────────────────"
  ],
  "instructions": [
    {
      "name": "deleteUser",
      "docs": [
        "Remove a user from on-chain storage.",
        "Closes the PDA and decrements the counter.",
        "",
        "Mirrors `deleteUser()` from the Algorand contract."
      ],
      "discriminator": [
        186,
        85,
        17,
        249,
        219,
        231,
        98,
        251
      ],
      "accounts": [
        {
          "name": "pigeonState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  105,
                  103,
                  101,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        }
      ]
    },
    {
      "name": "getTotalUsers",
      "docs": [
        "Return the current total-users counter.",
        "Mirrors `getTotalUsers()`."
      ],
      "discriminator": [
        175,
        215,
        135,
        105,
        139,
        252,
        155,
        243
      ],
      "accounts": [
        {
          "name": "pigeonState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  105,
                  103,
                  101,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "getUser",
      "docs": [
        "Retrieve full user record.  Mirrors `getUser()`."
      ],
      "discriminator": [
        243,
        117,
        71,
        238,
        196,
        232,
        11,
        158
      ],
      "accounts": [
        {
          "name": "userAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        }
      ],
      "returns": {
        "defined": {
          "name": "userData"
        }
      }
    },
    {
      "name": "getUserAddress",
      "docs": [
        "Return only the wallet address for a given phone.",
        "Mirrors `getUserAddress()`."
      ],
      "discriminator": [
        247,
        156,
        28,
        101,
        91,
        202,
        194,
        98
      ],
      "accounts": [
        {
          "name": "userAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        }
      ],
      "returns": "string"
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the program state (call once after deploy).",
        "Records the caller as admin — equivalent to `createApplication()`."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "pigeonState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  105,
                  103,
                  101,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "onboardUser",
      "docs": [
        "Register a new user on-chain.",
        "",
        "Mirrors `onboardUser()` from the Algorand contract.",
        "Creates a PDA account seeded by `[\"user\", phone.as_bytes()]`.",
        "",
        "# Arguments",
        "* `phone`              – Normalised phone number (digits only, max 20 chars)",
        "* `address`            – Wallet address generated during onboarding",
        "* `encrypted_mnemonic` – AES-256-GCM encrypted mnemonic (base64)",
        "* `created_at`         – Unix timestamp of onboarding"
      ],
      "discriminator": [
        70,
        130,
        221,
        2,
        58,
        242,
        177,
        212
      ],
      "accounts": [
        {
          "name": "pigeonState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  105,
                  103,
                  101,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        },
        {
          "name": "address",
          "type": "string"
        },
        {
          "name": "encryptedMnemonic",
          "type": "string"
        },
        {
          "name": "createdAt",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateUser",
      "docs": [
        "Update an existing user's data (preserves `created_at`).",
        "",
        "Mirrors `updateUser()` from the Algorand contract."
      ],
      "discriminator": [
        9,
        2,
        160,
        169,
        118,
        12,
        207,
        84
      ],
      "accounts": [
        {
          "name": "pigeonState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  105,
                  103,
                  101,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        },
        {
          "name": "address",
          "type": "string"
        },
        {
          "name": "encryptedMnemonic",
          "type": "string"
        }
      ]
    },
    {
      "name": "userExists",
      "docs": [
        "Check whether a phone number has been onboarded.",
        "Mirrors `userExists()`.",
        "",
        "NOTE: On Solana the caller can also simply check if the PDA account",
        "exists client-side, but this instruction is provided for parity."
      ],
      "discriminator": [
        36,
        113,
        7,
        153,
        61,
        18,
        224,
        46
      ],
      "accounts": [
        {
          "name": "userAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "phone"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "phone",
          "type": "string"
        }
      ],
      "returns": "bool"
    }
  ],
  "accounts": [
    {
      "name": "pigeonState",
      "discriminator": [
        90,
        172,
        229,
        41,
        92,
        156,
        115,
        79
      ]
    },
    {
      "name": "userAccount",
      "discriminator": [
        211,
        33,
        136,
        16,
        186,
        110,
        242,
        127
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the admin can perform this action"
    },
    {
      "code": 6001,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6002,
      "name": "underflow",
      "msg": "Arithmetic underflow"
    }
  ],
  "types": [
    {
      "name": "pigeonState",
      "docs": [
        "Global program state (singleton PDA)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Admin / owner who is allowed to mutate state."
            ],
            "type": "pubkey"
          },
          {
            "name": "totalUsers",
            "docs": [
              "Total number of onboarded users."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "docs": [
        "Per-user on-chain record.",
        "",
        "Mirrors the Algorand `UserData` struct:",
        "- phone              → `phone`              (String, max 20 chars)",
        "- address            → `address`            (String, max 64 chars — Solana base58)",
        "- encryptedMnemonic  → `encrypted_mnemonic` (String, max 512 chars — base64 blob)",
        "- createdAt          → `created_at`         (u64 unix timestamp)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "phone",
            "docs": [
              "Normalised phone number (digits only)."
            ],
            "type": "string"
          },
          {
            "name": "address",
            "docs": [
              "Solana wallet address (base58 pubkey)."
            ],
            "type": "string"
          },
          {
            "name": "encryptedMnemonic",
            "docs": [
              "AES-256-GCM encrypted mnemonic (base64 encoded)."
            ],
            "type": "string"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of onboarding."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userData",
      "docs": [
        "Return type for `get_user` instruction."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "phone",
            "type": "string"
          },
          {
            "name": "address",
            "type": "string"
          },
          {
            "name": "encryptedMnemonic",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
