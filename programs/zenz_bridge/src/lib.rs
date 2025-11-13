use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod zenz_bridge {
    use super::*;

    /// Initialize a new bridge account
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        bridge.authority = authority;
        bridge.total_transactions = 0;
        bridge.is_active = true;
        msg!("Bridge initialized with authority: {}", authority);
        Ok(())
    }

    /// Process a bridge transaction
    pub fn bridge_transfer(
        ctx: Context<BridgeTransfer>,
        amount: u64,
        destination: String,
    ) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(bridge.is_active, ErrorCode::BridgeInactive);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(destination.len() > 0, ErrorCode::InvalidDestination);

        bridge.total_transactions += 1;
        
        msg!(
            "Bridge transfer initiated: amount={}, destination={}, tx_count={}",
            amount,
            destination,
            bridge.total_transactions
        );

        Ok(())
    }

    /// Update bridge status
    pub fn update_status(ctx: Context<UpdateStatus>, is_active: bool) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge;
        
        require!(
            ctx.accounts.authority.key() == bridge.authority,
            ErrorCode::Unauthorized
        );

        bridge.is_active = is_active;
        msg!("Bridge status updated to: {}", is_active);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Bridge::INIT_SPACE
    )]
    pub bridge: Account<'info, Bridge>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BridgeTransfer<'info> {
    #[account(mut)]
    pub bridge: Account<'info, Bridge>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    #[account(mut)]
    pub bridge: Account<'info, Bridge>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Bridge {
    pub authority: Pubkey,
    pub total_transactions: u64,
    pub is_active: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is currently inactive")]
    BridgeInactive,
    #[msg("Invalid transfer amount")]
    InvalidAmount,
    #[msg("Invalid destination address")]
    InvalidDestination,
    #[msg("Unauthorized access")]
    Unauthorized,
}
