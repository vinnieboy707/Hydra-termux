# Configuration

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · **Configuration** · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

## Where settings live

- **`.env`** in your workspace (`~/workspaces/chronos-master-workspace/.env`), mode 600. Chronos reads it; it is
  never printed, synced or packaged.
- **Change one value:** `chronos set KEY VALUE` (checked against the ranges below). For a secret, run
  `chronos set KEY` with no value: it asks at a hidden prompt so the secret stays out of your shell history. Chronos
  never writes a signing key: `chronos deploy` and `chronos payout` use the owner key from your `.env` if you keep
  one there, otherwise they ask for it hidden, for that run only.
- **Cloud engine:** `chronos cloud-pack` writes `chronos-settings.env` with settings and public addresses only, never
  secrets, signing keys or the executor's identity.
- **Precedence:** a process environment variable overrides the same key in `.env`. `chronos set` rejects values
  outside a setting's range; `chronos doctor` reports settings that are missing or invalid.

## Scanner, measurement and connection settings

<!-- GENERATED:settings -->
### Scanner

| Setting | Range | Suggested | What it controls |
| --- | --- | --- | --- |
| `MIN_NET_PROFIT_USD` | 0.01 – 10000 | 0.05 | absolute minimum net profit per trade, USD (the floor is this or FLOOR_GAS_MULT × the route's gas, whichever is larger) |
| `FLOOR_GAS_MULT` | 0 – 20 | 2 | a trade must keep at least this many times its own gas cost (default 2; 0 = fixed floor only) |
| `MAX_SLIPPAGE_BPS` | 1 – 500 | 35 | max price impact per leg, basis points |
| `GAS_CEILING_GWEI` | 0.001 – 10 | 0.05 | gas gate: no trade above this gas price |
| `GAS_UNITS_ASSUMED` | 100000 – 5000000 | 900000 | gas units for flash loan + 2 swaps (calibrate it) |
| `SIZE_LADDER_USD` | 1 – 1000000 | 200,500,1000,2500,5000,10000,25000 | borrow sizes to try; smallest and largest are your limits |
| `SCREEN_SIZE_USD` | 1 – 1000000 | 1000 | size used to screen every route |
| `SCAN_TOPK` | 1 – 100 (whole) | 12 | routes that get the full size search |
| `OPT_REFINE_ITERS` | 0 – 64 (whole) | 16 | refinement steps after the ladder |
| `MIN_PROFIT_CAPTURE_BPS` | 0 – 10000 (whole) | 5000 | on-chain minProfit as share of quoted profit |
| `SLIPPAGE_PROBE_USD` | 0.01 – 10000 | 10 | small probe used to measure price impact |
| `DEADLINE_SECONDS` | 10 – 3600 (whole) | 120 | deadline in prepared contract calls |
| `SCAN_MAX_LEGS` | 2 – 5 (whole) | 4 | longest route tried (2 to 5; never more than your deployed contract accepts: v2.1+ takes 5, older 4; 5 costs many more quotes per scan) |
| `CHRONOS_DISCOVER_TOKENS` | 0 – 200 (whole) | 40 | tokens beyond Aave's reserves to look for pools between (nominated by the public token list, checked on-chain; 0 = off) |
| `HOT_SCAN_MS` | 0 – 60000 (whole) | 3000 | fast re-check of the closest routes between full scans, in ms (0 = off) |
| `DEPTH_MIN_FILL` | 0.05 – 0.99 | 0.5 | depth check: a pool whose small probe trade gets less than this share of its own quoted price is benched (it has a price but almost nothing behind it) |
| `DEPTH_MIN_USD` | 0 – 10000000 | 1000 | depth floor: a V2 pair holding less than this many USD on a priced side is left out of routing (unset: the larger of $1,000 and 5× your smallest trade size) |
| `DEAD_LOSS_PCT` | 1 – 50 | 5 | a route losing more than this % of its size at screening is a dead pool (benched, never shortlisted), not a missing price gap |
| `DEPTH_BENCH_HOURS` | 0.25 – 72 | 6 | hours a pool that failed the depth check stays out of routing before it is tried again |
| `RESEARCH_EVERY_MIN` | 10 – 1440 | 60 | minutes between competitor research runs on your primary device (flash loans and own-capital arbitrage from the chain, pooled in chain_trades) |
| `RESEARCH_SWAP_BLOCKS` | 0 – 20000 | 600 | how many of the newest blocks research reads every swap from to find own-capital arbitrage (600 ≈ 2.5 min; 0 = flash loans only). Larger reads more logs from your node |
| `SCAN_QUOTE_CYCLES` | 10 – 5000 (whole) | 400 | cycles that pass the price screen and get real quotes each scan |

### Measurement

| Setting | Range | Suggested | What it controls |
| --- | --- | --- | --- |
| `MEASURE_MINUTES` | 1 – 10080 (whole) | 60 | length of a measurement run |
| `MEASURE_INTERVAL_SEC` | 5 – 3600 (whole) | 20 | seconds between scans |
| `GO_MIN_EPISODES` | 1 – 100000 (whole) | 5 | GO needs at least this many opportunity episodes |
| `GO_MIN_DISTINCT_BLOCKS` | 1 – 100000 (whole) | 5 | GO needs opportunities in this many blocks |
| `GO_MIN_USD_PER_DAY` | 0 – 1000000000 | 5 | GO needs this projected $/day (upper bound) |

### Policies

| Setting | Range | Suggested | What it controls |
| --- | --- | --- | --- |
| `POLICY_T1_TAX_BPS` | 0 – 10000 (whole) | 3000 | T1: share of verified gross profit reserved for tax (3000 = 30%) |
| `MAX_DAILY_DRAWDOWN_USD` | 0 – 1000000000 | 25 | a realized loss this large in a UTC day switches live trading back to shadow |
<!-- /GENERATED:settings -->

## Execution policy

These limits govern the shadow ↔ live switch and every live send. Agents can propose changes only within them, and
only through an approval you grant in the portal.

<!-- GENERATED:policy -->
| Policy | Default | Allowed | What it does |
| --- | --- | --- | --- |
| `CHRONOS_MODE` | auto | auto / shadow | auto: switch to live by the rules below; shadow: never send |
| `EXEC_TIP_SHARE_BPS` | 5000 | 0 – 9000 | share of the surplus above your floor bid as priority fee (Arbitrum orders each 125 ms round by priority fee) |
| `EXEC_MAX_GAS_UNITS` | 1500000 | 200000 – 5000000 | gas limit cap per transaction |
| `MAX_DAILY_GAS_USD` | 5 | 0.1 – 1000 | gas you may lose to reverted transactions per UTC day; every send is sized so even a revert stays inside it, and reaching it switches back to shadow |
| `MAX_CONSECUTIVE_REVERTS` | 3 | 1 – 20 | reverted transactions in a row that switch back to shadow |
| `EXEC_MIN_GAS_ETH` | 0.002 | 0.0001 – 1 | executor ETH below this switches back to shadow (it cannot pay gas) |
| `EXEC_ROUTE_COOLDOWN_SEC` | 30 | 0 – 3600 | wait before sending the same route again |
| `PROMOTE_MIN_WINS` | 5 | 1 – 1000 | shadow wins in the last 24 h needed before live |
| `PROMOTE_MIN_WIN_RATE_BPS` | 6000 | 1000 – 10000 | share of shadow runs that must win before live |
| `GUARD_MIN_SENDS` | 5 | 1 – 100 | profit guard: after this many live sends in a UTC day, a realized net ≤ $0 switches back to shadow until the next day |
| `EXEC_SHADOW_TOPK` | 3 | 1 – 20 | best approved routes simulated each scan |
<!-- /GENERATED:policy -->

## Deploy policy

Limits `chronos deploy` applies when it sets up your contract.

<!-- GENERATED:deploypolicy -->
| Setting | Default | Allowed | What it does |
| --- | --- | --- | --- |
| `MAX_LOAN_HEADROOM_PCT` | 20 | 0 – 200 | per-asset loan cap above your largest ladder size, so a price move does not block the largest trade |
| `EXEC_GAS_TOPUP_ETH` | 0.005 | 0.001 – 0.1 | ETH the executor should hold for gas; only the shortfall is sent |
<!-- /GENERATED:deploypolicy -->

## Keys and secrets

Secrets are entered in `chronos setup` (hidden input), tested where the service allows a safe live test, and written
to `.env` with mode 600. They never appear in logs, the dashboard or the portal.

<!-- GENERATED:secrets -->
| Key | Group | Purpose | Check when entered |
| --- | --- | --- | --- |
| `ARB_RPC_URL` | Connection | Arbitrum One RPC url the console scans with (contains your provider key) | tested (live where the service allows) |
| `RPC_URL` | Connection | generic RPC url some of your scripts read | tested (live where the service allows) |
| `ARBITRUM_RPC_URL` | Connection | backup Arbitrum RPC url | tested (live where the service allows) |
| `ALCHEMY_RPC_URL` | Connection | Alchemy Arbitrum url | tested (live where the service allows) |
| `ARB_PRIVATE_RPC` | Connection | private / protected RPC url | tested (live where the service allows) |
| `ALCHEMY_API_KEY` | Connection | Alchemy API key (tested against its Arbitrum endpoint) | tested (live where the service allows) |
| `ARBITRUM_WSS_URL` | Connection | websocket url: the engine reacts to every new block | tested (live where the service allows) |
| `ARB_WSS_URL` | Connection | second websocket url (another provider) for a redundant block feed | tested (live where the service allows) |
| `ALCHEMY_WSS_URL` | Connection | Alchemy websocket url for a redundant block feed | tested (live where the service allows) |
| `ARBITRUM_WSS_URL_2` | Connection | another websocket url for a redundant block feed | tested (live where the service allows) |
| `OPENROUTER_API_KEY` | AI | OpenRouter key for AI agents (the only setting the AI agent needs: the model is chosen for you) | tested (live where the service allows) |
| `OPENROUTER_API_KEY_2` | AI | another OpenRouter key: used in turn with the others, each the fallback of the rest | tested (live where the service allows) |
| `OPENROUTER_API_KEY_3` | AI | another OpenRouter key (fallback in the rotation) | tested (live where the service allows) |
| `OPENROUTER_API_KEY_4` | AI | another OpenRouter key (fallback in the rotation) | tested (live where the service allows) |
| `OPENROUTER_API_KEY_5` | AI | another OpenRouter key (fallback in the rotation) | tested (live where the service allows) |
| `ANTHROPIC_API_KEY` | AI | Anthropic API key: Claude directly, in the same rotation as your OpenRouter keys | tested (live where the service allows) |
| `CHRONOS_ANTHROPIC_MODEL` | AI | Claude model for ANTHROPIC_API_KEY (default claude-sonnet-5-5) | tested (live where the service allows) |
| `CHRONOS_OWNER_SIGNER` | Safety | how owner actions (deploy, setup, payouts) are signed: metamask (you approve each one in MetaMask on a local page; the key never leaves MetaMask) or keystore (default: your encrypted keystore passphrase). One run: add --metamask | tested (live where the service allows) |
| `CHRONOS_DAILY_SPEND_CAP_USD` | Safety | most a day (UTC) may cost in things no profit pays back: reverted trades' gas, AI calls (default 5). Anything that could go over it waits until the next day; trades that fit keep running | tested (live where the service allows) |
| `CHRONOS_WATCHDOG_STALL_SEC` | Safety | seconds the engine's loop may go without a sign of life before the watchdog restarts it (default 300, at least 60; off to turn it off) | tested (live where the service allows) |
| `CHRONOS_AI_CALL_USD` | AI | what one AI call is counted as against the daily spending cap (default 0.02 dollars) | tested (live where the service allows) |
| `CHRONOS_VP_AI_MAX_PER_DAY` | AI | most AI analyses the VP may run a day (default 12; 0 turns the analyst off) | tested (live where the service allows) |
| `CHRONOS_VP_AI_MIN_GAP_MIN` | AI | minutes between two AI analyses (default 60) | tested (live where the service allows) |
| `CHRONOS_MIND_MAX_CELLS` | AI | most cells the honeycomb mind may hold (default 120; it grows by 15 per open task up to this) | tested (live where the service allows) |
| `CHRONOS_RELAY` | Connection | price-move relay through your Supabase: share the pools your node sees move and re-quote the ones other engines saw move (default on; off to stop) | tested (live where the service allows) |
| `CHRONOS_MORPHO` | Connection | Morpho Blue address that research reads for fee-free flash loans (default: Arbitrum One's 0x6c247b1F…8F5e; off to skip) | tested (live where the service allows) |
| `CHRONOS_UNI_V4` | Connection | Uniswap V4 PoolManager the engine borrows from with no fee when your contract is v2.3+ (default: Arbitrum One's 0x360E68fa…FB32; off to skip) | tested (live where the service allows) |
| `CHRONOS_TEMPO_MAX` | Connection | how far the engine may speed up when scans find real gaps: 0 (never) to 3 (scans 3× as often, 2.5× routes quoted; default 3), always inside each node's plan | tested (live where the service allows) |
| `CHRONOS_ARCHIVE_FROM` | AI | extra folders (comma-separated) the VP's documentation archive indexes, secrets skipped | tested (live where the service allows) |
| `CHRONOS_VP_NUDGE_HOURS` | Company | hours between the VP's reminders about a road-to-cash step that is yours (default 3) | tested (live where the service allows) |
| `CHRONOS_VP_AUDIT_MIN` | Company | minutes between the VP's audits after its tasks (your checks + Blockscout + next step; default 30) | tested (live where the service allows) |
| `CHRONOS_VP_QUIET` | Company | quiet hours for those reminders, local time HH-HH (default 21-08; milestone results and money alerts still come) | tested (live where the service allows) |
| `CHRONOS_INDICATOR_RETIRE_DAYS` | Company | days an indicator may run without firing once before it is retired (default 7; it comes back the first time it would fire) | tested (live where the service allows) |
| `CHRONOS_REPORT_TIME` | Company | local time the VP writes your daily report (HH:MM, 24 h; default 07:30) | tested (live where the service allows) |
| `CHRONOS_AUTO_UPDATE` | Company | install newer releases by itself (on, the default; off: only notify). Only releases your publishing device signed, sha256-verified; your .env and data are kept; contract changes still need chronos deploy | tested (live where the service allows) |
| `CHRONOS_TZ` | Company | your time zone for the daily report (IANA name; default America/Los_Angeles) | tested (live where the service allows) |
| `CHRONOS_ALERT_WEBHOOK_URL` | Alerts | where incidents, resolution attempts and escalations go as signed JSON. Empty: your portal (your project's alerts function, device-signed). Your own https url, or off | tested (live where the service allows) |
| `CHRONOS_ALERT_WEBHOOK_SECRET` | Alerts | shared secret for the webhook signature (x-chronos-signature: HMAC-SHA256 over timestamp.body) | tested (live where the service allows) |
| `CHRONOS_AGENT_MODEL` | AI | OpenRouter model id for the AI agent (provider/model). Empty: the newest Claude Sonnet OpenRouter lists | tested (live where the service allows) |
| `SUPABASE_URL` | Data services | Supabase project url | tested (live where the service allows) |
| `SUPABASE_SERVICE_KEY` | Data services | Supabase service-role key (full database access: keep private) | tested (live where the service allows) |
| `DATA_GOV_API_KEY` | Data services | api.data.gov key (GovInfo, federal data) | tested (live where the service allows) |
| `RAPIDAPI_KEY` | Data services | RapidAPI key | tested (live where the service allows) |
| `CARSXE_API_KEY` | Data services | CarsXE vehicle data key | tested (live where the service allows) |
| `VERYFI_CLIENT_ID` | Data services | Veryfi client id | tested (live where the service allows) |
| `VERYFI_USERNAME` | Data services | Veryfi username | tested (live where the service allows) |
| `VERYFI_API_KEY` | Data services | Veryfi API key | tested (live where the service allows) |
| `IDSCAN_API_KEY` | Data services | IDScan key | tested (live where the service allows) |
| `IDSCAN_BEARER_TOKEN` | Data services | IDScan bearer token | tested (live where the service allows) |
| `HERITAGEDEED_API_KEY` | Data services | HeritageDeed key | tested (live where the service allows) |
| `GOOGLE_DRIVE_FOLDER_ID` | Google | Drive folder id used by sync scripts | tested (live where the service allows) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google | path to your service-account JSON file (the path, not the contents) | tested (live where the service allows) |
| `CHRONOS_SYNC_URL` | Cloud | Supabase ingest URL (portal data) | tested (live where the service allows) |
| `CHRONOS_WEBHOOK_URL` | Alerts | where phone-style alerts also go. Empty: your portal (money made or lost, errors). Your own https url (Discord/Slack style), or off | tested (live where the service allows) |
| `ARB_WEBHOOK_URL` | Alerts | webhook for Arbitrum events | tested (live where the service allows) |
| `ARB_RPC_URL_2` | Connection | a second Arbitrum node from ANOTHER provider: verifies balances at the same block and broadcasts your trades twice | tested (live where the service allows) |
| `ARB_RPC_URL_4` | Connection | another Arbitrum node (any provider): scans in turn with the others, inside its plan | tested (live where the service allows) |
| `ARB_RPC_URL_5` | Connection | another Arbitrum node (any provider): scans in turn with the others, inside its plan | tested (live where the service allows) |
| `INFURA_API_KEY` | Connection | Infura API key alone (its Arbitrum url and websocket are built from it) | tested (live where the service allows) |
| `SWIFTNODES_API_KEY` | Connection | SwiftNodes API key alone (its Arbitrum url and websocket are built from it) | tested (live where the service allows) |
| `INFURA_PLAN` | Connection | your Infura plan: free, developer, team or custom (Chronos keeps inside its credits) | tested (live where the service allows) |
| `SWIFTNODES_PLAN` | Connection | your SwiftNodes plan: free, starter, growth, scale, pro or custom | tested (live where the service allows) |
| `DRPC_ARB_URL` | Connection | your dRPC Arbitrum endpoint, copied from your dRPC dashboard (paced inside DRPC_PLAN) | tested (live where the service allows) |
| `DRPC_PLAN` | Connection | your dRPC plan: free (25 req/s, batches of 3), payg (100), pro (300) or scale (600) | tested (live where the service allows) |
| `ANKR_ARB_URL` | Connection | your Ankr Arbitrum endpoint (https://rpc.ankr.com/arbitrum/… from your Ankr dashboard) | tested (live where the service allows) |
| `ANKR_PLAN` | Connection | your Ankr plan: public, freemium (1M calls a month) or premium (websocket, 1.5k req/s) | tested (live where the service allows) |
| `CHAINSTACK_ARB_URL` | Connection | your Chainstack Arbitrum node url (https://….core.chainstack.com/…) | tested (live where the service allows) |
| `ONEINCH_API_KEY` | Data services | your 1inch Business API key (business.1inch.com/portal; one key covers every 1inch API): routing, prices and liquidity sources on Arbitrum. Tested with a read-only call on Arbitrum One | tested (live where the service allows) |
| `ETHERSCAN_API_KEY` | Data services | your Etherscan API key (etherscan.io/myapikey; API V2 covers Arbitrum One with chainid=42161): competitor trades, contract and pool lookups, receipts. Tested with a read-only call on Arbitrum One | tested (live where the service allows) |
| `GETBLOCK_API_KEY` | Connection | your GetBlock API key: the access token of an Arbitrum One endpoint in your GetBlock dashboard (create the endpoint for Arbitrum mainnet; the key is the long string after the host). Tested against Arbitrum One at GETBLOCK_REGION | tested (live where the service allows) |
| `GETBLOCK_REGION` | Connection | where your GetBlock endpoint was created: us-east-1 (New York, default), eu-central-1 (Frankfurt) or ap-southeast-1 (Singapore) | tested (live where the service allows) |
| `GETBLOCK_ARB_URL` | Connection | your GetBlock Arbitrum One endpoint (https://shared.<region>.getblock.io/<access token>/, from your GetBlock dashboard; paced inside GETBLOCK_PLAN) | tested (live where the service allows) |
| `GETBLOCK_PLAN` | Connection | your GetBlock plan: free (50,000 CU a day, 20 req/s: about 2,500 Arbitrum calls a day), starter (90M CU a month, 250 req/s), growth, advanced, scale, pro, premium or dedicated | tested (live where the service allows) |
| `CHAINSTACK_PLAN` | Connection | your Chainstack plan: developer (25 req/s, logs 100 blocks), growth (250) or business (600) | tested (live where the service allows) |
| `CHRONOS_PUBLIC_NODES` | Connection | on: also use keyless public nodes (dRPC https://arbitrum.drpc.org) as paced failover | tested (live where the service allows) |
| `CHRONOS_PRIMARY_NODE` | Connection | node key that scans (unset: chosen by plan) | tested (live where the service allows) |
| `ARB_RPC_URL_3` | Connection | a third Arbitrum node from yet another provider (e.g. SwiftNodes): another failover and balance check | tested (live where the service allows) |
| `CHRONOS_FLASH_ARB_ADDRESS` | Execution | your deployed ChronosFlashArb contract | tested (live where the service allows) |
| `CONTRACT_ADDRESS` | Execution | an older contract name other tools also use: Chronos uses it only after checking on-chain that it is a Chronos contract, then saves it as CHRONOS_FLASH_ARB_ADDRESS | tested (live where the service allows) |
| `CHRONOS_EXECUTOR_KMS_KEY` | Execution | Cloud KMS HSM key version that signs trades (printed by cloud/gcp-setup.sh); the key itself never leaves Google | tested (live where the service allows) |
| `CHRONOS_EXECUTOR_ADDRESS` | Execution | your executor (an operator on your contract): signs trades through the Cloud KMS key, or on this phone through the key agent (chronos executor import); without either, the shadow test runs from it | tested (live where the service allows) |
| `CHRONOS_DRIVE_ENV_FOLDER` | Cloud | the Google Drive folder that holds your env files: the key pull on update reads only that folder (fast) instead of listing your whole Drive | tested (live where the service allows) |
| `CHRONOS_VOICE_ENGINE` | Voice | the Android voice engine chronos narrate speaks with (chronos narrate --voices lists them; empty = your phone default) | tested (live where the service allows) |
| `CHRONOS_VOICE_LANG` | Voice | voice language for chronos narrate, e.g. en | tested (live where the service allows) |
| `CHRONOS_VOICE_REGION` | Voice | voice region for chronos narrate, e.g. US or GB | tested (live where the service allows) |
| `CHRONOS_VOICE_VARIANT` | Voice | a specific voice of your Android engine (the variant name your engine lists) | tested (live where the service allows) |
| `CHRONOS_VOICE` | Voice | Mac only: the voice name for chronos narrate (say -v ? lists them) | tested (live where the service allows) |
| `CHRONOS_VOICE_RATE` | Voice | speaking speed for chronos narrate (1.0 normal, 1.2 a bit faster) | tested (live where the service allows) |
| `CHRONOS_VOICE_PITCH` | Voice | voice pitch for chronos narrate (1.0 normal) | tested (live where the service allows) |
| `CHRONOS_NARRATE_SCAN_SEC` | Voice | seconds between routine scan reports in the commentary (anything notable is said at once) | tested (live where the service allows) |
| `CHRONOS_PORTAL_URL` | Alerts | your portal page (https://…): the buttons in the daily report email open it | tested (live where the service allows) |
| `CHRONOS_SCAN_MODE` | Connection | burst (default): every scan read spread over all your nodes at once, a rate limit fails over at once; paced: one node per scan inside each plan's pace | tested (live where the service allows) |
| `CHRONOS_BURST_NODES` | Connection | free (default): burst only nodes whose plan refuses past its limit (no bill); all: every node, even ones that may bill per request | tested (live where the service allows) |
| `CHRONOS_RPC_TIMEOUT_MS` | Connection | burst mode: a node slower than this (ms) is skipped for the request and cools down (default 2500) | tested (live where the service allows) |
| `CHRONOS_BURST_GAP_MS` | Connection | burst mode: pause between scans in ms (default 0: the next scan starts when one ends) | tested (live where the service allows) |
| `CHRONOS_SEQUENCER_BROADCAST` | Connection | on (default): trades are also sent through Arbitrum's public endpoint, so they get out when your nodes are rate-limited; off to stop | tested (live where the service allows) |
| `CHRONOS_AGENT_MAX_TX_ETH` | Execution | the most worst-case gas (gas limit × max fee) the phone key agent signs for one trade (default 0.05 ETH; read at chronos executor unlock) | tested (live where the service allows) |
| `PAYOUT_WALLET_ADDRESS` | Wallet addresses (public) | where profit is paid | tested (live where the service allows) |
| `TAX_RESERVE_VAULT` | Wallet addresses (public) | Policy T1 tax reserve address | tested (live where the service allows) |
| `GAS_WALLET_ADDRESS` | Wallet addresses (public) | wallet that pays gas | tested (live where the service allows) |
| `OPERATING_TREASURY` | Wallet addresses (public) | operating treasury address | tested (live where the service allows) |
<!-- /GENERATED:secrets -->

## Advanced and platform variables

Everything else the code reads from the environment. Your settings are above; these are tuning knobs, locations,
values Termux or the system set, and hooks the tests use. `test/envkeys.test.cjs` fails if the code reads a variable
that is not documented on this page. The example `.env` (`.env.scanner.example`) lists every setting you can set and is
generated from the same lists.

<!-- GENERATED:envkeys -->
### Advanced tuning (leave unset unless you have a reason)

| Variable | Default | What it does |
| --- | --- | --- |
| `SCAN_CONCURRENCY` | 6 | parallel chain reads during market discovery |
| `SCAN_PARALLEL` | 64 | parallel quote calls during a scan (the resolver halves it under load) |
| `QUOTE_BATCH` | 100 | calls per Multicall3 batch to start with (it grows per node while the node accepts full batches) |
| `SCAN_MAX_POOL_DEVIATION_BPS` | 2000 | a pool priced more than this far from the Aave oracle (or its pair's other pools) is broken (drained or abandoned) and left out of routing |
| `QUOTE_BATCH_MAX` | 500 | most quote calls packed into one Multicall3 eth_call (fewer billed calls; a node that refuses gets smaller batches) |
| `MARKET_CACHE_MIN` | 360 | minutes a discovered market list is reused before rediscovery |
| `SCAN_EXTRA_TOKENS` | — | extra token addresses to scan (comma separated), beyond Aave reserves and discovered tokens |
| `CHRONOS_BALANCER_VAULT` | the Balancer V2 vault | "off" ignores Balancer flash loans; an address overrides the vault |
| `CHRONOS_PROBE_DUMP_WETH` | 300 | WETH the contract v2 probe sells inside its eth_call to make its own price gap |
| `CHRONOS_PROBE_GAS` | 300000000 | gas limit of the contract v2 probe eth_call (lower it if your RPC caps eth_call gas) |
| `CHRONOS_PORTAL_SUPABASE_URL` | your Supabase project | portal database the portal-backend real check asks |
| `CHRONOS_PORTAL_PUBLISHABLE_KEY` | the portal's publishable key | public key the portal-backend real check uses (row-level security, not secrecy, protects data) |
| `CHRONOS_BLOCKSCOUT_URL` | https://arbitrum.blockscout.com | second, independent source that confirms wallet balances before they are shown ("off": only a second RPC confirms) |
| `CHRONOS_SET_LABEL` | — | internal: the prompt chronos keys shows for chronos set |
| `CHRONOS_NO_RESTART` | — | any value: chronos set saves without restarting the engine (chronos keys sets it, then restarts once) |
| `CHRONOS_IMPORT_FROM` | — | extra folders or files (comma-separated) chronos keys and chronos setup search for your keys, e.g. a workspace you copied from another machine |
| `CHRONOS_NO_AUTO_IMPORT` | — | any value: chronos setup does not look for keys in other files |

### Where things are

| Variable | Default | What it does |
| --- | --- | --- |
| `ENV_FILE` | found automatically | path of your .env (the service sets it for the engine) |
| `CHRONOS_WORKSPACE` | the folder holding your .env | workspace folder |
| `CHRONOS_DATA_DIR` | <console>/data | runtime data folder (history, state, logs) |
| `CHRONOS_VENUES_FILE` | <console>/venues.json | venue list file |
| `CHRONOS_DEVICE_KEY` | ~/.chronos/device.key | this device's Ed25519 key file |
| `CHRONOS_RELEASE_BASE` | your Supabase release function | release service address |
| `CHRONOS_WS` | ~/workspaces/chronos-master-workspace | workspace folder the installer (go.sh) installs into |
| `CHRONOS_DEVICE_NAME` | the phone's host name | name this device enrolls under (installer) |
| `CHRONOS_TGZ` | newest ~/chronos-console*.tgz | archive the cloud setup installs (Cloud Shell) |
| `CHRONOS_SETTINGS` | ~/chronos-settings.env | settings pack the cloud setup reads (Cloud Shell) |

### Set by Termux, the system or Chronos

| Variable | Default | What it does |
| --- | --- | --- |
| `TERMUX_VERSION` | set by Termux | marks a phone (automatic updates, phone checks) |
| `PREFIX` | set by Termux | Termux install prefix (where the chronos command goes) |
| `HOME` | set by the system | home folder |
| `PATH` | set by the system | command search path |
| `TMPDIR` | set by the system | temporary folder (installer) |

### Test hooks (never set on a real device)

| Variable | Default | What it does |
| --- | --- | --- |
| `CHRONOS_AAVE_POOL` | Aave V3 Pool on Arbitrum One | Aave pool address override (local test chain) |
| `CHRONOS_ROLE_FILE` | ~/.chronos/role | where this device keeps its role (primary / standby); tests point it at a temporary file |
| `CHRONOS_WETH` | WETH on Arbitrum One | WETH address override (local test chain) |
| `CHRONOS_MULTICALL` | Multicall3 | Multicall3 address override (local test chain) |
| `CHRONOS_KMS_ENDPOINT` | Cloud KMS | KMS API address override (KMS stand-in) |
| `CHRONOS_METADATA_TOKEN_URL` | the VM metadata server | token address override (KMS stand-in) |
<!-- /GENERATED:envkeys -->

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · **Configuration** · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
