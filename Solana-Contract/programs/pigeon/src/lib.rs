use anchor_lang::prelude::*;

declare_id!("4hGz777LQCofhhsaxRrBbFUfyp9s559JR3cmBXgBVhH8");

/// ─────────────────────────────────────────────────────────────────────────────
/// Pigeon — Solana Program
///
/// Mirrors the Algorand `ContractPigeon` smart contract 1-to-1.
///
/// Storage layout:
///   • `PigeonState`  (PDA seed: "pigeon-state")          — singleton global state
///   • `UserAccount`  (PDA seed: "user", phone_bytes)     — one per onboarded user
///
/// Phone numbers (digits-only, max 20 chars) are used directly as PDA seeds.
/// Only the `admin` (set at initialization) may call mutation instructions.
/// ─────────────────────────────────────────────────────────────────────────────
#[program]
pub mod pigeon {
    use super::*;

    // ─── Lifecycle ──────────────────────────────────────────────────────────

    /// Initialize the program state (call once after deploy).
    /// Records the caller as admin — equivalent to `createApplication()`.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.pigeon_state;
        state.admin = ctx.accounts.admin.key();
        state.total_users = 0;
        state.bump = ctx.bumps.pigeon_state;
        msg!("Pigeon initialized. Admin: {}", state.admin);
        Ok(())
    }

    // ─── Mutations (admin-only) ─────────────────────────────────────────────

    /// Register a new user on-chain.
    ///
    /// Mirrors `onboardUser()` from the Algorand contract.
    /// Creates a PDA account seeded by `["user", phone.as_bytes()]`.
    ///
    /// # Arguments
    /// * `phone`              – Normalised phone number (digits only, max 20 chars)
    /// * `address`            – Wallet address generated during onboarding
    /// * `encrypted_mnemonic` – AES-256-GCM encrypted mnemonic (base64)
    /// * `created_at`         – Unix timestamp of onboarding
    pub fn onboard_user(
        ctx: Context<OnboardUser>,
        phone: String,
        address: String,
        encrypted_mnemonic: String,
        created_at: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.pigeon_state;
        require!(
            ctx.accounts.admin.key() == state.admin,
            PigeonError::Unauthorized
        );

        let user = &mut ctx.accounts.user_account;
        user.phone = phone;
        user.address = address;
        user.encrypted_mnemonic = encrypted_mnemonic;
        user.created_at = created_at;
        user.bump = ctx.bumps.user_account;

        state.total_users = state
            .total_users
            .checked_add(1)
            .ok_or(PigeonError::Overflow)?;

        msg!("User onboarded. Total users: {}", state.total_users);
        Ok(())
    }

    /// Update an existing user's data (preserves `created_at`).
    ///
    /// Mirrors `updateUser()` from the Algorand contract.
    pub fn update_user(
        ctx: Context<UpdateUser>,
        _phone: String,
        address: String,
        encrypted_mnemonic: String,
    ) -> Result<()> {
        let state = &ctx.accounts.pigeon_state;
        require!(
            ctx.accounts.admin.key() == state.admin,
            PigeonError::Unauthorized
        );

        let user = &mut ctx.accounts.user_account;
        user.address = address;
        user.encrypted_mnemonic = encrypted_mnemonic;
        // created_at is preserved (not overwritten)

        msg!("User updated: {}", user.phone);
        Ok(())
    }

    /// Remove a user from on-chain storage.
    /// Closes the PDA and decrements the counter.
    ///
    /// Mirrors `deleteUser()` from the Algorand contract.
    pub fn delete_user(ctx: Context<DeleteUser>, _phone: String) -> Result<()> {
        let state = &mut ctx.accounts.pigeon_state;
        require!(
            ctx.accounts.admin.key() == state.admin,
            PigeonError::Unauthorized
        );

        state.total_users = state
            .total_users
            .checked_sub(1)
            .ok_or(PigeonError::Underflow)?;

        msg!(
            "User deleted: {}. Total users: {}",
            ctx.accounts.user_account.phone,
            state.total_users
        );
        // The account is closed automatically via `close = admin` constraint
        Ok(())
    }

    // ─── Read-only queries ──────────────────────────────────────────────────

    /// Retrieve full user record.  Mirrors `getUser()`.
    pub fn get_user(ctx: Context<GetUser>, _phone: String) -> Result<UserData> {
        let user = &ctx.accounts.user_account;
        Ok(UserData {
            phone: user.phone.clone(),
            address: user.address.clone(),
            encrypted_mnemonic: user.encrypted_mnemonic.clone(),
            created_at: user.created_at,
        })
    }

    /// Check whether a phone number has been onboarded.
    /// Mirrors `userExists()`.
    ///
    /// NOTE: On Solana the caller can also simply check if the PDA account
    /// exists client-side, but this instruction is provided for parity.
    pub fn user_exists(ctx: Context<UserExists>, _phone: String) -> Result<bool> {
        // If we get here the account was successfully deserialized → it exists.
        let _ = &ctx.accounts.user_account;
        Ok(true)
    }

    /// Return only the wallet address for a given phone.
    /// Mirrors `getUserAddress()`.
    pub fn get_user_address(
        ctx: Context<GetUser>,
        _phone: String,
    ) -> Result<String> {
        Ok(ctx.accounts.user_account.address.clone())
    }

    /// Return the current total-users counter.
    /// Mirrors `getTotalUsers()`.
    pub fn get_total_users(ctx: Context<GetTotalUsers>) -> Result<u64> {
        Ok(ctx.accounts.pigeon_state.total_users)
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Account Structures
// ═════════════════════════════════════════════════════════════════════════════

/// Global program state (singleton PDA).
#[account]
pub struct PigeonState {
    /// Admin / owner who is allowed to mutate state.
    pub admin: Pubkey,
    /// Total number of onboarded users.
    pub total_users: u64,
    /// PDA bump seed.
    pub bump: u8,
}

impl PigeonState {
    /// 8 (discriminator) + 32 (admin) + 8 (total_users) + 1 (bump)
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

/// Per-user on-chain record.
///
/// Mirrors the Algorand `UserData` struct:
///   - phone              → `phone`              (String, max 20 chars)
///   - address            → `address`            (String, max 64 chars — Solana base58)
///   - encryptedMnemonic  → `encrypted_mnemonic` (String, max 512 chars — base64 blob)
///   - createdAt          → `created_at`         (u64 unix timestamp)
#[account]
pub struct UserAccount {
    /// Normalised phone number (digits only).
    pub phone: String,
    /// Solana wallet address (base58 pubkey).
    pub address: String,
    /// AES-256-GCM encrypted mnemonic (base64 encoded).
    pub encrypted_mnemonic: String,
    /// Unix timestamp of onboarding.
    pub created_at: u64,
    /// PDA bump seed.
    pub bump: u8,
}

impl UserAccount {
    /// Conservative max size:
    /// 8  (discriminator)
    /// 4 + 20  (phone string: length prefix + max 20 chars)
    /// 4 + 64  (address string: length prefix + max 64 chars)
    /// 4 + 512 (encrypted_mnemonic string: length prefix + max 512 chars)
    /// 8       (created_at)
    /// 1       (bump)
    pub const SIZE: usize = 8 + (4 + 20) + (4 + 64) + (4 + 512) + 8 + 1;
}

/// Return type for `get_user` instruction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UserData {
    pub phone: String,
    pub address: String,
    pub encrypted_mnemonic: String,
    pub created_at: u64,
}

// ═════════════════════════════════════════════════════════════════════════════
// Instruction Contexts
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = PigeonState::SIZE,
        seeds = [b"pigeon-state"],
        bump,
    )]
    pub pigeon_state: Account<'info, PigeonState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone: String)]
pub struct OnboardUser<'info> {
    #[account(
        mut,
        seeds = [b"pigeon-state"],
        bump = pigeon_state.bump,
    )]
    pub pigeon_state: Account<'info, PigeonState>,

    #[account(
        init,
        payer = admin,
        space = UserAccount::SIZE,
        seeds = [b"user", phone.as_bytes()],
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone: String)]
pub struct UpdateUser<'info> {
    #[account(
        seeds = [b"pigeon-state"],
        bump = pigeon_state.bump,
    )]
    pub pigeon_state: Account<'info, PigeonState>,

    #[account(
        mut,
        seeds = [b"user", phone.as_bytes()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(phone: String)]
pub struct DeleteUser<'info> {
    #[account(
        mut,
        seeds = [b"pigeon-state"],
        bump = pigeon_state.bump,
    )]
    pub pigeon_state: Account<'info, PigeonState>,

    #[account(
        mut,
        seeds = [b"user", phone.as_bytes()],
        bump = user_account.bump,
        close = admin,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(phone: String)]
pub struct GetUser<'info> {
    #[account(
        seeds = [b"user", phone.as_bytes()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
#[instruction(phone: String)]
pub struct UserExists<'info> {
    #[account(
        seeds = [b"user", phone.as_bytes()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct GetTotalUsers<'info> {
    #[account(
        seeds = [b"pigeon-state"],
        bump = pigeon_state.bump,
    )]
    pub pigeon_state: Account<'info, PigeonState>,
}

// ═════════════════════════════════════════════════════════════════════════════
// Errors
// ═════════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum PigeonError {
    #[msg("Only the admin can perform this action")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
}
