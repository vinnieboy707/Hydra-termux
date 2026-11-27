# Arbitrum One, the protocols Chronos uses, and Blockscout

Reference for the VP's agents (searched by `lib/knowledge.cjs`). Each fact names where it comes from:
- a provider's documentation (linked);
- a value your engines read live from the chain, marked *read live*;
- the code itself (file named).

Nothing here is a guess. A fact that can change (a fee, a block time) is re-read live by the engine before it is used.

## Arbitrum One

- **Chain.** Chain id 42161; real checks confirm `eth_chainId` = 0xa4b1 on every node.
- **Blocks.** About every 250 ms, roughly 345,600 a day (swiftnodes.io/arbitrum-rpc; matches the block numbers your
  engines see).
- **Finality.** Soft finality under 1 second; hard (L1) finality about 7 days, the optimistic-rollup challenge window
  (swiftnodes.io/arbitrum-rpc/websocket).
- **Ordering.** The sequencer orders transactions first come, first served. There is no public mempool to read and no
  `txpool` on the public endpoint (docs.arbitrum.io).
- **Competing.** Competing on Arbitrum means being first to the sequencer, not outbidding gas. Chronos broadcasts
  through every node you set.
- **Public RPC.** `https://arb1.arbitrum.io/rpc` is rate-limited and has no websocket (docs.arbitrum.io). Chronos ranks
  it last for scanning.
- **Deprecated method.** `eth_sendRawTransactionConditional` is deprecated from Jan 17 2027 (docs.arbitrum.io).
  Chronos does not use it.
- **Gas price.** About 0.02 gwei in late Nov 2026 (*read live*: heartbeat gasGwei 0.020). A 2-leg route's gas was
  about $0.03 at that price (*read live*: gasUsdByLegs).

## Flash-loan lenders

- **Aave V3 Pool** `0x794a61358D6845594F94dc1DB02A252b5b4814aD`.
  - Flash premium 5 bps (*read live* by real check aave-reads: "premium 5 bps · 20 flash-loanable reserves").
  - The premium is charged on the borrowed amount and must be repaid in the same transaction.
- **Balancer V2 Vault** `0xBA12222222228d8Ba445958a75a0704d566BF2C8` (`lib/live.cjs`).
  - Flash-loan fee 0 bps (*read live*: flashFeeBps balancer_v2 0).
  - The contract v2 can borrow from it. The engine picks Balancer when it is cheaper and holds enough of the asset.

## Quoting

- **Multicall3** `0xcA11bde05977b3631167028862bE2a173976CA11` (`lib/batch.cjs`).
  - Many `eth_call`s are packed into one `aggregate3`, every quote pinned to one block.
  - Batch size grows while a node accepts it and halves when refused.
- **Uniswap/Sushi/Pancake V3 QuoterV2** `quoteExactInputSingle`: a simulated swap, read by `eth_call`; nothing is sent.
- **V2 routers** `getAmountsOut`: the venue's own constant-product quote.
- **Venues** confirmed on chain (`venues.json`, real check venues-real): uniswap_v3, pancake_v3, sushi_v3, sushi_v2,
  camelot_v2, uniswap_v2, pancake_v2.
- **Broken pools.** A drained or abandoned pool can show any price. Seen live: ezETH/WETH V2 `0x52Ce46…` at a "gap"
  of 1.6e16 bps. From 2.9.6, pools more than 20% from the Aave oracle, or from the pair's other pools, are left out
  (`lib/cycles.cjs` saneMarkets).

## What makes a route pay

A route nets **gross − flash fee − gas**, decided by real quotes at one block, never by spot prices.

- **Flash fee.** 0 bps on Balancer, 5 bps on Aave.
- **Gas.** About $0.03–0.06 per route at current prices.
- **The question.** Whether a real price gap larger than the fee and gas exists at a size the pools can carry.

Research on competitors' flash loans (`chronos research`) reported a median kept profit of $0.04–$0.14 per
transaction, with 3–11 of 40 profitable after gas (*read live*, Nov 25 heartbeats). These are small, frequent wins;
speed to the sequencer and pool coverage decide who gets them.

## Blockscout (arbitrum.blockscout.com, API v2)

Field names as the live deployment answered on 2026-11-25 (`lib/blockscout.cjs`):

| Endpoint | Fields used |
|---|---|
| `GET /api/v2/addresses/{a}` | `coin_balance`, `is_contract`, `is_verified`, `creator_address_hash`, `creation_transaction_hash`, `creation_status`, `block_number_balance_updated_at` |
| `GET /api/v2/blocks?type=block` | `items[].height` |
| `GET /api/v2/addresses/{a}/transactions?filter=from` | `items[]`: `hash`, `status` ("ok" or "error"), `result`, `block_number`, `from.hash`, `to.hash`, `fee.value` |
| `GET /api/v2/transactions/{hash}` | same fields as one item |

- **Balances.** Blockscout updates a balance when the address is touched, so a gap against a stale index is a warning,
  not a failure.
- **Your old address.** `CONTRACT_ADDRESS 0x1CD66cF5fAc59F526f8F9732586c4D47a9eB67DF` is a contract whose source is
  not verified, with no logs and 0 ETH (*read live* via Blockscout). Chronos does not use it.
