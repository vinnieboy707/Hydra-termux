# Node providers: what each plan allows, and how Chronos uses all of it

Chronos runs on every node, websocket and API key you set, and it staggers them. Each scan goes to the node that has
gone longest without one, if that node's plan has room right now. Each node's limits come from its provider's own
documentation; the sources are listed below and were checked on 2026-11-25. The code is in `lib/providers.cjs`
(the facts), `lib/nodepool.cjs` (the staggering) and `lib/chain.cjs` `meter` (what each node really billed).

`chronos nodes` prints each node's provider, plan, limits, websocket role and scan pace. `chronos verify-real`
check **node-plans** sends a real batch to every node and reports the same information.

## How every key is used

| What you set | What it does |
|---|---|
| `ARB_RPC_URL`, `ARB_RPC_URL_2` … `_5`, `ARBITRUM_RPC_URL`, `RPC_URL`, `ALCHEMY_RPC_URL` | each is a node in the scan pool; the same url counts once |
| `ALCHEMY_API_KEY`, `INFURA_API_KEY`, `SWIFTNODES_API_KEY` | a bare key is a node too: its documented Arbitrum One url is built from it |
| `ARBITRUM_WSS_URL`, `ARB_WSS_URL`, `ALCHEMY_WSS_URL`, `ARBITRUM_WSS_URL_2/_3` | live block feeds; the websocket of every node's provider is added automatically |
| `INFURA_PLAN`, `SWIFTNODES_PLAN` | your plan (default `free`, the safe assumption); `chronos keys` asks once |
| `CHRONOS_PRIMARY_NODE` | forces the node that initialises the engine and runs the per-block fast lane |
| trades | signed by Cloud KMS; broadcast through **every** node you set (the first to reach the sequencer wins) |
| balances | read on the scanning node and confirmed at the same block on a second node |
| private keys | never stored in plaintext: the owner key lives in the encrypted keystore (`chronos owner save`); trades need no private key |

## Packing as much into each billed call as possible

- **Multicall3**: quotes and pool states are packed into one `aggregate3` `eth_call`. The batch grows by 25% while
  full batches pass, up to `QUOTE_BATCH_MAX` (500) quote calls and 2,000 state reads. The size is learned for each
  node. If a node refuses a batch (gas cap, response size), the batch is split into two half-size multicalls; calls are
  sent one at a time only below 10.
- **JSON-RPC batching**: calls made together go out in one HTTP post. SwiftNodes bills a batch as one request;
  Infura bills each call inside it, by method.
- **Meter**: every node counts its HTTP posts, calls and (on Infura) credits by method. The next turn of each metered
  node is set from what it really billed, not from an estimate.

## Infura (Arbitrum One)

- Endpoints: `https://arbitrum-mainnet.infura.io/v3/<KEY>` and `wss://arbitrum-mainnet.infura.io/ws/v3/<KEY>`.
- Methods: the standard Ethereum JSON-RPC methods.

| Plan (`INFURA_PLAN`) | Credits a day | Credits a second |
|---|---|---|
| free | 3,000,000 | 500 |
| developer | 15,000,000 | 4,000 |
| team | 75,000,000 | 40,000 |
| custom | set per account | set per account |

**Credits per method:**

| Method or event | Credits |
|---|---|
| `eth_call`, `eth_blockNumber`, `eth_getBalance`, `eth_gasPrice`, `eth_feeHistory`, `eth_getTransactionReceipt`, `eth_sendRawTransaction` | 80 each |
| `eth_getLogs` | 255 |
| `eth_estimateGas` | 300 |
| `eth_chainId` | 5 |
| `eth_subscribe` | 5 |
| `newHeads` event | 50 per block |
| `logs` event | 300 per block |
| `debug_traceCall` | 1,000 |
| `trace_*` | 300 |

**Limits:**
- `eth_getLogs`: at most 10,000 results and 10 seconds per query.
- At the daily credit limit, websockets are severed and calls are refused until the reset.

**What Chronos does:**
- **Websocket feed.** Arbitrum makes about 345,600 blocks a day, so new-block events alone cost about 17.3M credits a
  day. On free (3M) and developer (15M) that would use up the key's credits, HTTP included, so Infura websockets are
  not used for the feed on those plans. On team, blocks fit but swap logs do not (300 credits a block); on custom,
  both are used.
- **Scan pace.** A scan's credits, measured, against 80% of the day's and the second's allowance. On free, a scan of
  236 multicalls (18,880 credits) can run at most once every 680 seconds on Infura alone. Other nodes scan in between.
- **Limit answers.** `-32005` or "daily request count exceeded" rests the node until 00:00 UTC; the scan moves to the
  next node.

## SwiftNodes (Arbitrum One)

- Endpoints: `https://rpc.swiftnodes.io/rpc/arbitrum?key=<KEY>` and `wss://rpc.swiftnodes.io/ws/arbitrum?key=<KEY>`
  (one key works for both).

| Plan (`SWIFTNODES_PLAN`) | HTTP req/s | Requests a month | WS messages/s | WS connections |
|---|---|---|---|---|
| free | 20 | 250,000 | 1 (newHeads only) | 1 |
| starter ($49) | 70 | no cap | 25 | 20 |
| growth ($89) | 150 | no cap | 75 | 50 |
| scale ($149) | 300 | no cap | 150 | 100 |
| pro ($249) | 600 | no cap | 250 | 200 |

- Paid plans can burst to 2× their rate for about 10 seconds; free has no burst.

**Free-plan limits:**
- A JSON-RPC batch holds at most 20 calls; paid plans have no batch limit.
- `eth_getLogs` covers at most 100 blocks per request.
- `debug_*` and `trace_*` need a paid plan.

**At the limit:** HTTP 429 with `Retry-After: 1` and `{"error":"Rate limited", …}`. Refused requests are not queued
and not billed.

**Websocket:** an idle connection is closed after 30 minutes; any message, including a ping, resets the timer. Log
and pending-transaction subscriptions need a paid plan.

**Arbitrum methods** (SwiftNodes' method matrix, tested 2026-11-01):
- Served: `eth_getBlockReceipts`, `eth_feeHistory`, `eth_getProof`, `eth_createAccessList`, `debug_traceCall`,
  `txpool_status`, `eth_getLogs`, JSON-RPC batch, archive (paid; historical block tags on the same endpoint).
- Unavailable: `trace_block`, `trace_filter`, `trace_transaction`.

**What Chronos does:**
- **Batches.** ethers' JSON-RPC batch is capped at 20 calls on free (its default is 100).
- **Logs.** Flash-loan research reads logs in 100-block ranges on free.
- **Websocket feed.** On free, blocks only (no swap stream); paid plans get blocks and swaps.
- **Scan pace.** Measured from HTTP posts, because a batch is one request. 250,000 a month divided by 31 days, at
  80%.
- **Limit answers.** A 429 rests the node (1 second, doubling up to 60); the scan moves to the next node.
- **Not documented:** whether websocket messages count toward the 250,000 monthly requests. Watch your SwiftNodes
  dashboard during the first day.

## Other providers

- **Alchemy, QuickNode, Chainstack, dRPC, your own node:** recognised, and their websockets are derived from the url.
  Chronos knows no published limit for them here, so it invents none: they take every scan they are free for. A
  429 from any of them still rests that node and moves the scan on.
- **Arbitrum's public RPC:** rate-limited, with no websocket and no txpool (docs.arbitrum.io). It scans last.

## Adding keys

More keys mean more scans, each one inside its plan:
1. `chronos set ARB_RPC_URL_4`, or the bare key: `chronos set INFURA_API_KEY` / `chronos set SWIFTNODES_API_KEY`.
2. Set your plan if it is not free: `chronos set INFURA_PLAN developer`.

A second key on the same Infura or SwiftNodes account shares that account's limits. Their plans are per key (SwiftNodes:
"limits apply per API key"), so separate accounts add capacity.

## Sources

Infura:
- https://docs.infura.io/reference/arbitrum.md
- https://docs.infura.io/reference/arbitrum/json-rpc-methods.md
- https://docs.infura.io/get-started/pricing.md
- https://docs.infura.io/get-started/pricing/credit-cost/
- https://docs.metamask.io/services/reference/linea/json-rpc-methods/eth_getlogs

SwiftNodes:
- https://swiftnodes.io/arbitrum-rpc
- https://swiftnodes.io/docs/method-support
- http://swiftnodes.io/docs/rate-limits
- https://swiftnodes.io/docs/websocket
- https://swiftnodes.io/arbitrum-rpc/websocket
- https://swiftnodes.io/docs/methods/batch
- https://swiftnodes.io/arbitrum-rpc/archive
- https://swiftnodes.io/run-your-own-node/arbitrum (attached by you: Nitro v3.11.3, ~2.3 TB full node; not needed when
  using a provider)
