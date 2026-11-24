# Chronos Real-Money & Treasury Policies (Enacted 2026-10-11)

## Policy C1: Zero Mock Recognition
No revenue or profit is recognized without on-chain finality on Solana or EVM or cleared fiat. Test tokens, paper simulations, and unconfirmed mempool items evaluate strictly to $0.00.

## Policy C2: The ATM-Liquid Standard
Profit is recognized strictly as externally verified, unencumbered funds that can be withdrawn as cash. 

## Policy C3: Cold Storage Segregation
Settlement and custody keys must not live on the trading execution device. Profit sweeps must route directly to an offline cold address.

## Policy C4: Statutory Tax Reserving
A planning reserve of 30% is withheld and segregated for IRS Form 1040-ES and CA FTB Form 540-ES estimated quarterly obligations prior to computing net distributable owner cash.

## Policy C5: Fail-Closed Send Guard
Any money-moving call must pass through `src/send-guard.js`. It requires `CHRONOS_LIVE=1`, no kill switch, a passing paper-trade gate (`profit_gate.json`), and fresh payout approval (`payout_approval.json`).
