# Imported modules (v4.0.0 consolidation)

These modules were pulled from Chenzo's other projects because they directly strengthen the
Chronos arbitrage swarm. Each file carries a header noting its source project and original path.
They were imported **verbatim** (only a provenance comment was prepended) and all read secrets /
RPC URLs from environment variables — no keys are embedded.

| Module | From | Why it upgrades Chronos |
|--------|------|-------------------------|
| `onchain/onChainVerification.js` | `Assets-in-control-` (`server/`) | Externally-verifiable tx/address/block checks + block-explorer links — gives the swarm provable on-chain confirmation instead of trusting its own logs. |
| `onchain/blockchain.js` | `Assets-in-control-` (`server/`) | Multi-chain provider/wallet/balance helpers over ethers. |
| `pricing/priceService.js` | `Assets-in-control-` (`server/`) | Price fetching/caching layer — useful for the arb route evaluators. |
| `resilience/validationChain.js` | `Assets-in-control-` (`server/`) | Chained validation of operations before they execute — complements Chronos's policy guard. |
| `resilience/errorRecovery.js` | `Assets-in-control-` (`server/`) | Structured retry/recovery — complements `chronos-error-immunity` / `chronos-regress-sentinel`. |
| `resilience/recoveryMiddleware.js` | `Assets-in-control-` (`server/`) | Express middleware wrapper for the recovery layer. |
| `resilience/rateLimiter.js` | `Assets-in-control-` (`server/`) | Rate limiting for RPC / exchange API calls. |
| `resilience/asyncHandler.js` | `daugherty-INC` (`backend/`) | Promise error-wrapping helper. |
| `resilience/validate.js` | `daugherty-INC` (`backend/`) | Request/payload validation helper. |
| `resilience/errorHandler.ts` | `Vip-Registatiom` (`backend/`) | Centralized TS error handler. |
| `logging/logger.ts` | `Vip-Registatiom` (`backend/`) | Structured logger for the TS scripts. |

**Not imported** (and why): `public-record` is a Python public-records/API-client app for the
real-estate side — nothing in it fits a DeFi execution swarm, so it was left out.
`Hernandez_Advertisment` is a README only. The React frontends and the other projects' routes,
models and controllers are app-specific scaffolding, not reusable Chronos infrastructure.

These are dropped in as a staging area. Wiring them into the live swarm scripts (imports, config)
is a follow-up step — they are not yet referenced by Chronos code.
