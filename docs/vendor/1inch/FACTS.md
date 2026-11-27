# 1inch APIs: verified facts

Every fact below comes from a page or spec ingested on 2026-11-26 and carries its source URL. The raw copy of each source is in `pages/` (see `INDEX.md`). Where the docs give no number, this file says **not stated**. Where two official pages disagree, both are quoted.

Short source keys used below:
- [AUTH] https://business.1inch.com/portal/documentation/apis/authentication
- [PRICING] https://business.1inch.com/pricing
- [SUBS] https://business.1inch.com/portal/documentation/payment-methods/subscriptions/subscriptions
- [TROUBLE] https://business.1inch.com/portal/documentation/faq/api-troubleshooting
- [ERRFAQ] https://business.1inch.com/portal/documentation/faq/api-error-messages-explained
- [INFRAFEE] https://business.1inch.com/portal/documentation/faq/infrastructure-fee
- [X402] https://business.1inch.com/portal/documentation/payment-methods/x402/x402
- [SA8703748] https://business.1inch.com/portal/support/article/8703748
- [SA12380488] https://business.1inch.com/portal/support/article/12380488
- [SA10214433] https://business.1inch.com/portal/support/article/10214433
- [SA11703585] https://business.1inch.com/portal/support/article/11703585
- [MONITOR] https://business.1inch.com/portal/documentation/payment-methods/subscriptions/monitoring-usage
- [CHAINS] https://business.1inch.com/portal/documentation/overview/supported-chains
- [SWAPSPEC] https://api.business.1inch.com/swagger-docs/swap/swagger/ethereum-json
- [SWAPINTRO] https://business.1inch.com/portal/documentation/apis/swap/classic-swap/introduction
- [SWAPQS] https://business.1inch.com/portal/documentation/apis/swap/classic-swap/quick-start
- [SWAPMATRIX] https://business.1inch.com/portal/documentation/apis/swap/swap
- [MIG61] https://business.1inch.com/portal/documentation/apis/swap/classic-swap/migration/migration-v60-v61
- [GASSPEC] https://api.business.1inch.com/swagger-docs/gas-price/swagger/ethereum-json
- [GASQS] https://business.1inch.com/portal/documentation/apis/gas-price/quick-start
- [PRICESPEC] https://api.business.1inch.com/swagger-docs/price/swagger/ethereum-json
- [TOKENSPEC] https://api.business.1inch.com/swagger-docs/token/swagger-json
- [TOKENQS] https://business.1inch.com/portal/documentation/apis/tokens/quick-start
- [TXSPEC] https://api.business.1inch.com/swagger-docs/tx-gateway/swagger/ethereum-json
- [TXINTRO] https://business.1inch.com/portal/documentation/apis/transaction/introduction
- [TXQS] https://business.1inch.com/portal/documentation/apis/transaction/quick-start
- [WEB3] https://business.1inch.com/portal/documentation/apis/web3/overview
- [ARBRPC] https://business.1inch.com/portal/assets/docs-assets-v2/openrpc/web3/arbitrum_execution_api.json
- [TRACESPEC] https://api.business.1inch.com/swagger-docs/traces/v1.0/chain/1/swagger-json
- [TRACEQS] https://business.1inch.com/portal/documentation/apis/traces/quick-start
- [OBSPEC] https://api.business.1inch.com/swagger-docs/orderbook/swagger/ethereum-json
- [OBINTRO] https://business.1inch.com/portal/documentation/apis/orderbook/introduction
- [OBMIG] https://business.1inch.com/portal/documentation/apis/orderbook/migration/migration-v3-v4
- [FQUOTER] https://api.business.1inch.com/swagger-docs/fusion/quoter/swagger/ethereum-json
- [FRELAYER] https://api.business.1inch.com/swagger-docs/fusion/relayer/swagger/ethereum-json
- [FORDERS] https://api.business.1inch.com/swagger-docs/fusion/orders/swagger/ethereum-json
- [FINTRO] https://business.1inch.com/portal/documentation/apis/swap/intent-swap/introduction
- [FQS] https://business.1inch.com/portal/documentation/apis/swap/intent-swap/quick-start/quick-start-ethereum
- [XCINTRO] https://business.1inch.com/portal/documentation/apis/swap/cross-chain-swap/introduction
- [RESOLVERS] https://business.1inch.com/portal/documentation/resolvers/introduction
- [UNICORN] https://business.1inch.com/portal/documentation/resolvers/limit-order/unicorn-power-setup
- [BALSPEC] https://api.business.1inch.com/swagger-docs/balance/swagger/ethereum-json
- [HISTSPEC] https://api.business.1inch.com/swagger-docs/history/v2.0/history/1/swagger-json
- [LLMS] https://business.1inch.com/portal/llms.txt

---

## 1. Platform, hosts, migration
- The old portal `portal.1inch.dev` no longer resolves (DNS failure during this crawl). `docs.1inch.io` and `business.1inch.com/portal/documentation` both redirect to `https://business.1inch.com/portal/documentation/overview/welcome` (observed via Firecrawl redirect metadata).
- Unified API gateway: `https://api.1inch.com`. MCP server: `https://api.1inch.com/mcp/protocol`. [LLMS]
- One API key covers every product. Aqua is enabled per plan. [SUBS]

## 2. Base URLs and versions per API (all on `https://api.1inch.com`)
| API | Base path (current version) | Source |
|---|---|---|
| Classic Swap (Pathfinder v6.1) | `/swap/v6.1/{chainId}/...` (spec version "6.1") | [SWAPSPEC], [SWAPQS] |
| Intent Swap (Fusion) | SDK `url: "https://api.1inch.com/fusion"`. Services `/quoter`, `/relayer`, `/orders` at v2.0 (spec `servers` = `/quoter`, `/relayer`, `/orders`, paths `/v2.0/{chain}/...`) | [FQS], [FQUOTER], [FRELAYER], [FORDERS] |
| Cross-chain (Fusion+) | Orders, Quoter and Relayer specs, latest stable v1.2. WebSocket `wss://api.1inch.com/fusion-plus/ws` | [LLMS], https://business.1inch.com/portal/documentation/apis/swap/cross-chain-swap/sdk/web-socket-api |
| Orderbook (limit orders, LOP v4) | `/orderbook/v4.1/{chain}/...` (spec paths `/v4.1/1/...`; spec `info.version` "v4.0") | [OBSPEC], [OBMIG] |
| Spot Price | `/price/v1.1/{chainId}` (spec `info.version` 2.1.211) | [PRICESPEC] |
| Gas Price | `/gas-price/v1.6/{chainId}` | [GASSPEC], [GASQS] |
| Token | `/token/v1.7/{chainId}` (v1.4 to v1.7 live. v1.2 and v1.3 deprecated, sunset 2027-06-01 per index) | [TOKENSPEC], [TOKENQS], [LLMS] |
| Balance | `/balance/v1.2/{chainId}/...` (v1.1 marked deprecated) | [BALSPEC] |
| Portfolio | `/portfolio/portfolio/v5.0` | https://business.1inch.com/portal/documentation/apis/portfolio/quick-start |
| History | `/history/v2.0/history/{address}/events` | [HISTSPEC], https://business.1inch.com/portal/documentation/apis/history/quick-start |
| Traces | `/traces/v1.0/chain/{chain}/...` | [TRACESPEC], [TRACEQS] |
| Transaction Gateway | `/tx-gateway/v1.1/{chainId}/broadcast` and `/flashbots` | [TXSPEC], [TXQS] |
| Web3 RPC | HTTP `https://api.1inch.com/web3/{chainId}`. WS `wss://api.1inch.com/web3/{chainId}` | [WEB3] |
| Charts | `/charts/v1/...` | https://business.1inch.com/portal/documentation/apis/charts/quick-start |
| NFT | `/nft/v2/byaddress` | https://business.1inch.com/portal/documentation/apis/nft/quick-start |
| Domains | `/domains/v2.0/{domain}/lookup` | https://business.1inch.com/portal/documentation/apis/domains/quick-start |
| Token Details | `/token-details/v1.0/...` | https://business.1inch.com/portal/documentation/apis/token-details/quick-start |
| Aqua | `/aqua/v1.0` (read-only analytics REST) | https://business.1inch.com/portal/documentation/aqua/api/quick-start |

## 3. Authentication [AUTH]
- API key as a header: `Authorization: Bearer {YOUR_API_KEY}`. Or as a query parameter: `apiKey={YOUR_API_KEY}`.
- WebSocket: either the header or `?apiKey=` on `wss://api.1inch.com/web3/{chainId}`. [AUTH], [WEB3]
- OAuth 2.1 is also supported (client_credentials, authorization_code with PKCE, refresh_token). Token endpoint: `POST https://api.1inch.com/oauth/token`. Discovery: `/.well-known/oauth-authorization-server`. Access tokens are sent the same way: `Authorization: Bearer`.
- Every response carries `X-Request-Id`.
- The docs say not to put keys in client-side code or public repos. [AUTH], https://business.1inch.com/portal/documentation/faq/cors-error-faq
- Parameters are case-sensitive: `disableEstimate=true` works, `True` does not. [ERRFAQ]
- x402 calls send **no API key**. The gateway answers `402 Payment Required` and the client pays per call in USDC on Base. [X402]

## 4. Plans, rate limits, quotas, pricing
### Self-service plans [SUBS], [PRICING]
| Plan | API calls / month | **Web3 RPC calls / month** | Rate limit | WebSocket connections | Apps | Keys/app | Users | Data retention (days) | Logs retention (days) |
|---|---|---|---|---|---|---|---|---|---|
| Free / Dev | 100,000 | 25,000 | 60 / minute | 3 | 1 | 1 | 3 | 7 | 1 |
| Startup | 1,000,000 | 50,000 | 10 / second | 10 | 2 | 2 | 5 | 30 | 14 |
| Pro(fessional) | 3,000,000 | 100,000 | 20 / second | 20 | 5 | 2 | 7 | 30 | 30 |
| Business | 7,000,000 | 250,000 | 40 / second | 40 | 10 | 5 | 10 | 90 | 30 |
| Enterprise / Custom | negotiated | negotiated | negotiated (per-API RPS and monthly limits in the configurator) | not stated | | | | | |

- Web3 RPC monthly figures are from [SUBS]. The pricing page does not list them.
- WebSocket, retention, user and app columns are from [PRICING].
- **Free-plan rate limit, conflicting statements:**
  - [PRICING] and [SUBS] say "60 req/min" (60 / minute).
  - [SA8703748] says the Dev plan has "limits of 1 Request Per Second (RPS)".
  - [TROUBLE] says "As of August 2023, all free public API usage has been reduced to 1 requests per second (rps)".
  - [ERRFAQ] says the 429 means "too many requests ... within a 1 second time period ... stay below the free 1rps limit".
- **Prices:** [PRICING] shows Startup "$149" and "$199", Pro "$299" and "$399", Business "$599" and "$799", with the billing toggle on "Annual". "Free plan: Developer tier". "From $10: Monthly subscription plans". "Build your Web3 stack ... from $20/mo" (custom configurator). Which figure is annual-billed and which is monthly-billed is **not stated in the scraped text**. My inference: the lower figure is the annual-billing monthly rate. [SUBS] says "Prices depend on the billing interval you choose (1, 3, 6, or 12 months). Longer commitments lower the effective monthly rate."
- Paying: USDC on Ethereum, x402 USDC on Base, or card ("Coming soon"). [PRICING]
- Paid plans for higher volume: projects reaching US$10 million of swap volume are moved automatically to a Custom plan, "typically includes a revenue share agreement". [SA8703748]
- API keys share one RPS limit and one call limit across the whole account. Per-product limits are only possible on a Custom plan. [SA12380488], [PRICING] FAQ
- Top-ups add monthly calls only, in blocks of 100,000. RPS stays unchanged. Top-ups are valid for the current billing cycle only. [SA10214433]
- Custom plan configurator: choose APIs and set RPS and monthly limits per API. [SA11703585]

### What happens when limits are exceeded
- Above the RPS/RPM limit: **HTTP 429**, no overage charge. [PRICING] FAQ, [SA12380488], [SA8703748]
- A 429 from the per-second limiter carries **`X-RateLimit-Retry-After`**. It does not carry the subscription headers. [TROUBLE]
- Monthly quota exhausted: also 429. These responses **do** include the subscription headers. Requests are rejected until the next billing cycle or a top-up, or until x402 overflow is set up. [TROUBLE], [MONITOR]
- Quota headers on authenticated responses:
  - `X-SubscriptionLimit-Limit`
  - `X-SubscriptionLimit-Remaining`. Approximate, refreshed within about 35 to 50 s. It may understate consumption, never overstate it.
  - `X-SubscriptionLimit-Reset` (unix seconds).
  - Quotas are tracked per product group. [TROUBLE]
- Spot Price only: **503** with a `Retry-After` header when the API, a chain's share or the batch routes' share is "at its limit of requests in flight". Requests sent with `x-request-priority: background` are turned away first. **504** "Request deadline exceeded". [PRICESPEC]
- 503 "Banned IP". 403 for a banned or restricted origin address, or for a missing or bad key. [ERRFAQ]

### x402 pay-per-call [X402], [PRICING]
- Paid in USDC on Base. Minimum deposit $2.00.
- Prices per call:

| API | Price per call |
|---|---|
| Web3 RPC | $0.00018 |
| Domains | $0.00018 |
| Swap | $0.00024 |
| Orderbook | $0.00024 |
| Spot Price | $0.00024 |
| Token | $0.00024 |
| Transaction Gateway | $0.00024 |
| Gas Price | $0.00024 |
| NFT | $0.00024 |
| Traces | $0.0003 |
| History | $0.0003 |
| Charts | $0.0003 |
| Balance | $0.00048 |
| Portfolio | $0.00048 |
| Token Details | $0.00048 |

- "During the launch, 1inch is waiving its Swap infrastructure fee" for x402 Swap calls. [X402]
- x402 RPS limit: **not stated**.

### Swap infrastructure fee (charged on top of the subscription) [INFRAFEE]
- "Deducted from the destination amount of each completed Network Request".

| Plan | Stablecoin pairs | Non-stable pairs |
|---|---|---|
| Dev | 10 bps | 30 bps |
| Startup | 7 bps | 20 bps |
| Pro | 4 bps | 10 bps |
| Business | 2 bps | 5 bps |

- The quote response exposes the fee:
  - `feeAmount`, `feeToken` (the source token) and `feePercent`. `feePercent` is the flat percent "of the pair class (normal, stable, RWA or wrapped)".
  - "dstAmount already has the charged fee deducted ... do not subtract feeAmount from dstAmount again". [SWAPSPEC]

## 5. Which APIs support Arbitrum (42161)
| API | Arbitrum? | Source |
|---|---|---|
| Chain overview | "Full API set" | [CHAINS] |
| Classic Swap | yes (in the chainId enum and the table) | [SWAPSPEC], [SWAPINTRO] |
| Intent Swap (Fusion) | yes. RWA: no. MEV protection: yes. Gasless: yes | [FINTRO], [FQUOTER] (`supportedChains` includes 42161) |
| Cross-chain (Fusion+) | yes (MEV yes, gasless yes). Arbitrum escrow lock: Low+Medium volume 10 s, High volume 36 s | [XCINTRO] |
| Orderbook | yes | [OBINTRO] |
| Spot Price | yes | [PRICESPEC] |
| Gas Price | yes | [GASSPEC] |
| Token | yes | [TOKENSPEC] |
| Balance | yes | https://business.1inch.com/portal/documentation/apis/balance/introduction |
| Portfolio | yes | https://business.1inch.com/portal/documentation/apis/portfolio/introduction |
| History | yes | https://business.1inch.com/portal/documentation/apis/history/introduction |
| Traces | yes | https://business.1inch.com/portal/documentation/apis/traces/introduction |
| Transaction Gateway | yes, **public broadcast only**. Private `/flashbots` is "Enabled on Ethereum, BNB and Base" | [TXINTRO], [TXSPEC] |
| Web3 RPC | yes (JSON-RPC, WebSocket subscriptions, full and archive). gRPC is Solana-only | [WEB3] |
| Charts | yes | https://business.1inch.com/portal/documentation/apis/charts/introduction |
| NFT | yes | https://business.1inch.com/portal/documentation/apis/nft/introduction |
| Token Details | yes | https://business.1inch.com/portal/documentation/apis/token-details/introduction |
| Domains | **no** (Ethereum 1 and Polygon 137 only) | https://business.1inch.com/portal/documentation/apis/domains/introduction |

## 6. Classic Swap v6.1: exact endpoints and parameters [SWAPSPEC]
The chain is the second path segment, e.g. `/v6.1/42161/quote`. Chain enum: 1, 45, 137, 10, 56, **42161**, 43114, 100, 250, 1313161554, 8217, 324, 8453, 59144, 501, 146, 130, 4663, 143, 25, 999, 5042.

### `GET /swap/v6.1/{chainId}/quote`: "Find the best quote to swap with 1inch Router"
| Param | Req | Type / range | Doc text |
|---|---|---|---|
| src | yes | string (address) | e.g. `0xeeee...eeee` = native |
| dst | yes | string | |
| amount | yes | string (minimal units) | |
| excludePMMs | no | bool, default false | "Exclude all PMM liquidity sources from route search. Overrides explicit protocol selections." |
| protocols | no | string | "All supported liquidity sources by default" (comma list of liquidity-source ids) |
| excludedProtocols | no | string | "excluded supported liquidity sources" |
| fee | no | number 0 to 3 (percent) | partner fee. Must match on /quote and /swap |
| gasPrice | no | string (wei) | "By default fast network gas price" |
| complexityLevel | no | number 0 to 2 | |
| parts | no | number 0 to 50 | |
| mainRouteParts | no | number 0 to 10 | |
| gasLimit | no | number 100,000 to 11,500,000 | |
| deadline | no | integer (unix s) | "Unix timestamp (seconds) until which the served calldata must stay executable" |
| includeTokensInfo | no | bool | return src/dst token info |
| includeProtocols | no | bool | "Return used swap protocols in response" |
| includeGas | no | bool | "Return approximated gas in response" |
| connectorTokens | no | string, "minimum 0, maximum 5" | (listed as a string with min/max 0 to 5. Exact format **not stated**) |

- Response `QuoteResponse`:
  - required: `dstAmount`, `feeAmount`, `feeToken`, `feePercent`
  - optional: `srcToken`, `dstToken`, `protocols` (TokenSwaps[]), `gas`
- Errors:
  - 400 `INSUFFICIENT_LIQUIDITY | UNKNOWN_TOKEN | GAS_PRICE_NOT_ALLOWED | DUPLICATE_HEADER | VALIDATION_FAILED | REQUIRED_FIELD_MISSING | INVALID_NUMBER`
  - 403 `FORBIDDEN`
  - 500 `INTERNAL_SERVER_ERROR` (e.g. "gas price oracle failed")
  - The error body is `{error, description, statusCode, code, requestId, meta[]}`.

### `GET /swap/v6.1/{chainId}/swap`: "Generate calldata to swap on 1inch Router"
Takes everything that /quote takes, plus:

| Param | Req | Doc text |
|---|---|---|
| from | **yes** | "The address that calls the 1inch contract" |
| origin | **yes** | "An EOA address that initiate the transaction" |
| slippage | no | percent 0 to 50. "Use either slippage or minReturn, not both". Allows re-routing and re-estimation |
| minReturn | no | minimal-unit dst amount. Errors if the rate moved. No re-estimation |
| permit | no | EIP-2612 |
| receiver | no | defaults to `from` |
| referrer | no | required when `fee` is set |
| allowPartialFill | no | default false |
| compatibility | no | "Allows to swap tokens with internal transfer fee" |
| disableEstimate | no | "Enable this flag to disable onchain simulation" |
| usePatching | no | "Enable this flag if you patch input amount on your smart contract" |
| usePermit2 | no | for an approval made to Permit2 |
| forceApprove | no | "the approval check during simulation will be skipped" |
| createAccessList | no | "generates and returns an EIP-2930 access list" |

- Response `SwapResponse`:
  - required: `dstAmount`, `tx`, `stateOverrides`
  - optional: `srcToken`, `dstToken`, `protocols`, `deadline` ("Unix timestamp (seconds) until which the transaction can be executed")
- `tx` (TransactionData): `from`, `to`, `data`, `value`, `gasPrice`, `gas`. Optional `gasUsed` and `accessList`.
- `stateOverrides`: "State-override set for propAMM routes: the maker state lives off-chain, so pass this object as the third parameter of eth_call / eth_estimateGas to reproduce the quoted amounts. An empty object for routes without propAMM legs."
- /swap 400 codes: `INSUFFICIENT_LIQUIDITY, INSUFFICIENT_RETURN, RE_ESTIMATED_RETURN_BELOW_SLIPPAGE, NOT_ENOUGH_BALANCE, NOT_ENOUGH_ALLOWANCE, INSUFFICIENT_BALANCE_FOR_RESERVE, ESTIMATION_FAILED, NO_PROTOCOLS, UNKNOWN_TOKEN, GAS_PRICE_NOT_ALLOWED, SLIPPAGE_TOO_HIGH, FEE_WITHOUT_REFERRER, FROM_ZERO_ADDRESS, PERMIT_NOT_ALLOWED_FOR_NATIVE, DUPLICATE_HEADER, FORCE_APPROVE_NOT_SUPPORTED, VALIDATION_FAILED, REQUIRED_FIELD_MISSING, INVALID_NUMBER`. Plus 403 `FORBIDDEN` and 500 `INTERNAL_SERVER_ERROR`.

### Other Swap endpoints [SWAPSPEC]
- `GET /swap/v6.1/{chainId}/approve/spender` returns `{address}`: "Address of the 1inch Router that is trusted to spend funds".
- `GET /swap/v6.1/{chainId}/approve/transaction?tokenAddress=&amount=` returns `{data, gasPrice, to, value}`. Infinite allowance if `amount` is omitted.
- `GET /swap/v6.1/{chainId}/approve/allowance?tokenAddress=&walletAddress=` returns `{allowance}`.
- **`GET /swap/v6.1/{chainId}/liquidity-sources`** returns `{protocols: [{id, title, img, img_color}]}`: "List of liquidity sources that are available for routing in the 1inch Aggregation Protocol".
- `GET /swap/v6.1/{chainId}/tokens` returns `{tokens: {addr: TokenInfo}}`. TokenInfo: `address, symbol, name, decimals, logoURI, domainVersion, eip2612, isFoT, tags`.

### Behaviour notes
- `/quote` returns a `dstAmount` "without checking that the route can execute". `/swap` with `disableEstimate=false` simulates, and its `dstAmount` "is the executable amount for that moment". [SWAPINTRO]
- `Not enough Allowance`, `Not enough src balance` and `Cannot Estimate` are returned only when `disableEstimate=false`. [SWAPINTRO]
- "Cannot Estimate" means eth_estimateGas threw. The suggested fix is `disableEstimate=true` plus a local estimate. [TROUBLE]
- complexityLevel meanings [TROUBLE]:
  - 0 = one pool per main route part.
  - 1 = two pools (1 connector).
  - **2 (Default)** = three pools (2 connectors).
  - 3 = four pools.
  - Note: the v6.1 spec caps `complexityLevel` at a max of 2. [SWAPSPEC]
- Parts: `mainRouteParts` is the initial split. `parts` is the number of blocks. "virtualParts" are splits inside a part. [TROUBLE]
- Passing `protocols` restricts routing to those sources. "All other liquidity sources will be excluded by default". [TROUBLE]
- "Insufficient liquidity" can mean that no aggregated source holds at least 10k of a connector token. [TROUBLE]
- v6.1 `protocols` response shape: `[{token, hops:[{part, dst, fromTokenId, toTokenId, protocols:[{name, part}]}]}]`. Example names: `UNISWAP_V4, UNISWAP_V3, UNISWAP_V2, CURVE_V2_TRICRYPTO_NG, FLUID_DEX_T1, SUSHI`. [MIG61]
- Router: the quick-start uses `AGGREGATION_ROUTER_V6 = '0x111111125421ca6dc452d289314280a0f8842a65'` (Base example) and approves that address before swapping. [SWAPQS] The Fusion EIP-712 domain example is `verifyingContract 0x111111125421ca6dc452d289314280a0f8842a65`, name "1inch Aggregation Router", version "6". [FQUOTER] **The Arbitrum router address is not stated explicitly**. Get it from `/approve/spender` on 42161.
- The Classic Swap supported-features matrix says Gasless: no, MEV protection: **no**, RWAs: yes. [SWAPMATRIX]
- The **Arbitrum list of liquidity sources is not printed anywhere in the docs**. It is only available live from `/swap/v6.1/42161/liquidity-sources` (needs a key. Not called).

## 7. Spot Price [PRICESPEC]
Chains include 42161. All prices are in native-currency wei unless `currency` is set.

| Endpoint | What it does |
|---|---|
| `GET /price/v1.1/{chainId}?currency=` | prices for whitelisted tokens |
| `POST /price/v1.1/{chainId}` | body `{tokens: [... max 200], currency?: "USD"}` |
| `GET /price/v1.1/{chainId}/{addresses}?currency=` | comma-separated addresses |
| `GET /price/v1.1/{chainId}/currencies` | list of supported currencies |

- Response is a map `{tokenAddress: priceString}`.
- Errors:
  - 400 (bad address)
  - 404 (unsupported chain)
  - 503 with `Retry-After` (overload, or a currency rate unavailable)
  - 504 (deadline exceeded)

## 8. Gas Price [GASSPEC]
- `GET /gas-price/v1.6/{chainId}`. Supported chains include Arbitrum (42161).
- The response shape depends on the chain:
  - EIP-1559 chains: `{baseFee, low, medium, high, instant}`, each `{maxPriorityFeePerGas, maxFeePerGas}`.
  - Legacy chains: `{standard, fast, instant}`.
  - Solana has its own shape.
- Which shape Arbitrum returns is **not stated** explicitly.
- 404 for an unknown chain.

## 9. Token API [TOKENSPEC], [TOKENQS]
v1.7 endpoints on `/token`:

| Endpoint | Notes |
|---|---|
| `GET /v1.7/{chainId}` | whitelisted list keyed by address. `provider` param, default "1inch" = whitelisted tokens. `country` param |
| `GET /v1.7/{chainId}/token-list` | Token Lists format |
| `GET /v1.7/{chainId}/search` | |
| `GET /v1.7/{chainId}/custom` and `/custom/{address}` | metadata by address |
| **`GET /v1.7/{chainId}/pairs`** | "Returns token pairs for a swap form". Params: `query`, `limit`, `cursor`, `replaceNativeWithWrappedInSource`. EVM only, includes 42161 |
| `GET /v1.7/{chainId}/trending-tokens` | |
| `GET /v1.7/{chainId}/chipssearch`, `/chipssearch/pairs` | |
| `GET /v1.7/multi-chain/...` | |

- Swap's own list is also available: `GET /swap/v6.1/{chainId}/tokens`. [SWAPSPEC]

## 10. Intent Swap (Fusion) order flow [FQUOTER], [FRELAYER], [FORDERS], [FINTRO]
1. `GET /fusion/quoter/v2.0/{chain}/quote/receive`.
   - Params: `fromTokenAddress, toTokenAddress, amount, walletAddress, enableEstimate` (required. Set it true to get a `quoteId`), plus `fee` (bps), `permit`, `isPermit2`.
   - POST variant: custom auction presets.
   - Returns `quoteId`, `toTokenAmount`, `presets{fast, medium, slow, custom}` (auctionDuration, startAuctionIn, initialRateBump, auctionStartAmount, auctionEndAmount, points[], gasCost, …), `settlementAddress`, `whitelist` ("current executors whitelist addresses"), `recommended_preset`, and more.
2. `POST /fusion/quoter/v2.0/{chain}/quote/build` with the quote body.
   - Returns EIP-712 `typedData`, `orderHash`, `extension`. For native-token sources it also returns a `transaction` and a pre-generated `signature`.
3. Sign the typed data, then `POST /fusion/relayer/v2.0/{chain}/order/submit` (or `/order/submit/many`) with `{order, signature, extension, quoteId}`.
   - 201 on success.
   - 400 `ORDER_VALIDATION_ERROR | ORDER_SAVER_ERROR | QUOTE_EXPIRED | CANNOT_SYNC_TOKENS`
   - 403 `BLACKLISTED_MAKER_OR_RECEIVER | CUSTOM_PRESET_NOT_ALLOWED`
   - 409 `ORDER_ALREADY_EXISTS`
4. Track with `GET /fusion/orders/v2.0/{chain}/order/status/{orderHash}` (or `POST /order/status`, up to 500 hashes).
   - Statuses: `pending, filled, false-predicate, not-enough-balance-or-allowance, expired, partially-filled, wrong-permit, cancelled, invalid-signature, invalid-maker-traits, awaiting-signatures, unpublished`.
5. Other Orders endpoints: `/order/active` (page/limit ≤ 500), `/order/settlement`, `/order/maker/{address}`, `/order/cancelable-by-resolvers`.

- Orders are filled by **resolvers** in a Dutch auction. "Before the auction begins, an order can be filled at the maximum rate. After the auction starts, the filling rate gradually decreases." [FINTRO]
- Becoming a resolver means self-service onboarding plus KYC/KYB, a compliance survey, and Access NFT minting. [RESOLVERS] The older LO flow staked 1INCH for "Unicorn Power" to be in the "top 10" whitelist. [UNICORN]

## 11. Orderbook (limit orders) [OBSPEC]
Paths on `/orderbook/v4.1/{chain}`:

| Endpoint | Notes |
|---|---|
| `POST /` | submit `{orderHash, signature, data: LimitOrderV4Data}`. 403 "Max valid orders per user: 100" |
| `GET /all` | cursor pagination. `limit` ≤ 500. `statuses` 1 valid, 2 temporarily invalid, 3 invalid. `sortBy`, `makerAsset`, `takerAsset` |
| `GET /order/{orderHash}` | |
| `GET /address/{address}`, `/address/{address}/history` | |
| `GET /events`, `/events/{orderHash}` | |
| `GET /count` | |
| `GET /unique-active-pairs` | |
| `GET /fee-info` | |
| `GET /receive-quote` | market price for a pair |
| `GET /has-active-orders-with-permit/{wallet}/{token}` | |

- The orderbook "acts as a source of liquidity for the 1inch Aggregation Protocol". Signed orders are executed through the contract's `fillOrder`. [OBINTRO]
- Limit-order resolvers discover active orders with `GET /v4.1/{chain}/all`. https://business.1inch.com/portal/documentation/resolvers/limit-order/quick-start-for-limit-order

## 12. Transaction Gateway [TXSPEC], [TXINTRO]
- `POST /tx-gateway/v1.1/{chainId}/broadcast` with body `{rawTransaction}`. Returns `{transactionHash}`. Public broadcast.
- `POST /tx-gateway/v1.1/{chainId}/flashbots`: "broadcasts it privately. **Enabled on Ethereum, BNB and Base.**" Arbitrum is not in that list.
- Marketing text: "Private broadcasting ... protection against front-running", "suitable for fast-paced trading environments", and it names "Traders and arbitrage bots". [TXINTRO]
- Latency and SLA for broadcast: **not stated**.

## 13. Web3 RPC [WEB3], [ARBRPC], [SUBS]
- Arbitrum 42161: JSON-RPC yes, WebSockets/subscriptions yes, gRPC no, full node yes, archive node yes.
- Endpoints: `https://api.1inch.com/web3/42161` and `wss://api.1inch.com/web3/42161`.
- Usable as a standard RPC: the docs show viem `http()` and `webSocket()` transports with a Bearer header or `?apiKey=`. They also show `eth_subscribe newHeads`.
- The Arbitrum OpenRPC lists 63 methods. Among them:
  - `eth_call`, `eth_estimateGas`, `eth_createAccessList`, `eth_simulateV1`, `eth_sendRawTransaction`
  - `eth_getLogs`, `eth_getProof`, `eth_getStorageAt`, `eth_getBlockReceipts`, `eth_feeHistory`, `eth_maxPriorityFeePerGas`
  - `eth_subscribe`/`eth_unsubscribe`, `eth_newFilter`, `eth_newPendingTransactionFilter`
  - **`debug_traceCall`, `debug_traceTransaction`, `debug_traceBlockByNumber/Hash`**, `debug_getRaw*`, `txpool_content`
  - The full list is in `pages/ref__…arbitrum_execution_api_json.md`.
  - The spec says it was "Generated from verified provider method unions". Whether every method is enabled on every plan is **not stated**.
- **Monthly Web3 RPC quota: Free 25,000. Startup 50,000. Pro 100,000. Business 250,000.** [SUBS]
- Web3 RPS: not stated separately. The plan rate limit applies, and keys share the account RPS. [SUBS], [SA12380488]
- WebSocket connection caps: 3 / 10 / 20 / 40 by plan. [PRICING]
- "Enhanced API services are available as part of our paid plans ... superior performance in terms of connectivity, throughput, and response times." [WEB3] Numbers: **not stated**.
- Latency: not stated.

## 14. Traces [TRACESPEC], [TRACEQS]
- `GET /traces/v1.0/chain/{chain}/synced-interval` returns `{from, to}`.
- `GET /traces/v1.0/chain/{chain}/block-trace/{blockNumber}`.
- `GET /traces/v1.0/chain/{chain}/block-trace/{blockNumber}/tx-hash/{txHash}`.
- `GET /traces/v1.0/chain/{chain}/block-trace/{blockNumber}/offset/{offset}`.
- `GET /traces/v1.0/chain/{chain}/disabled-blocks` (limit ≤ 1000).
- Built on `debug_traceBlockByNumber` and `debug_traceTransaction`.
- Trace types include `BUILTIN, CUSTOM, CUSTOM_GO, OLD_ARBITRUM_RAW_TRACE, BLOCK_STATE_V3`.
- Call-trace fields: `type, from, to, value, gas, gasUsed, input, output, error, calls[]`, plus `events/logs` and (custom) `storage`.
- Arbitrum is supported. The quick-start sleeps 1 s between calls "to avoid rate limit".

## 15. Balance, History, others
- Balance v1.2 endpoints:
  - `GET /{chainId}/balances/{wallet}`, `POST` the same path for custom tokens
  - `/allowancesAndBalances/{spender}/{wallet}`
  - `/allowances/{spender}/{wallet}`
  - `/aggregatedBalancesAndAllowances/{spender}?wallets=`
  - `POST /balances/multiple/walletsAndTokens` [BALSPEC]
- History v2.0:
  - `GET /history/v2.0/history/{address}/events?chainId=&limit≤2048&fromTimestampMs=&toTimestampMs=&tokenAddress=`
  - `POST .../events`
  - `/search/events`
  - `/events/swaps` [HISTSPEC]
- Portfolio, Charts, NFT, Token Details: Arbitrum supported (intro pages). Their specs were not ingested (see INDEX).

## 16. General error codes [ERRFAQ]
| Code | Meaning |
|---|---|
| 400 | bad parameter |
| 403 | banned/restricted origin address, or missing/incomplete key |
| 429 | rate limit |
| 503 | banned IP |

- Swap-specific messages: "Not enough src balance", "Not enough Allowance" (gives the spender, e.g. `0x1111111254eeb25477b68fb85ed929f73a960582`, which is the legacy v5 router in that doc example), "Insufficient liquidity", "Cannot sync token", "Amount is not set", "Src/Dst is not set".
- Machine-readable `code` values per endpoint: see sections 6, 10 and 11.

## 17. Latency and SLA
- Per-call latency for any API: **not stated** anywhere in the ingested docs.
- SLA: only "Enterprise is negotiated (custom limits, SLAs, and support)". [SUBS]
- Uptime and status page: "For uptime or incident updates, contact 1inch Support". [PRICING] FAQ
