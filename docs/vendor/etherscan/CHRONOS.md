# Etherscan V2 for Chronos (flash-loan arbitrage, Arbitrum One 42161)

Legend:
- **[FACT]** comes from the ingested docs. The source is given in brackets, and FACTS.md has the full citations.
- **[ASSESS]** is this cell's engineering judgement or general domain knowledge. It is not stated by Etherscan.

Every call below uses `https://api.etherscan.io/v2/api?chainid=42161&apikey=$ETHERSCAN_API_KEY&...`. The key is read from the owner's environment and is never logged.

---

## 0. Two gating issues to decide first

1. **Licence class.**
   - [FACT] Free, Lite and Standard plans are "Personal & Research use". That use "does not include use by or for a company... production service, or revenue-generating application".
   - [FACT] Advanced ($299/mo) and above are required for "Commercial Application use".
   - [FACT] The FAQ "forms part of Etherscan's Terms of Service". (etherscan.io/api/pricing)
   - [ASSESS] Offline competitor research and back-testing plausibly fit "research". Feeding Etherscan data into a live, revenue-generating trading engine plausibly does not. The owner should decide which side Chronos sits on, and can confirm with Etherscan (apisupport@etherscan.io) if unsure.
2. **Arbitrum free tier is a shared pool.**
   - [FACT] Since November 1, 2026, Free-tier calls on 42161 draw from a "shared pool of free API calls available to all Free tier users collectively". Once it is depleted, requests fail with "Community Free API limit reached. Resets ...". (changelog, common-error-messages)
   - [FACT] The pool size is not stated.
   - [ASSESS] The Free plan's nominal 100k/day is therefore not guaranteed on Arbitrum. Any paid plan (Lite and up) avoids the shared pool, because the docs tie the pool to "Free tier users".

---

## 1. Finding competitors' arbitrage transactions

### 1a. Discovery with getLogs by topic

[FACT] `module=logs&action=getLogs` supports the following (getlogs-topics, getlogs-address-topics):
- `address` plus `topic0`, and optionally `topic1`/`topic2`/`topic3`
- the pairwise `topicX_Y_opr=and|or` operators
- a required `fromBlock`/`toBlock`, and `page`/`offset`

Results include `transactionHash`, `logIndex`, `topics`, `data`, `gasPrice` and `gasUsed`, all as hex. On the Free tier each request returns at most 1,000 records (changelog, effective July 1, 2026).

Venue targets. **[ASSESS]** All addresses and signatures here are from domain knowledge and are not in the Etherscan docs. Verify each address with `getsourcecode` (check that ContractName matches) before hard-coding it. Compute each topic0 locally as keccak256 of the canonical signature, for example `ethers.id("FlashLoan(address,address,uint256,uint256)")`.

| Venue | Contract (Arbitrum, verify) | Event to filter (topic0 = keccak of) | Indexed topics useful for filtering |
|---|---|---|---|
| Balancer V2 Vault | 0xBA12222222228d8Ba445958a75a0704d566BF2C8 | `FlashLoan(address,address,uint256,uint256)` (recipient idx, token idx, amount, feeAmount) | topic1 = recipient, which is the bot contract |
| Aave V3 Pool | 0x794a61358D6845594F94dc1DB02A252b5b4814aD | `FlashLoan(address,address,address,uint256,uint8,uint256,uint16)` (target idx, initiator, asset idx, amount, mode, premium, referral idx) | topic1 = target (the receiver contract), topic2 = asset |
| Morpho Blue | 0x6c247b1F6182318877311737BaC0844bAa518F5e | `FlashLoan(address,address,uint256)` (caller idx, token idx, assets) | topic1 = caller |
| Uniswap V4 PoolManager | 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32 | No flash-loan event. V4 flash accounting runs inside `unlock`. Filter `Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)` and group by transactionHash. | topic1 = pool id, topic2 = sender (the router or bot) |

[ASSESS] Recipe:
1. Poll each venue over a sliding block window: `fromBlock=last+1`, `toBlock=latest`. Latest is shown accepted in the analytics guide.
2. Use `offset=1000` and step `page` until fewer than 1,000 rows come back. If a window returns a full 1,000 rows, halve the window. The docs give no total page × offset ceiling, so keep windows small.
3. Deduplicate by transactionHash.
4. Treat a transaction as an arbitrage candidate when it has a flash-loan log plus at least two swap logs on different pools in the same transaction, or for V4 at least two Swap logs, with a net-positive token balance change to the initiator (see 1c).
5. Use topic1 (recipient, target or caller) as the competitor-contract key. It is how the bot set gets built automatically.

### 1b. Known bot contracts

- [FACT] `txlist` (address, startblock, endblock, page, offset, sort) gives every top-level transaction to or from a bot. It includes `methodId`, `functionName` (when the bot is verified), `isError`, `txreceipt_status`, `gasUsed` and `gasPrice`.
- [FACT] The Advanced Filter (`action=txlist&to=<bot>&fromto_opr=or`, Beta) can filter by sender or recipient.
- [ASSESS] Use `sort=desc` with a recent `startblock` to pull only new activity. A failed bot transaction (`isError=1`) is a strong signal of a contested opportunity, which makes it useful to Chronos as a competition indicator.

### 1c. Internal transactions and token transfers (decode legs and profit)

- [FACT] `txlistinternal&txhash=...` returns "**Only non-zero value internal transactions**". It returns native-ETH movements, not the full call tree.
- [FACT] `txlistinternal&address=...` includes `traceId`.
- [FACT] By-block-range internal transactions are PRO (Standard and above).
- [FACT] `tokentx&address=<bot>` gives ERC-20 transfers to and from the bot. Each one has `contractAddress` (the token), `value`, `tokenDecimal` and `hash`. It has no `logIndex` field.
- [FACT] `eth_getTransactionReceipt` returns all `logs[]`, plus `gasUsed`, `effectiveGasPrice` and `status`.
- [ASSESS] The **receipt is the cheapest complete leg decoder**. One call gives every Transfer and Swap log, in logIndex order, for the transaction.
  - Profit is the sum of Transfer(to = bot or beneficiary) minus Transfer(from = bot) per token, minus the flash fee (from the FlashLoan log `feeAmount`/`premium`), minus gas.
  - Gas is `gasUsed × effectiveGasPrice`. Arbitrum's L1-data component is not documented in Etherscan's receipt schema, so treat the receipt's gas cost as the total paid and confirm against an Arbitrum node if needed.
  - Use `tokentx` only for per-bot rollups such as daily PnL, not for per-transaction decoding.
  - Etherscan has no trace or debug method. A full call trace needs Chronos's own node or RPC.

## 2. Pool and contract identification

- [FACT] `getsourcecode` returns `ContractName`, `CompilerVersion`, `Proxy` (0, 1, or 2 = minimal proxy), `Implementation`, `SimilarMatch` and `ABI`.
- [FACT] `getcontractcreation` (up to 5 addresses per call) returns `contractCreator`, `txHash`, `blockNumber` and **`contractFactory`**.
- [FACT] `getabi` returns the ABI.
- [FACT] Source code and ABI endpoints are free on every chain and plan.
- [ASSESS] Mapping algorithm for an unknown pool address seen in a Swap log:
  1. Call `getcontractcreation` (batch 5 unknown pools per call). If `contractFactory` is a known factory (for example the Uniswap V3 factory, Camelot, SushiSwap, Balancer pool factories, Curve factories), the venue is identified.
  2. If `contractFactory` is empty, call `getsourcecode`. Use `ContractName` and `SimilarMatch` to classify, and follow `Implementation` when `Proxy` is 1 or 2.
  3. Cache the result permanently, since pool-to-venue mappings never change. Fetch the ABI from `getsourcecode`, which already includes it, so a separate `getabi` call is unnecessary.
  4. Uniswap V4 pools are not contracts. They are `bytes32` ids inside the PoolManager. Identify them from the PoolManager's `Initialize` event logs, which come from getLogs with topic1 = id, rather than from the contract endpoints.

## 3. Verifying Chronos's own trades

- [FACT] `gettxreceiptstatus` returns {status 1/0}.
- [FACT] `getstatus` returns {isError, errDescription}, for example "Bad jump destination".
- [FACT] `eth_getTransactionReceipt` returns status, gasUsed, effectiveGasPrice and logs.
- [ASSESS] Use the receipt (1 call) as the post-trade audit. It confirms success, realised token deltas from the logs, and gas, without depending on the executing RPC. This gives an independent second source.
- [ASSESS] If the receipt status is 0, call `getstatus` once for the revert description.
- [ASSESS] Etherscan may lag the chain head. Its indexing latency is not stated. Keep Chronos's primary confirmation on its own RPC and use Etherscan as asynchronous reconciliation.
- [ASSESS] Testing: any mocked Etherscan responses in Chronos tests should be paired with a live smoke test against the real API. Cheap calls are `getapilimit` and `eth_blockNumber` on 42161. The test should assert the real envelope shapes recorded in `pages/`, which are `status`/`message`/`result` for REST and `jsonrpc`/`id`/`result` for proxy.

## 4. Daily research budget (calls per analysed trade)

[ASSESS] Per-unit call costs:

| Work item | Calls | Notes |
|---|---|---|
| Discovery (per venue, per poll window) | 1 + ceil(rows/1000) − 1 | 4 venues, polled every 60 s ≈ 4 × 1,440 = **5,760/day** baseline. Add pages if busy. |
| Decode one candidate trade | **1** (receipt) | Legs, flash fee, gas, status |
| Optional: tx input / calldata | +1 (eth_getTransactionByHash) | Only for building a competitor-strategy profile |
| Optional: native-ETH legs | +1 (txlistinternal txhash) | Only if WETH unwraps or ETH payouts matter |
| New pool or contract identification | ~0.2 (getcontractcreation, batched ×5) + ≤1 (getsourcecode) | One-off per address, then cached |
| Bot profile refresh | 1 txlist + 1 tokentx per bot per refresh (per 1,000 rows) | e.g. 50 bots daily = 100/day |

**Typical cost is 1 to 3 calls per analysed trade, plus fixed overhead of about 6k/day.**

[ASSESS] Capacity per plan. The rate and daily caps are [FACT] from rate-limits. The trade counts are arithmetic.

| Plan | Daily cap | Rate cap | Trades/day at 1 call/trade | at 3 calls/trade | Comment |
|---|---|---|---|---|---|
| Free | 100,000 (shared pool on 42161, size not stated) | 3/s | ≈ 94k | ≈ 31k | Bounded by daily cap. Can fail early if the community pool drains. Licence: research only. |
| Lite $49 | 100,000 | 5/s | ≈ 94k | ≈ 31k | Same daily cap, but no shared pool. Licence: research only. |
| Standard $199 | 200,000 | 10/s | ≈ 194k | ≈ 65k | Adds PRO txlistinternal by block range. Licence: research only. |
| Advanced $299 | 500,000 | 20/s | ≈ 494k | ≈ 165k | Lowest tier licensed for commercial use. |
| Professional $399 | 1,000,000 | 30/s | ≈ 994k | ≈ 331k | |

- Free-tier figures assume the 5,760/day discovery overhead and full availability of the shared pool.
- At 3 calls/s, a backlog of 10,000 trades at 3 calls each takes about 2.8 hours. Throttle with a token bucket at about 2.5 calls/s on Free, as the docs advise.
- Watch `getapilimit` (creditsUsed / creditsAvailable / intervalExpiryTimespan) and stop at around 90%. Since November 3, 2026, requests are blocked at the cap unless paid overage ($3 per 100k) is on.

[ASSESS] Recommendation for a `lib/research.cjs`-style module:
- Run discovery and decoding as an offline research job, not inside the hot path.
- Cache contract metadata permanently.
- Use receipts, not tokentx, for leg decoding.
- Budget at most 3 calls per trade.
- On a Free key, handle the "Community Free API limit reached" message by backing off until the reset time quoted in the message.
- If Chronos is run as a revenue-generating service, the Terms point to the Advanced tier.
