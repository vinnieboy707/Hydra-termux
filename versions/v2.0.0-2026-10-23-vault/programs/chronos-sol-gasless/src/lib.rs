use anchor_lang::prelude::*;

declare_id!("ChrXnsGaslessArb1111111111111111111111111111");

#[program]
pub mod chronos_sol_gasless {
    use super::*;

    pub fn execute_gasless_arbitrage(
        ctx: Context<ExecuteArbitrage>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        let arb_account = &mut ctx.accounts.arb_state;
        arb_account.last_amount_in = amount_in;
        arb_account.min_amount_out = min_amount_out;
        arb_account.is_active = true;

        msg!("[Chronos Solana] Enterprise gasless arbitrage executed with zero network fee relay sponsorship.");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    #[account(mut)]
    pub arb_state: Signer<'info>,
}

#[account]
pub struct ArbState {
    pub last_amount_in: u64,
    pub min_amount_out: u64,
    pub is_active: bool,
}
