# Etherscan API V2: verified fact sheet (for Chronos, Arbitrum One 42161)

Ingested 2026-11-26 via Firecrawl. Every line cites its source. "Not stated" means the ingested docs do not give the number. Raw page copies are in `pages/`. Short form `D:/x` means `https://docs.etherscan.io/x.md`.

---

## 1. Base URL, query format, envelope

- **Base URL:** `https://api.etherscan.io/v2/api`. Every endpoint is an HTTP `GET` with query parameters. (OpenAPI `servers` + `GET /v2/api` on every endpoint page, e.g. D:/api-reference/endpoint/getlogs)
- **Required parameters:** `chainid`, `module`, `action`, plus `apikey` (sent as the `apikey` query parameter). (D:/make-your-first-call; OpenAPI `securitySchemes.apiKey: in: query, name: apikey`)
- **Arbitrum example:**
  `https://api.etherscan.io/v2/api?chainid=42161&module=account&action=balance&address=0x...&tag=latest&apikey=$ETHERSCAN_API_KEY`
  The docs say: "The same key and endpoint work on every chain, just switch the chainid... set chainid=42161 to read the same address on Arbitrum." (D:/make-your-first-call)
- **One chain per request:** sending multiple chains such as `420, 10` triggers the error "Missing or unsupported chainid parameter (required for v2 api)". (D:/common-error-messages)
- **Exceptions to the `/v2/api` pattern:**
  - Chainlist is `GET https://api.etherscan.io/v2/chainlist`. It takes no parameters, and the supported-chains page says it needs no API key. (D:/api-reference/endpoint/chainlist, D:/supported-chains)
  - Usage is `module=getapilimit&action=getapilimit&apikey=...`, and its OpenAPI lists no chainid. (D:/api-reference/endpoint/getapilimit, D:/api-status)
- **REST response envelope:** `{"status":"1"|"0","message":"OK"|"NOTOK"|..., "result": ...}`.
  - On error, `result` holds the cause.
  - "A status of 0 can indicate an error or a valid request that returned no records." (D:/make-your-first-call; every OpenAPI `status` description)
- **Proxy (`module=proxy`) envelope:** JSON-RPC style `{"jsonrpc":"2.0","id":..,"result":..}`, with an `error` object on failure. For `eth_call`, `id` is "fixed... 1. This endpoint does not echo a caller-supplied ID." (D:/api-reference/endpoint/ethcall, ethsendrawtransaction)
- **Number encoding differs by module:**
  - `logs` returns hex strings (blockNumber, timeStamp, gasPrice, gasUsed, logIndex). (D:/api-reference/endpoint/getlogs)
  - `account` lists (txlist, tokentx, txlistinternal) return decimal strings. (D:/api-reference/endpoint/txlist)
- **Keys:**
  - One Etherscan key works on 50+ chains. (D:/set-up-your-api-key)
  - Old Arbiscan/Polygonscan keys are not valid for V2. (D:/common-error-messages)
  - New keys "take a few minutes to activate", and you should contact support after 10 minutes. (D:/common-error-messages)
- **Key security:** "Store keys in environment variables or a secrets manager... Never commit keys... Route API calls through your own backend." (D:/make-your-first-call)

## 2. V1 deprecation and Arbiscan

- V2 migration: "switch to API V2 by May 31, 2025. V1 API access will be disabled after this date." (https://info.etherscan.com/switch-to-etherscan-api-v2-by-may-31-2025/, published 14 May 2025)
- Final V1 shutdown: "API V1 will be fully deprecated by August 15, 2025. After that, all V1 requests will stop working." (https://info.etherscan.com/etherscan-api-v1-will-be-fully-deprecated-by-15th-august-2025/, published 30 July 2025)
- Migration steps: "Use the new base URL, add the chainid parameter, and keep the same query parameters as before." (same article)
- `https://docs.arbiscan.io/` now resolves to `https://docs.etherscan.io/introduction`. (Firecrawl scrape result; pages/arbiscan-redirect.md)
- The old V1 Arbiscan base URL `https://api.arbiscan.io/api` is cited in a third-party GitHub issue as a V1 endpoint to migrate. (github.com/livepeer/explorer/issues/304, search snippet only)

## 3. Arbitrum One availability

- Arbitrum One Mainnet, chain 42161, is "Free tier available". Arbitrum Sepolia 421614 is also "Free tier available". (D:/supported-chains)
- In chainlist, 42161 shows blockexplorer `https://arbiscan.io/`, apiurl `https://api.etherscan.io/v2/api?chainid=42161`, and status 1. (D:/api-reference/endpoint/chainlist, example)
- **Community Free API Limit for Arbitrum, effective November 1, 2026 (chains 42161 and 421614):**
  - "Each chain will have its own shared pool of free API calls available to all Free tier users collectively, rather than a separate allocation per API key."
  - "Once a chain's shared pool is depleted, Free tier requests on that chain will be temporarily unavailable until the pool resets."
  - (D:/changelog)
  - The size of the pool is not stated. The reset time is given in the error message.
- "Source code and ABI endpoints are available on all chains for every API plan, including the Free Tier." (D:/supported-chains)
- Plan coverage by tier:
  - Free covers "selected chains" ("Selected chains (90% coverage)"). (D:/rate-limits; https://etherscan.io/api/pricing)
  - Lite and above cover "All supported chains". (https://etherscan.io/api/pricing)
  - Arbitrum is therefore included in every plan, Free through Pro Plus.
- Gas Oracle chain badges are Ethereum, BNB, Polygon, Celo, Gnosis and Linea. Arbitrum is not listed, so whether gasoracle works for 42161 is not stated. (D:/api-reference/endpoint/gasoracle)

## 4. Plans, rate limits, prices

The rate and daily-limit columns come from D:/rate-limits. Prices and the use class come from https://etherscan.io/api/pricing (Firecrawl cache of 2026-11-26).

| Plan | Calls/sec | Calls/day | Chains | PRO endpoints | Monthly price (quarterly / yearly per-month) | Use class |
|---|---|---|---|---|---|---|
| Free | 3 | 100,000 | selected chains (Arbitrum included) | No | $0 | Personal & Research |
| Lite | 5 | 100,000 | all | No | $49 ($44.10 / $41.65) | Personal & Research |
| Standard | 10 | 200,000 | all | Yes | $199 ($179.10 / $169.15) | Personal & Research |
| Advanced | 20 | 500,000 | all | Yes | $299 ($269.10 / $254.15) | **Commercial Application** |
| Professional | 30 | 1,000,000 | all | Yes | $399 ($359.10 / $339.15) | Commercial Application |
| Pro Plus | 30 | 1,500,000 | all | Yes + PRO+ (getaddresstag) | $899 ($809.10 / $764.15) | Commercial; ONE app license |
| Dedicated/Custom | unmetered | unmetered | all | Yes | Contact | SLA |

- **Free-tier limit scope:** the free plan's limits are "cumulative across all the keys you have created". (D:/set-up-your-api-key)
- **Personal & Research use** "does not include use by or for a company, client, organization, internal business system, production service, or revenue-generating application." (https://etherscan.io/api/pricing FAQ)
- **Commercial Application use:** "customers with Advanced or higher plans may use API Services and API Data in their own application". The FAQ "forms part of Etherscan's Terms of Service". (same source)
- **PRO vs PRO+:** PRO means Standard and above. PRO+ means the Pro Plus plan. (D:/endpoint-overview)
- **Daily-limit enforcement, effective November 3, 2026:** "requests are blocked once you reach your plan's daily limit, unless overage is turned on." (D:/rate-limits)
- **Overage:**
  - Available on paid plans (Lite and above). It is off by default.
  - It costs $0.00003 per call ($3 per 100k) and is billed monthly with a monthly spend cap.
  - The per-second limit still applies.
  - The Free tier has no overage. (D:/rate-limits, D:/changelog)
- **Usage tracking:** an email reminder is sent near the limit. Usage can be read programmatically with `getapilimit`, which returns creditsUsed, creditsAvailable, creditLimit, limitInterval ("daily") and intervalExpiryTimespan. (D:/resources/best-practices, D:/api-reference/endpoint/getapilimit)
- **Keyless MCP server** (`https://mcp-keyless.etherscan.io/mcp`): "Rate limited, separate from API plans". It has 17 of 22 tools and no PRO tools. The numeric limit is not stated. (D:/build-with-ai/mcp)
- **Authenticated MCP server:** each tool call "makes one or more Etherscan API requests" against your plan. (D:/build-with-ai/mcp)

## 5. Error and limit responses (verbatim strings)

All errors use the form `{"status":"0","message":"NOTOK","result":"<string>"}`. (D:/common-error-messages)

- **Rate limit exceeded:** "Max rate limit reached, please use API Key for higher rate limit". Throttle the client, for example with a token bucket.
- **Arbitrum shared pool exhausted:** "Community Free API limit reached. Resets 2026-06-24 12:00:00 UTC. For higher, uninterrupted limits, please upgrade to API Pro: https://etherscan.io/apis". The date in this string is the docs example.
- **Chain not on Free:** "Free API access is not supported for this chain. Please upgrade your api plan for full chain coverage."
- **Bad key:** "Invalid API Key".
- **Repeated bad keys:** "Too many invalid api key attempts, please try again later". This fires after more than 5 invalid attempts in 30 seconds, throttles the source IP, and resets after 30 seconds.
- **Bad module or action:** "Error! Missing Or invalid Action name". This is also returned for a PRO endpoint on a testnet.
- **Bad or missing chainid:** "Missing or unsupported chainid parameter (required for v2 api), please see chainlist for the list of supported chainids".
- **Timeouts:** "Query Timeout occured. Please select a smaller result dataset" and "Unexpected err, timeout occurred or server too busy. Please try again later". Narrow the block or date range.
- **Endpoint-specific:** "Error! Block number already pass", "Error! Invalid address format", "Contract source code not verified".
- **getLogs with no topic:** returns `"result": "Error!"`. (D:/api-reference/endpoint/getlogs-topics)
- **Daily limit reached:** the docs describe "blocked" requests but give no error string. Not stated.

## 6. Paging and record caps

- **Paging parameters:** `page` and `offset` (records per page) on txlist, txlistinternal, tokentx, getLogs, and the others. (endpoint OpenAPI pages)
- **Free-tier cap, effective July 1, 2026:** "The maximum number of records returned per request will be reduced from 10,000 to 1,000 for Free tier API users." It applies to:
  - txlist, txlistinternal (by address), tokentx, tokennfttx, token1155tx
  - getLogs (Get Event Logs by Address), getminedblocks, txsbeaconwithdrawal, chainsize, txnbridge
  - "Update your integration... to paginate records in batches of 1,000 or fewer." (D:/changelog)
- **Paid-tier per-request cap:** 10,000 is implied by "reduced from 10,000" but not restated for paid plans. Treat it as inferred.
- **page × offset ceiling** (the total retrievable window per query): not stated in the ingested docs. Narrow `startblock`/`endblock` or `fromBlock`/`toBlock` rather than relying on deep pages. (D:/resources/best-practices: "Limit Your Block Range"; D:/resources/analytics-and-research: "Narrow fromBlock and toBlock to a window and page through results")
- **getLogs page size:** max records per page for the topics-only and address+topics variants is not stated separately. The changelog lists "Get Event Logs by Address" for the 1,000 cap.
- **Count limits:**
  - `balancemulti` takes at most 20 addresses per call. (D:/api-reference/endpoint/balancemulti)
  - `getcontractcreation` takes up to 5 contract addresses per call. (D:/api-reference/endpoint/getcontractcreation)
  - `balance`/`balancemulti` `tag` accepts a hex block "up to the last 128 blocks". Use balancehistory (PRO) for older blocks. (D:/api-reference/endpoint/balance)

## 7. Endpoints relevant to Chronos (parameters → response fields)

All endpoints use base `https://api.etherscan.io/v2/api` with `chainid=42161&apikey=...`. Required parameters are in **bold**.

### Logs (`module=logs&action=getLogs`): D:/api-reference/endpoint/getlogs, getlogs-topics, getlogs-address-topics

- **By address:** **address**, **fromBlock**, **toBlock** (integer), page, offset.
- **By topics:** **fromBlock**, **toBlock**, and at least one of topic0 to topic3.
  - Pairwise operators `topic0_1_opr`, `topic0_2_opr`, `topic0_3_opr`, `topic1_2_opr`, `topic1_3_opr`, `topic2_3_opr` take `and` or `or`. They apply only when both topics are set.
  - Also takes page and offset.
  - "Keep the range narrow to avoid timeouts."
- **Address + topics:** **address**, **fromBlock**, **toBlock**, topic0, topic0_1_opr, topic1, page, offset. That page's OpenAPI lists only topic0 and topic1.
- `toBlock=latest` appears in an official example. (D:/resources/analytics-and-research)
- **Response:** address, topics[] (topic0 = event signature hash), data, blockNumber, blockHash, timeStamp, gasPrice, gasUsed, logIndex, transactionHash, transactionIndex. All are hex.

### Accounts (`module=account`)

- **balance:** **address**, tag (latest or hex within the last 128 blocks). Returns wei. (D:/…/balance)
- **balancemulti:** **address** (up to 20, comma-separated), tag. Returns [{account, balance}]. (D:/…/balancemulti)
- **balancehistory (PRO):** listed only. Page not ingested.
- **txlist:** **address**, startblock, endblock, page, offset, sort (asc/desc). (D:/…/txlist) Returns:
  - blockNumber, blockHash, timeStamp, hash, nonce, transactionIndex, from, to, value
  - gas, gasPrice, input, methodId, functionName, contractAddress
  - cumulativeGasUsed, txreceipt_status, gasUsed, confirmations, isError
- **Advanced filter txlist (Beta):** `action=txlist` with from and/or to plus `fromto_opr` (and/or, required when from or to is given), startblock, endblock (number or `latest`), sort, page, offset. Same fields as txlist. The plan tier is not stated. (D:/…/advanced-filter-txlist)
- **txlistinternal by address:** **address**, startblock, endblock, page, offset, sort. (D:/…/txlistinternal) Returns blockNumber, timeStamp, hash, from, to, value, contractAddress, input, type (call/create/create2/self-destruct), gas, gasUsed, traceId, isError, errCode.
- **txlistinternal by txhash:** **txhash**. "**Only non-zero value internal transactions are returned.**" Returns the same fields without hash and traceId. (D:/…/txlistinternal-txhash)
- **txlistinternal by block range (PRO, Standard and above, since July 1, 2026):** **startblock**, **endblock**, page, offset, sort. Returns the same fields as by-address, including hash and traceId. (D:/…/txlistinternal-blockrange, D:/changelog)
- **tokentx (ERC-20):** contractaddress and/or address (at least one), startblock, endblock, page, offset, sort. (D:/…/tokentx)
  - Returns blockNumber, timeStamp, hash, nonce, blockHash, from, contractAddress (the token), to, value (smallest unit), tokenName, tokenSymbol, tokenDecimal, statusRep, transactionIndex, gas, gasPrice, gasUsed, cumulativeGasUsed, input (example shows "deprecated"), methodId, functionName, confirmations.
  - `statusRep` (0 Unknown, 1 Neutral, 2 Unsafe) is token reputation, not transaction success.
  - No logIndex field is listed.
- **Not ingested in full:** tokennfttx, token1155tx, the advanced-filter tokentx/internal variants, getminedblocks, txsbeaconwithdrawal, fundedby (PRO; EOA only). See INDEX.md.

### Contracts (`module=contract`): free on every plan and chain (D:/supported-chains)

- **getabi:** **address**. Returns a JSON-encoded ABI string, "Only available for verified contracts". (D:/…/getabi)
- **getsourcecode:** **address**. (D:/…/getsourcecode, D:/changelog) Returns:
  - SourceCode (empty if unverified), ABI, ContractName, CompilerVersion, CompilerType, OptimizationUsed, Runs
  - ConstructorArguments, EVMVersion, Library, ContractFileName, LicenseType
  - **Proxy** (`0` not proxy, `1` proxy, `2` minimal proxy since Sept 2, 2026) and **Implementation**
  - SwarmSource, SimilarMatch
- **getcontractcreation:** **contractaddresses** (up to 5). Returns contractAddress, contractCreator, txHash, blockNumber, timestamp, **contractFactory** ("factory contract that created it, if any"), creationBytecode. (D:/…/getcontractcreation)

### Transactions (`module=transaction`)

- **getstatus:** **txhash**. Returns {isError, errDescription}, for example "Bad jump destination". (D:/…/getstatus)
- **gettxreceiptstatus:** **txhash**. Returns {status: 1 success / 0 failure}. (D:/…/gettxreceiptstatus)

### Blocks (`module=block`)

- **getblocknobytime:** **timestamp** (Unix seconds), **closest** (`before`/`after`). Returns a block number string. (D:/…/getblocknobytime)
- **Listed only, not ingested:** getblockreward, getblocktxnscount, getblockcountdown, and the daily-* PRO endpoints.

### Tokens

- **tokenbalance:** `module=account&action=tokenbalance`, **contractaddress**, **address**, tag. Returns the balance in the smallest unit. (D:/…/tokenbalance)
- **tokensupply:** `module=stats&action=tokensupply`, **contractaddress**. (D:/…/tokensupply)
- **PRO and listed only:** tokensupplyhistory, tokenbalancehistory, topholders, tokenholderlist, tokenholdercount, tokeninfo, addresstokenbalance, addresstokennftbalance, addresstokennftinventory. (D:/endpoint-overview)

### Gas tracker (`module=gastracker`)

- **gasoracle:** no extra parameters. Returns LastBlock, SafeGasPrice, ProposeGasPrice, FastGasPrice, suggestBaseFee (all in gwei) and gasUsedRatio. Arbitrum support is not stated. (D:/…/gasoracle)
- **gasestimate, and dailyavggaslimit / dailygasused / dailyavggasprice (PRO):** listed only.

### Stats

- ethsupply, ethsupply2, ethprice, chainsize, nodecount, plus the PRO daily-* endpoints: listed only. (D:/endpoint-overview) `module=stats&action=dailytx` and `action=ethsupply` appear in examples. (D:/resources/analytics-and-research)

### Usage

- getapilimit (see §4) and chainlist (see §1).

## 8. Geth/Parity proxy (`module=proxy`): the full list and RPC-substitute verdict

The 14 documented methods: (D:/endpoint-overview)

- eth_blockNumber
- eth_getBlockByNumber
- eth_getUncleByBlockNumberAndIndex
- eth_getBlockTransactionCountByNumber
- eth_getTransactionByHash
- eth_getTransactionByBlockNumberAndIndex
- eth_getTransactionCount
- eth_sendRawTransaction
- eth_getTransactionReceipt
- eth_call
- eth_getCode
- eth_getStorageAt
- eth_gasPrice
- eth_estimateGas

Documented parameters (from the ingested pages):

| Method | Parameters |
|---|---|
| eth_blockNumber | none |
| eth_getBlockByNumber | tag (hex or `latest`), **boolean** (true = full tx objects) |
| eth_getTransactionByHash | **txhash**. Returns: blockHash, blockNumber, from, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, hash, input, nonce, to, transactionIndex, value, type, accessList, chainId, v, r, s, yParity |
| eth_getTransactionReceipt | **txhash**. Returns: blockHash, blockNumber, contractAddress, cumulativeGasUsed, effectiveGasPrice, from, gasUsed, **logs[]**, logsBloom, **status**, to, transactionHash, transactionIndex, type |
| eth_call | **to**, from (defaults to the zero address), data, gas, gasPrice, value (all hex; "Decimal values are read as hex"), tag (**"Only `latest` is supported."**) |
| eth_estimateGas | data, to, value, gasPrice, gas. No from or tag documented. |
| eth_getCode | **address**, tag (`latest`/`earliest`/`pending`/hex) |
| eth_getStorageAt | **address**, **position**, tag (`latest`/`earliest`/`pending`/hex) |
| eth_getTransactionCount | address, tag (`latest`/`earliest`/`pending`/hex) |
| eth_sendRawTransaction | **hex** (signed raw transaction), sent as a GET query parameter. The page shows only an error example. |

Facts relevant to using the proxy as an RPC:

- It is a subset of 14 methods. eth_getLogs, eth_chainId, eth_feeHistory, eth_getBlockReceipts, debug_* and trace_* are not among them. Logs go through `module=logs` instead. (D:/endpoint-overview)
- Every call counts against the plan rate limit of 3 to 30 calls/sec and the daily cap. (D:/rate-limits)
- WebSocket, subscriptions and JSON-RPC batching: not stated anywhere in the ingested docs.
- eth_call cannot target historical blocks (only `latest`). (D:/…/ethcall)

**Verdict (assessment, not a doc statement):** the proxy is not usable as Chronos's primary RPC. It is GET-only, has no batching or subscriptions, its rate limit is far below a node's, eth_call is latest-only, and it has no logs or trace methods. It is acceptable as a low-rate fallback and an independent cross-check, for example a second opinion on eth_blockNumber or a receipt. Do not send live arbitrage transactions through eth_sendRawTransaction on the hot path. The latency and ordering properties are not stated, and a private or sequencer-direct path is the norm for this kind of traffic. That last point is an assessment.

## 9. Other verified notes

- "Use the `page` and `offset` parameter to request only what you need". "Use the `startblock` and `endblock` parameter if your block range is known". Implement retry with backoff, because "TPS spikes... can occasionally cause timeouts." (D:/resources/best-practices)
- The status page is https://status.etherscan.io/. A health check is `module=proxy&action=eth_blockNumber`. (D:/api-status)
- Contract-source verification endpoints exist for Solidity, zkSync, Vyper, **Stylus** (relevant to Arbitrum), and proxy contracts. Listed only. (D:/endpoint-overview)
- Official MCP servers are `https://mcp.etherscan.io/mcp` (Bearer key) and `https://mcp-keyless.etherscan.io/mcp`. Marketplace listings called "Etherscan MCP" are unofficial, and you should not paste keys into them. (D:/build-with-ai/mcp)
