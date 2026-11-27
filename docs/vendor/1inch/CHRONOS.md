# 1inch APIs for Chronos (flash-loan arbitrage, Arbitrum One 42161)

Legend:
- **[FACT]**: stated in the docs. Section numbers and URLs point to `FACTS.md`.
- **[ASSESS]**: my engineering judgement. It is not in the docs.

## The numbers that limit everything
| Item | Value |
|---|---|
| Plan RPS ([FACT] §4) | Free 60/min (other official pages say 1 RPS). Startup 10/s. Pro 20/s. Business 40/s. Shared across all keys on the account |
| Monthly REST calls ([FACT] §4) | 100k / 1M / 3M / 7M |
| Monthly Web3 RPC calls ([FACT] §4, §13) | **25k / 50k / 100k / 250k** |
| Over the limit ([FACT] §4) | 429. Per-second limiter sends `X-RateLimit-Retry-After`. Quota exhaustion sends 429 with `X-SubscriptionLimit-*` headers |
| Swap infrastructure fee ([FACT] §4) | Dev 10/30 bps, Startup 7/20, Pro 4/10, Business 2/5 (stable/non-stable), deducted from dstAmount. Waived for x402 Swap calls "during the launch" |
| Latency per call ([FACT] §17) | **Not stated** anywhere |

[ASSESS] Arbitrum produces a block about every 250 ms. That is about 345,600 blocks a month. At 40 RPS (Business) the plan can make at most about 10 REST calls per block. The 7M monthly quota runs out at an average of 2.7 RPS, or 0.7 calls per block, sustained. Even the top self-service plan therefore cannot quote every block for more than a handful of pairs. A REST round trip through a public gateway also has unknown latency and cannot be assumed faster than 1 block. **1inch REST is not viable as a per-block pricing or execution path at arbitrage speed. It is viable as a slow-loop helper** (discovery, periodic cross-checks, fallback leg).

## (1) Discovering venues, pools and tokens we lack
- [FACT] `GET /swap/v6.1/42161/liquidity-sources` returns `{protocols: [{id, title, img, img_color}]}`, the routable liquidity sources on Arbitrum (§6). The docs do **not** print the Arbitrum list. It must be fetched live with the key. Example v6.1 ids seen in the docs: `UNISWAP_V4, UNISWAP_V3, UNISWAP_V2, CURVE_V2_TRICRYPTO_NG, FLUID_DEX_T1, SUSHI` (§6, MIG61).
- [FACT] `includeProtocols=true` on /quote returns the route as `protocols[{token, hops[{dst, protocols[{name, part}]}]}]`. That reveals which sources and connector tokens Pathfinder used for a pair (§6).
- [FACT] Token discovery:
  - `/token/v1.7/42161` (whitelist)
  - `/token/v1.7/42161/pairs?query=` (cursor-paged pairs)
  - `/swap/v6.1/42161/tokens`
  - TokenInfo includes `isFoT` and `eip2612` (§6, §9).
- [ASSESS] Best use:
  - Run a daily or hourly job that diffs the liquidity-sources ids against Chronos's venue registry, so new protocol families get flagged.
  - Sample /quote with `includeProtocols=true` on the top pairs to see which venues 1inch actually routes through.
  - Use `isFoT=true` as a blacklist feed. Fee-on-transfer tokens break flash-loan accounting.
- [ASSESS] Limits of this approach:
  - Ids are protocol families, not pool addresses. The response gives no pool or contract addresses, so Chronos still has to resolve factories and pools itself (on-chain or via its own indexer).
  - Cost is a few hundred calls a day, which fits even the Free plan.

## (2) Pricing and route cross-checks
- [FACT] `/quote` is unsimulated. `/swap` with `disableEstimate=false` simulates and returns the "executable amount for that moment" (§6).
- [FACT] `dstAmount` is net of the 1inch fee (`feeAmount` / `feePercent` in the response).
- [FACT] `gasPrice` defaults to "fast network gas price".
- [FACT] Route tuning parameters: `protocols`, `excludedProtocols`, `excludePMMs`, `complexityLevel` (0 to 2), `parts` (0 to 50), `mainRouteParts` (0 to 10), `connectorTokens`, `gasLimit`.
- [FACT] Spot Price `POST /price/v1.1/42161` takes up to 200 tokens per call and returns prices in wei of native (§7).
- [ASSESS] How to use it as a cross-check:
  - Use 1inch `/quote` as an **oracle of "best aggregated price"** to sanity-check Chronos's own route math, offline or every N seconds.
  - If the engine's route beats 1inch by more than the expected margin, suspect a stale reserve or a bad decimals model.
  - When comparing, add the fee back using `feeAmount`. Otherwise the 1inch price looks worse than the raw market by 10 to 30 bps on lower plans.
  - Spot Price is a coarse USD/native valuation feed (for P&L and min-profit thresholds). It is not a tradable quote.
- [ASSESS] Viability:
  - Cross-checking roughly 1 pair per second fits Startup and above. RPS 10 is fine, and quota 1M/month ≈ 0.39 RPS sustained, so continuous use needs Pro/Business or top-ups.
  - It is not viable per block.

## (3) Using 1inch router calldata as a trade leg
Facts:
- [FACT] `/swap` returns `tx {from, to, data, value, gas, gasPrice}`. `to` is the 1inch router.
- [FACT] `from` = "The address that calls the 1inch contract". So it can be a contract, e.g. the Chronos executor.
- [FACT] `origin` = "An EOA address that initiate the transaction". It is **required**.
- [FACT] `receiver` defaults to `from` (§6).
- [FACT] `usePatching`: "Enable this flag if you patch input amount on your smart contract". This is the documented hook for contracts that overwrite the amount in the calldata at execution time (§6).
- [FACT] `disableEstimate=true` skips the on-chain simulation. Without it, /swap checks balance and allowance of `from` and fails with `NOT_ENOUGH_BALANCE` / `NOT_ENOUGH_ALLOWANCE`. A flash-loan executor holds no balance before the loan, so simulation would fail (§6, SWAPINTRO).
- [FACT] `forceApprove` skips the approval check during simulation.
- [FACT] `deadline` (query) is a "Unix timestamp (seconds) until which the served calldata must stay executable". The response also carries a `deadline` field (§6).
- [FACT] `stateOverrides` is non-empty for "propAMM routes" whose maker state is off-chain. It must be passed to `eth_call` / `eth_estimateGas` to reproduce the quote (§6).
- [FACT] Router address:
  - The docs show `0x111111125421ca6dc452d289314280a0f8842a65` as `AGGREGATION_ROUTER_V6` (Base example). The same address appears as the EIP-712 `verifyingContract` ("1inch Aggregation Router" v6).
  - The **Arbitrum router address is not stated explicitly**. Confirm it with `GET /swap/v6.1/42161/approve/spender` and on-chain before use.
- [FACT] Approvals:
  - The router must have an allowance on the source token (`/approve/allowance`, `/approve/transaction`. Infinite if `amount` is omitted).
  - Permit2 (`usePermit2`) and EIP-2612 `permit` are supported (§6).
- [FACT] Classic Swap has **no MEV protection** (feature matrix §6).

Assessment:
- [ASSESS] **Executable from a contract: yes, in principle.** The executor contract would:
  1. Receive the flash loan.
  2. `approve(router, amt)`. Or it could hold a standing approval, which avoids extra gas but is a standing risk if the router is ever compromised. Prefer an exact-amount approve inside the tx.
  3. `call(tx.to, tx.data)` with `from` = executor, `origin` = the bot EOA, `receiver` = executor.
  4. Check the output against `minReturn` / its own profit floor.
  5. Repay.
- [ASSESS] The calldata is route-specific and built off-chain against a past state. The latency from "API built route" to "tx included" is the main problem:
  - The REST round trip is unknown.
  - Arbitrum blocks are about 250 ms.
  - The route may be stale by inclusion time. Use `minReturn` or `slippage` as the on-chain guard and let the tx revert rather than lose money.
  - Set a tight `deadline`.
- [ASSESS] The fee drag is decisive:
  - 10 to 30 bps (Dev) or 2 to 5 bps (Business) taken from dstAmount on every swap leg. Typical Arbitrum arb margins are a few bps, so this alone makes 1inch-routed legs unprofitable for most opportunities except on Business plans or x402 while the fee is waived.
  - Verify whether the waiver still applies at use time.
- [ASSESS] Conclusion: use as an **occasional fallback or one leg for large, long-lived dislocations** (e.g. a CEX-DEX spread lasting several blocks, or a long-tail token Chronos has no adapter for). Not as the default execution path.
- [ASSESS] Before mainnet, test with a fork plus `stateOverrides`.
- [ASSESS] Never enable `forceApprove` / `disableEstimate` in production without your own `eth_call` simulation on the Chronos RPC.

## (4) Broadcasting
- [FACT] Tx Gateway on Arbitrum: `POST /tx-gateway/v1.1/42161/broadcast {rawTransaction}` returns `{transactionHash}`. This is **public** broadcast.
- [FACT] Private `/flashbots` is "Enabled on Ethereum, BNB and Base" only (§12).
- [FACT] No latency or SLA is given.
- [ASSESS] On Arbitrum there is no public mempool in the L1 sense. Transactions go to the sequencer in first-come-first-served order (general Arbitrum knowledge, not from 1inch docs). So "private broadcast" brings little MEV benefit there anyway.
- [ASSESS] The gateway adds an extra HTTP hop before the sequencer, which hurts in a latency race. It also consumes REST quota.
- [ASSESS] Verdict: **not useful for Chronos's arb submissions.** Send directly to the Arbitrum sequencer or a low-latency RPC. Possible use: a redundant secondary broadcast path.

## (5) RPC capacity (Web3 RPC as an Arbitrum node)
- [FACT] It is a real Arbitrum endpoint:
  - `https://api.1inch.com/web3/42161` and `wss://.../web3/42161`.
  - Full and archive nodes, JSON-RPC and WebSocket subscriptions (`eth_subscribe newHeads`).
  - 63 methods, including `eth_call`, `eth_estimateGas`, `eth_simulateV1`, `eth_createAccessList`, `eth_getLogs`, `eth_sendRawTransaction`, `debug_traceCall` and `debug_traceTransaction` (§13).
- [FACT] It is included in all plans. The monthly caps are tiny: **25k (Free) / 50k / 100k / 250k (Business)** Web3 calls (§4).
- [FACT] RPS is governed by the account plan limit. WebSocket connections are capped at 3 / 10 / 20 / 40.
- [ASSESS] 250k calls a month ≈ 0.1 call/s sustained, under 1 call per 1,000 Arbitrum blocks. Chronos's state reads (reserves, slot0, multicalls per block) would burn the Free quota in minutes and Business in hours.
- [ASSESS] **Not viable as a primary or secondary hot-path RPC.**
- [ASSESS] Useful only for:
  - Occasional archive or `debug_traceTransaction` lookups (post-mortems of failed arbs, competitor tx analysis).
  - A cold backup endpoint.
  - The Traces API (`/traces/v1.0/chain/42161/block-trace/...`) for structured post-trade traces, at REST quota cost.
- [ASSESS] Whether a WebSocket `newHeads` subscription counts one call per notification or per subscription is **not stated**. Measure it with the `X-SubscriptionLimit-Remaining` header before relying on it.

## (6) Other APIs: quick verdicts [ASSESS]
| API | Verdict |
|---|---|
| Gas Price (`/gas-price/v1.6/42161`) | Usable as a slow sanity feed. Chronos should read `eth_gasPrice` / `baseFee` from its own node per block |
| Orderbook | Limit orders "act as a source of liquidity for the 1inch Aggregation Protocol" [FACT]. `GET /orderbook/v4.1/42161/all?statuses=1` lists fillable orders [FACT]. Filling them via `fillOrder` could be an arb source, but the docs route filling through resolver onboarding (KYC/KYB, Access NFT) [FACT §10, §11]. Investigate separately before relying on it |
| Fusion / Fusion+ | Chronos would act as a **resolver** (filler), not a user. That needs KYC/KYB, compliance and Access NFTs [FACT]. Fusion+ escrow locks on Arbitrum are 10 to 36 s [FACT], too slow for atomic flash-loan arb. Fusion resolving is a separate business line, not a fit for the current engine |
| Balance / History / Portfolio / Charts / NFT / Token Details / Domains | Not relevant to the arb hot path. Domains does not support Arbitrum [FACT] |

## Recommended usage plan [ASSESS]
1. **Free/Dev key now:**
   - Daily `liquidity-sources` diff.
   - `includeProtocols` route sampling on the top 20 pairs.
   - Token whitelist and `isFoT` pull.
   - Well under 100k a month at 1 req/s with backoff on `X-RateLimit-Retry-After`.
2. **Cross-check loop:** 1 `/quote` per second, rotating pairs, needs Startup or above (quota 1M ≈ 0.39 RPS sustained, so budget it or top up).
3. **Execution leg:** prototype `from=executor, origin=EOA, receiver=executor, disableEstimate=true, usePatching` as needed, with a tight `deadline`, on an Arbitrum fork. Only adopt it if the profit after the infra fee clears the floor.
4. **Do not** use 1inch Web3 RPC or the Tx Gateway in the latency-critical path.
5. Before scaling: measure the actual round-trip latency from the Termux host. It is not stated in the docs.
