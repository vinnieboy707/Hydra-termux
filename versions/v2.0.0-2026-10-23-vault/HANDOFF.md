# Chronos handoff for the next assistant (written 2026-10-11 by Claude)

Read the rules first. They exist because earlier work in this project produced fake revenue, false labels and unguarded money-moving code. Do not undo the protections below.

## Rules for any assistant working here
1. Never fabricate. No mock, dummy, placeholder or simulated data in anything that feeds the ledger, dashboards, logs or reports. Never say "verified", "production", "profitable" or "ready" unless a check you ran says so. `node ~/chronos-infrastructure-core/chronos_readiness.js` computes readiness.
2. Do not remove or weaken `src/send-guard.js`, the `KILL_SWITCH` file, `src/evidence-verifier.js` or `src/solana-verifier.js`. Do not set `CHRONOS_LIVE=1`. All money-moving calls must pass through the guard.
3. Never ask the user for private keys, seed phrases or secrets, and never print them. Settlement and cold-wallet keys must not live on this phone.
4. Read a file before changing it. Back it up, apply all-or-nothing patches, syntax check, run, and show the output. Do not rewrite unseen code with regex.
5. The user works on a phone in Termux. Give one command at a time. For long scripts use a heredoc with a sha256 check, as the existing scripts do.
6. Tax: this is not tax advice. Say so, and send tax questions to a CPA or enrolled agent.
7. Be honest about what was verified and what was not.

## What this is
A Termux and PM2 Node stack in `~/chronos-infrastructure-core`. The owner is a developer who wants verified real revenue and profit, with US tax compliance.

## State as last observed (re-verify before relying on it)
- Verified real revenue: $0.00. Every ledger row seen earlier was fabricated (price-bug rows, test-script rows, or rows labelled settled with no transaction). The original ledger is archived at `~/chronos-quarantine/20261008-211403/`.
- No real trade execution exists. The engine only logs signals. Measured pool gaps were about 10 bps against about 10 bps of fees, so net was roughly zero.
- The second "Sushi" pool is a Uniswap WETH/USDT pool. All observed block numbers were Ethereum mainnet, not Arbitrum.
- Solana runs on a throwaway key (no real key in `.env`). The key-reading bug in `src/solana-service.js` was fixed. A Solana address was supplied by the owner but is wired to nothing until `CHRONOS_SOL_SETTLEMENT_WALLETS` is set.
- `COLD_VAULT_ADDRESS` in `.env` is an EVM address. The cold-vault sweeper records sweeps without transferring anything. Keep it stopped.
- Stripe: a live secret key is in `.env` and payout code exists in three files (all guarded). A Stripe key was once committed to git history; roll it and use a restricted key without payout permission.
- `package.json` gained `"type": "module"`, which breaks every CommonJS file. Another assistant or tool may have done this. Check `git diff package.json` before changing it again.
- `vault_store.db` and `arbitrage_engine/vault_store.db` hold settlement and scan tables written by code nobody has reviewed. Treat their numbers as unverified.
- `src/artillery-wing-executor.js` appends to the ledger directly with a fixed status. It bypasses the hash chain. `src/real-web3-executor.js` has not been reviewed.

## Scripts in the home directory, in the order they were built
- `chronos_fix_all.sh`: backs up, restores the engine from git HEAD if its syntax is broken, stops the sweeper if the yield table has rows, writes a redacted report.
- `chronos_apply_fix.sh`: removed the orphan `db` block, fixed the Solana key read, added `src/send-guard.js` and guarded the known send call sites.
- `chronos_integrity.sh`: wrote INTEGRITY_POLICY.md, a pre-commit hook and a read-only audit.
- `chronos_status_24h.js`: classifies the last 24 hours of ledger rows by on-chain evidence.
- `ledger_rotate.sh`: archives the ledger read-only and starts a clean chain (it refuses an empty ledger).
- `configure_wallets.sh`: set `COLD_VAULT_ADDRESS`.
- `chronos_make_labels_real.sh`: replaced hard-coded claims with a computed startup status, added `test_integrity_claims.js`, STATUS.md.
- `chronos_revenue_controls.sh`: evidence verifier, revenue-engine patch (own-wallet stablecoin settlements only), `chronos_reconcile.js`, REVENUE_POLICIES.md.
- `chronos_paper_trader.sh`: paper trader using the Uniswap V3 quoter (Ethereum only), `chronos_paper_report.js`.
- `chronos_money_controls.sh`: Solana verifier, guard that needs a paper-trade gate (trades) or payout approval (payouts), `chronos_tax_export.js`, `chronos_payout_check.js`, `chronos_readiness.js`, MONEY_POLICIES.md.
- `chronos_finish.sh`: module-system fix and this file.
Claude only saw outputs for some of these. Run `ls ~/chronos_*.sh ~/chronos-infrastructure-core/src` to see which exist, and do not assume any one has been applied.

## Policy documents
INTEGRITY_POLICY.md, REVENUE_POLICIES.md and MONEY_POLICIES.md state which policies are ENFORCED by code, CHECKED by a script, or only a PROCEDURE. Each ends with known gaps.

## Open work, in priority order
1. Confirm `package.json` and run `node chronos_readiness.js`. Fix whatever it marks FAIL.
2. Review whatever writes `vault_store.db`, plus `src/artillery-wing-executor.js` and `src/real-web3-executor.js`.
3. Let the paper trader run 14 days, then `node chronos_paper_report.js`. Do not risk capital before the gate passes.
4. Record withdrawals in the ledger and keep per-swap disposition records (Form 8949). Neither is automated.
5. Build a Solana paper trader before any Solana trading.
6. Roll the Stripe key. Correct the README from facts.

## Constants Claude set from memory, checked at run time
The Solana mainnet genesis hash, the USDC mint, the Uniswap V3 quoter and stable-pool addresses, and the mainnet stablecoin addresses. The scripts verify them against the chain and refuse to run on a mismatch. If one refuses on the right network, check the constant, not the chain.

## Do not
Run `test_*` or `verify_*` scripts against the live ledger. Run `pm2 start ecosystem.config.js` or `pm2 resurrect` without reading it (it defines the master orchestrator, which has payout code). Run `src/trigger-bank-payouts.js`, `src/master-production-orchestrator.js` or `launch_money_swarm.js`.
