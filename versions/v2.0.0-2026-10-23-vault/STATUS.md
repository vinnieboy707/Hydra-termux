# Chronos status

Generated 2026-10-10T09:32:04.331Z by `node src/integrity-status.js --md`. Every value below was computed from the code and data on this machine at that moment; regenerate to refresh. Nothing here is a promise.

## Send mode
BLOCKED (kill switch active)

## Ledger (unified_financial_ledger.wal)
- no rows booked


## Yield database rows
0

## Files containing send or payout calls
| file | send calls | guard calls | guarded |
|---|---|---|---|
| src/direct-settlement-gateway.js | 1 | 1 | yes |
| src/master-production-orchestrator.js | 1 | 1 | yes |
| src/solana-service.js | 2 | 1 | **NO** |
| src/trigger-bank-payouts.js | 1 | 1 | yes |
| src/web3-execution-engine.js | 1 | 1 | yes |

A row is only counted verified revenue when it carries a transaction hash that a node confirms succeeded. Run `node ~/chronos_status_24h.js` for the on-chain check.
