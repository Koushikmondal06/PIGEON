use anchor_lang::prelude::*;

declare_id!("3sq9U3smM9R8fHj4LPk5FMZZ9XhsVJWQ7V2kzdgJb8oc");

#[program]
pub mod solana_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
