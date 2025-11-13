use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod zenz_bridge {
    use super::*;

    /// Initialize the bridge config with zenZEC mint and authority
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        max_mint_per_tx: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.max_mint_per_tx = max_mint_per_tx;
        config.paused = false;
        config.total_minted = 0;
        config.total_burned = 0;

        msg!("Bridge config initialized");
        msg!("Authority: {}", config.authority);
        msg!("Mint: {}", config.mint);
        msg!("Max mint per tx: {}", max_mint_per_tx);

        Ok(())
    }

    /// Mint zenZEC tokens to a user's token account
    /// Called by backend relayer when ZEC is shielded
    pub fn mint_zenzec(ctx: Context<MintZenZEC>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(!config.paused, ErrorCode::BridgePaused);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(amount <= config.max_mint_per_tx, ErrorCode::AmountExceedsMax);

        // Mint tokens to user's token account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, amount)?;

        config.total_minted += amount;

        msg!("Minted {} zenZEC to {}", amount, ctx.accounts.user_token_account.key());

        Ok(())
    }

    /// Burn zenZEC tokens from user's token account
    pub fn burn_zenzec(ctx: Context<BurnZenZEC>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(amount > 0, ErrorCode::InvalidAmount);

        // Burn tokens from user's token account
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        config.total_burned += amount;

        msg!("Burned {} zenZEC from {}", amount, ctx.accounts.user.key());

        Ok(())
    }

    /// Burn zenZEC and emit an event for the relayer to swap to SOL
    pub fn burn_and_emit(ctx: Context<BurnAndEmit>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(amount > 0, ErrorCode::InvalidAmount);

        // Burn tokens from user's token account
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        config.total_burned += amount;

        // Emit event for off-chain relayer
        emit!(BurnSwapEvent {
            user: ctx.accounts.user.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Burned {} zenZEC and emitted swap event for {}", amount, ctx.accounts.user.key());

        Ok(())
    }

    /// Update bridge pause status (admin only)
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = paused;

        msg!("Bridge paused status set to: {}", paused);

        Ok(())
    }

    /// Update max mint per transaction (admin only)
    pub fn set_max_mint(ctx: Context<SetMaxMint>, max_mint_per_tx: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.max_mint_per_tx = max_mint_per_tx;

        msg!("Max mint per tx updated to: {}", max_mint_per_tx);

        Ok(())
    }
}

// Account Contexts

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintZenZEC<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnZenZEC<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnAndEmit<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMaxMint<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

// State Accounts

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub max_mint_per_tx: u64,
    pub paused: bool,
    pub total_minted: u64,
    pub total_burned: u64,
}

// Events

#[event]
pub struct BurnSwapEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is currently paused")]
    BridgePaused,
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Amount exceeds maximum mint per transaction")]
    AmountExceedsMax,
}
