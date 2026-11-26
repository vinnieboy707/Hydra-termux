# Changelog

<!-- GENERATED:nav -->
[Project home](README.md) · [Docs home](docs/README.md) · [Company](docs/COMPANY.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Commands](docs/COMMANDS.md) · [Operations](docs/OPERATIONS.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Releasing](docs/RELEASING.md) · [Server API](docs/API.md) · **Changelog**
<!-- /GENERATED:nav -->

Every release has an entry here before it can be packaged (`chronos docs --check` enforces it). Newest first.
Versions follow MAJOR.MINOR.PATCH: MAJOR for changes in how the engine finds or sends trades, MINOR for new
capabilities, PATCH for fixes and reporting.

## Version map
Each version is a milestone your live data proves (your portal's "Road to mainnet" shows which are met), not a
feature list. A version number is used only once its milestone is real.

| Version | Milestone | Proven by |
| --- | --- | --- |
| 2.9 | Foundations: one contract rule, alerts to your portal, executor hand-off, path-to-profit data, insights, watchdog, road to mainnet | this release |
| 3.0 | Contract v2 live on Arbitrum One; every real check passes against your own address | Road to mainnet steps 2 and 3 |
| 4.0 | Cloud HSM engine live: VM running, KMS executor an operator with gas, both engines reporting | steps 4 and 5 |
| 5.0 | Profit gap closed in the model: measured gas per leg, sizes that fit each pool, the cheaper lender per route | the Path to profit panel shows routes at or above your floor |
| 6.0 | Speed: act on the block feed before a full scan, prepared calls, two nodes racing | shadow runs reach simulation within the same block |
| 7.0 | Shadow wins on mainnet and LIVE by your promotion rules | steps 6 and 7 |
| 8.0 | First profit verified from receipts, 30% to the tax reserve | step 8 |
| 9.0 | 30 days net positive, risk limits holding, payouts running | 30 days of executions |
| 10.0 | Scale: contract v2 independently audited before more capital; more strategies and assets | the audit report |

## 2.9.19 — 2026-11-26
Burst mode, and small trades as one approved decision.
- Burst mode (default; CHRONOS_SCAN_MODE=paced for the old behaviour): every scan read is spread over all your nodes
  at once, request by request (lib/fan.cjs). A rate limit (429, "limit exceeded", also inside a 200 answer), a daily
  quota or a slow node (CHRONOS_RPC_TIMEOUT_MS, 2.5 s) is never retried on that node: the same request goes to the
  next node at once and that node cools down (Retry-After, else 1 s doubling to 60 s; a daily quota until its reset).
  Before, ethers retried the same node up to 12 times with growing waits and waited up to 5 minutes on a hung node
  ("exceeded maximum retry limit"). Scans run back to back (CHRONOS_BURST_GAP_MS, 0) and the fast lane uses the fan.
- What burst mode never does: use a node whose plan can bill per request (dRPC pay-as-you-go, Ankr premium,
  Chainstack paid, Alchemy, QuickNode, unknown) unless CHRONOS_BURST_NODES=all; spend your first node (ARB_RPC_URL),
  which stays the send lane for the executor's reads, simulation and the trade; run on a standby engine.
- Trades are also broadcast through Arbitrum's public endpoint (arb1.arbitrum.io, free, to the sequencer), so a trade
  gets out when every node of yours is rate-limited (CHRONOS_SEQUENCER_BROADCAST=off to stop).
- `chronos tune small-trades`: research change #1 as one decision: sizes from $25 (25,50,100,200,500,1000,2500,5000),
  screening at $100, floor $0.05 and 1.5× the route's own gas; shows before → after, applies only on YES (capitals);
  `chronos tune undo` puts your values back (data/tune-backup.json, kept).
- verify-real adds burst-nodes (each node in the burst answers as Arbitrum through the fast-fail client).
- 8 tests, 6 planted bugs.

## 2.9.18 — 2026-11-26
The liquidation measurement: read-only, before anything is built.
- `chronos liquidations [days] [--arbitrum|--base]` (default 14 days, both chains): every Aave V3 LiquidationCall on
  Arbitrum One and Base through Etherscan API V2 (your ETHERSCAN_API_KEY; one key, both chains; about 3 calls a
  second): debt repaid and collateral seized in USD, the liquidator's bonus, gas, what was kept, how many went
  through Chainlink SVR's Atlas auction, distinct liquidators and the top three's share. Then the build gates from
  the research (median kept > $1, ≥ 10 winners, ≥ 5 a day) and a plain verdict. Saved to
  data/research/liquidations-<date>.json. Nothing is sent, nothing is spent.
- Limits it states: Aave oracle prices now (exact for the bonus, approximate for USD totals); the auction winners'
  bids are not visible yet, so their kept is shown before the bid and the gate uses liquidations outside the auction.
- verify-real adds aave-liquidation-sources (both Aave pools answer through Etherscan).
- Fix (update check, Drive: "rclone: ERROR : Using --filter is recommended instead of both --include and --exclude"):
  the pull passed --include and --exclude together, whose order rclone leaves undefined; it reported an ERROR and
  pulled nothing. It now passes ordered --filter rules: every exclusion first, then the env patterns, then "- **".
- Registry audit: for each wrong entry it now asks the labelled venue's factory for the right pool (getPool for V3,
  getPair for V2) from the tokens and fee tier the entry names, and says what the address really is ("nothing is
  deployed here", "a contract but not a pool"). `chronos audit --fix` writes src/registry.corrected.ts next to your
  file with the looked-up addresses; your file is never changed. (The remaining mismatches in your registry are real:
  a WETH/USDC entry names bridged USDC.e 0xff970a61… but the pool trades native USDC; a WBTC/WETH entry's address is
  not a pool.)
- Dependencies: the runtime (ethers 6.17.0, the latest; ws 8.21.0) has 0 known vulnerabilities (npm audit
  --omit=dev). The compiler (solc 0.8.24) and OpenZeppelin 5.4.0 stay pinned: they reproduce your deployed contract
  byte for byte. The 9 warnings are in the test tools only (ganache, discontinued; solc's tmp), never installed on
  your devices.
- 5 tests, 5 planted bugs.

## 2.9.17 — 2026-11-26
A live voice that explains what Chronos is doing.
- `chronos narrate`: the engine's live commentary, read aloud as it happens: start-up, every notable scan (routine
  ones at most once a minute: block, pools, routes checked, the closest route and how far it is from your floor, dead
  pools set aside), mode changes, pause and resume, safe mode, problems and when they clear, executor ready or not,
  competitor research results, approved routes, settled trades. Never a url or a key.
- Keys: space or p = pause / resume (the line that was cut off is read again), n = next, r = repeat, q = quit. Your
  place is kept (data/live/narration.cursor): the next `chronos narrate` starts at the first line you have not heard.
  Back after more than 20 lines: routine scans are summed up in one sentence, everything else is read in full.
- The engine writes the commentary whether or not anyone listens (data/live/narration.jsonl, kept to 3,000 lines).
- The voice is your device's own text-to-speech (free, on the phone through Termux:API: `pkg install termux-api`):
  `chronos narrate --voices` lists the engines; CHRONOS_VOICE_ENGINE, _LANG, _REGION, _VARIANT, _RATE, _PITCH pick and
  tune it (Mac: CHRONOS_VOICE). Claude's own voice-mode voices are not available outside the Claude app.
- verify-real adds narrate-voice. 4 tests, 4 planted bugs.

## 2.9.16 — 2026-11-26
Competitor research works again, and it now sees how the winners actually trade.
- Fix (your chain_trades table was empty): since 2.9.8 research stopped on the Curve venue (no factory, it lists
  pools) every run, so no competitor trade ever reached your database. Curve pools are now mapped by address.
- Research finds own-capital arbitrage, not only flash loans: the winners on Arbitrum mostly trade their own money
  (6 of 8 flash loans traced on 2026-11-26 were not arbitrage). Every swap in the newest RESEARCH_SWAP_BLOCKS blocks
  (600 ≈ 2.5 min) is grouped by transaction; a transaction through two or more pools whose trader ended with no token
  less and one token more is recorded as an arbitrage (lender "own capital"); an ordinary multi-pool swap is not.
- Research runs by itself every RESEARCH_EVERY_MIN (60) on your primary device, not only when the VP asks; results
  go to chain_trades and feed the route priors and the venues-you-lack list.
- 2 tests, 2 planted bugs.

## 2.9.15 — 2026-11-26
- Fix (verify-real "blockscout-witness" failing): Blockscout indexes a few seconds behind the chain, and the check
  failed whenever it was 40+ blocks (10 s) behind your node. Now only your node falling more than 240 blocks (about a
  minute) behind the witness fails; a lagging witness is noted as normal. When Blockscout does not answer (it began
  asking for keys in 2026), Etherscan API V2 with your ETHERSCAN_API_KEY is the witness instead (lib/etherscan.cjs).
- Fix (money panel, stage 3): "416 pools found, but no token pair has two pools to compare" was shown whenever a scan
  ended with no candidate. It now says what happened: routes set aside through dead or thin pools (with counts), or
  no cycle with a gap after fees this scan; the old line only when it is true.
- Etherscan documentation ingested: docs/vendor/etherscan/FACTS.md (plans, Arbitrum on the free tier, limits).
- 3 tests, 2 planted bugs.

## 2.9.14 — 2026-11-26
- Fix: the 1inch key check called `api.1inch.dev` (retired; 1inch moved to `api.1inch.com`, docs at
  business.1inch.com/portal), so 2.9.13 could refuse a good key. It now calls the documented
  `https://api.1inch.com/gas-price/v1.6/42161`; HTTP 402 (gateway did not take the key) counts as refused.
- 1inch documentation ingested (200 pages, 14 API specs): docs/vendor/1inch/FACTS.md.

## 2.9.13 — 2026-11-26
1inch and Etherscan keys from the terminal.
- `chronos set ONEINCH_API_KEY` and `chronos set ETHERSCAN_API_KEY`: typed at a hidden prompt, saved only in your
  .env (600), never shown. Each is checked live with a read-only call on Arbitrum One (1inch gas price API with the
  Bearer key; Etherscan API V2, chainid 42161). A key the service refuses is not saved; with no connection it is saved
  as "not verified". `chronos verify-real` adds data-apis (both keys, live).
- 2 tests, 2 planted bugs.

## 2.9.12 — 2026-11-26
The engines no longer die on a websocket hiccup, the scan stops chasing dead pools, the two update warnings are fixed,
and your emails became a real report.
- Fix (all four engines stopped at 22:59 PT on 2026-11-25): a websocket feed that failed or was closed while still
  connecting ("WebSocket was closed before the connection was established", "connect ECONNREFUSED") raised an error
  nothing listened for, and ended the engine; five in ten minutes put it in safe mode. The feed now listens from the
  first moment and reconnects. Leftovers of a connection already closed ("provider destroyed; cancelled request")
  are logged, never fatal; any other error, or more than 50 leftovers in 10 minutes, is still fatal.
- Fix: a node that is rate-limited or out of quota ("exceeded maximum retry limit") no longer holds start-up on the
  same node forever: each 60 s retry moves to your next https node. The "cannot start" alert is sent at most hourly.
- Fix (server): the same alert within 30 minutes is no longer emailed again (numbers aside), so repeats cannot use up
  the 40 emails a day and hide the next, different alert (last night the "engine silent" emails were never sent).
  Verified steps, money, successes and the daily report are always sent.
- Emails: the daily report is a professional HTML page: money verified from receipts, how many steps are left from
  today to $100,000 and the next one with its command, the road to cash with who acts, the new profit ladder
  ($1 → $100,000, with what you keep after the 30% tax reserve), what needs you, trading and risk, VP decisions, and
  buttons to your portal (`CHRONOS_PORTAL_URL`). Every other alert arrives as a branded card. Plain text stays as
  the fallback; no scripts, images or tracking.
- `chronos progress` and the text report add the profit ladder and the steps left to $100,000.
- Fix (route floor, research cell 2026-11-26): every route recorded on 2026-11-25 (865 of 865) lost 98–100%: it ran
  through a pool with a price and almost nothing behind it, which took every shortlist slot. Now: V2 pairs holding
  under `DEPTH_MIN_USD` (default $1,000) on a priced side are left out before any quote; a route losing more than
  `DEAD_LOSS_PCT` (5%) at screening never takes a shortlist slot and its worst leg is benched at the trade size (a
  0 output too); the bench is kept in data/live/deadpools.json across restarts; such routes are labelled "dead pool"
  instead of "no price gap", so the portal shows the real gap of healthy routes.
- Fix: `verify-real` contract check fails loudly when your contract has no zero-fee lender (every loan would pay
  Aave 5 bps); it names the lenders it found.
- Fix (update checks, "Registry audit: mismatches" every update): since 2.9.8 the Curve venue (it lists pools, no
  factory) made the audit throw on every pool, so every pool in your src/registry.ts was a "mismatch". Also: V2 pairs
  and Algebra (Camelot V3) pools are read as what they are; "Uniswap", "SushiSwap", "PancakeSwap" match their venues;
  a factory Chronos does not trade is a note. Real problems (wrong fee, wrong token, wrong exchange, no liquidity) are
  still reported.
- Fix (update checks, Drive "error"): rclone's own error is shown in words with its fix (expired sign-in →
  `rclone config reconnect gdrive:`; large Drive → `CHRONOS_DRIVE_ENV_FOLDER`; missing folder; rate limit, duplicate
  names, unexportable Google files and no network are not failures). A `.env` at the top of your Drive is now matched.
  Faster, gentler listing (--fast-list, --tpslimit 8, --drive-acknowledge-abuse); errors logged to
  ~/.chronos/logs/rclone.log. A Drive problem is a warning only while a key is still missing. `verify-real` adds
  drive-remote (the real rclone answer).
- 13 tests, 15 planted bugs.

## 2.9.11 — 2026-11-26
Your own executor key signs trades on the phone, so trading no longer waits for the cloud key.
- `chronos executor import`: your operator key, typed hidden in Termux (never in chat, never in .env), kept only in
  the standard encrypted keystore data/keystore/executor.json (600). Refused if it is your owner key, the account that
  owns the contract, or a different account than CHRONOS_EXECUTOR_ADDRESS. It never travels in chronos-keys.enc.
- `chronos executor unlock`: starts the key agent (lib/keyagent.cjs), a small process of its own; the passphrase goes
  to it over a pipe (never argv, env or disk) and is dropped once the keystore is open. Engine restarts (watchdog,
  PM2, updates) do not lock it; a phone restart does, and the engine then holds trading and notifies you every 3 h.
- The agent signs only a trade: chain 42161, to your contract (fixed at unlock), no ETH, the contract's execute(),
  worst-case gas at most 0.05 ETH (`CHRONOS_AGENT_MAX_TX_ETH`), at most 30 a minute; every signature is logged by
  hash. A transfer, approval, setOperator, withdrawal, message signature or call to any other address is refused,
  even from the engine. The engine checks each signature it gets back (same transaction, your executor's address).
- The engine uses it when there is no Cloud KMS key: same readiness rules (operator, gas) as the KMS executor; a
  locked agent is "not ready", so nothing is sent; rehearsals keep running as your executor address meanwhile.
- `chronos executor status` / `lock`; `chronos verify-real` adds executor-agent (unlocked, operator on your real
  contract, gas, and two refusal probes against the real agent).
- 6 tests (a real detached agent, the live executor trading through it on a local chain, a lying agent) and 9
  planted bugs.

## 2.9.10 — 2026-11-26
GetBlock as a node provider, from your API key.
- `chronos set GETBLOCK_API_KEY` (hidden): the access token of your GetBlock Arbitrum One endpoint becomes
  https://shared.<region>.getblock.io/<key>/ and its websocket; tested live (chain 42161) before it is saved.
  `GETBLOCK_REGION` us-east-1 (default, New York), eu-central-1 or ap-southeast-1; or set the whole url as
  `GETBLOCK_ARB_URL`.
- `GETBLOCK_PLAN` (free, starter, growth, advanced, scale, pro, premium, dedicated) paces the node inside the plan:
  Arbitrum costs 20 CU a call (40 on archive endpoints); free is 50,000 CU a day (about 2,500 calls) at 20 req/s,
  starter 90M CU a month at 250 req/s. A free key is used for failover and broadcasting, never as the main scanning
  node over a bigger one; a block feed is used only on plans that can carry one message a block (GetBlock does not
  publish subscription costs: 20 CU a message is assumed). Sources in lib/providers.cjs.

## 2.9.9 — 2026-11-26
Sign owner actions with MetaMask: your private key never leaves MetaMask.
- `chronos mainnet --metamask`, `chronos deploy --metamask`, `chronos payout --metamask`, or `CHRONOS_OWNER_SIGNER=metamask`
  for every run: Chronos serves a one-time page on this device only (127.0.0.1, secret link). Open it in the browser
  with MetaMask (on a phone: MetaMask's own Browser tab; the link is copied to your clipboard with Termux:API). It
  connects, switches MetaMask to Arbitrum One, and shows each prepared transaction (what and why, the gas limit Chronos
  priced); you approve or reject each one in MetaMask. Chronos waits for each on chain from its receipt, exactly as
  with your keystore, and checks it is from your account, to the address and with the data it prepared.
- The page has no outside scripts (Content-Security-Policy); it answers only on its secret link, accepts posts only
  from itself (another website cannot drive it), refuses a wallet on another chain, and stops every waiting step if
  you switch account or network in MetaMask. A rejection in MetaMask sends nothing.
- `lib/walletbridge.cjs` (the page and an ethers signer backed by it), used by deploy, setup steps and payouts through
  `tui/owner.cjs`; tested in a real browser (Chromium) against a local chain with Arbitrum One's chain id, plus 6
  planted bugs on its safety checks (all caught).

## 2.9.8 — 2026-11-26
Zero-fee loans first, more venues, and the safeguards that keep a 24/7 engine from losing money it did not approve.
- Contract v2.3 (`contract/ChronosFlashArbV2.sol`, 13,436 bytes): Uniswap V4 flash accounting (borrow with `take`,
  repay with `sync` + transfer + `settle`, no fee; the PoolManager holds about $9.3M USDC on Arbitrum One), allowlisted
  Curve stable pools as a leg (coins checked at the indexes given, allowance reset after every leg), and one shared
  trade loop (`runLegs`, callable only by the contract itself, mid-trade) that took the contract from 26,365 bytes
  (over the 24,576-byte limit) to 13,436. Constructor: Aave pool, Balancer vault, Morpho Blue, V4 PoolManager.
  35 logic and attack tests; planted bugs re-run against this build. Installed by `install-to-engine.cjs`, which
  refuses a contract over the size limit.
- Deploy fix: `chronos mainnet` / `chronos deploy` priced the deployment with 2 constructor arguments, so 2.9.7 stopped
  before sending ("incorrect number of arguments"). The price shown before YES and the deployment now use one
  argument list (`lib/deploy.cjs ctorArgs`), tested against every shipped contract.
- Lenders: Uniswap V4 joins Morpho Blue and Balancer; zero fee first, Aave (5 bps) only when none can lend the size,
  and only lenders your deployed contract is wired to (`CHRONOS_UNI_V4`, default the Arbitrum One PoolManager).
- Curve in the engine: listed pools in `venues.json` are checked on chain at start (coins at their indexes), priced each
  block from `get_dy` (+5 bps so the screen never prunes a real route), quoted with `get_dy`, and traded only through a
  v2.3 contract that allowlists the pool.
- Routes up to 5 legs (`SCAN_MAX_LEGS` 2-5, never more than your deployed contract's `MAX_LEGS`); the 5-leg screen has
  its own bound, proven by brute force never to drop a profitable route.
- Depth check: a pool whose small probe gets less than half its own quoted price (`DEPTH_MIN_FILL`) is benched for
  `DEPTH_BENCH_HOURS` (default 6) and shown in the scan's `benchedPools`. Your engines' data showed every recorded route
  going through dead pools (one ezETH pair, two FRAX pairs) at about −98%.
- Daily spending cap (`CHRONOS_DAILY_SPEND_CAP_USD`, default $5): one ledger for costs no profit pays back (reverted
  trades' gas and bid, AI calls at `CHRONOS_AI_CALL_USD`). Anything whose worst case would go over waits until 00:00
  UTC; trades that fit keep running; you are told once a day.
- Hang watchdog (`CHRONOS_WATCHDOG_STALL_SEC`, default 300 s): a separate thread ends an engine whose loop stops (even a
  fully blocked one) so PM2/systemd restart it; started after start-up discovery; a rediscovery gets 30 min; the restart
  tells you what stalled.
- A trade can no longer net below your floor after its own bid: before signing, the on-chain `minProfit` is raised to
  cover the worst-case gas and priority fee plus your floor, and the call is simulated again at that minimum.
- Trades with no receipt within 120 s are kept and settled from their receipts: a late revert counts against reverts
  in a row, the daily gas cap and the spending cap. Realized profit now counts your reverted trades as losses.
- One sender: an acting primary that has not heard from your database for 7 minutes stops sending (a standby can only
  take over after 10), so two devices never sign at once. After a node failover the executor moves to the new node.
  Three send failures in a row in LIVE alert you at once.
- Real-chain probe: 18 checks, adding a real zero-fee V4 loan on the best route (`real-profit-v4`), a refused foreign V4
  callback, a real Curve round trip (`curve-leg-real`, USDC/USDT0 pool) and real round trips through Aero Slipstream
  and Camelot V3 pools (`venue-legs-real`), which prove their lookups and callback names on chain.
- Release gate: the counterpart step used a test name that matched nothing and passed with no test run; it now
  requires the named test to run and pass.

## 2.9.7 — 2026-11-25
Every engine learns from what wins on chain, shares price moves, and your database holds all of it.
- New tables (Supabase, row-level security, owner-only; written only by approved engines through `ingest`):
  `chain_trades` (each flash-loan transaction your engines' research read from receipts: lender, borrowed token,
  legs, venues, gas, what was kept after gas) and `pool_moves` (the price-move relay, kept 2 h).
- New views: `competitors`, `venue_usage`, `chain_policies`, `chain_indicators`, `chain_numbers`. The `insights`
  function now returns them to every engine as `chain`.
- Chain signals (`lib/chainsignals.cjs`): nine indicators (lender, legs, venue, venue pair, borrowed token, contract,
  sender, hour, venues Chronos lacks), each group judged exploit / avoid / watch from at least 3 trades, plus the
  winners' lowest and median net, gas units and gas price. Within the quote budget, routes shaped like winners are
  quoted first and routes shaped like reverting trades last (order only; every rule still decides). Shown in the
  daily report. The engine uses your database's signals once they cover more trades than its own research.
- Price-move relay (`lib/relay.cjs`): an engine whose node streams swap logs posts the pools that moved (at most every
  2 s); `ingest` broadcasts them on Realtime; every engine re-quotes only those pools, so nodes without log streams
  stop re-quoting everything. Hints only: re-quoted from the chain, own markets only, 2,000 pools a minute at most.
  `CHRONOS_RELAY=off` turns it off. New real check `relay-realtime`.
- Research reads Morpho Blue flash loans too (fee-free; seen in a profitable competitor's trades) and records each
  transaction's sender, venues, borrowed tokens and gas price.
- Fixed: the VP's audits were filed as reports of kind `audit`, which `ingest` refused, so none reached your portal.
  `ingest` accepts them now; the database check needs the one SQL statement in docs/OPERATIONS.md (run it in the
  Supabase SQL editor).
- Fixed: chain-signal groups with numeric keys (legs, hour) were counted wrongly (caught by the new test).
- Contract v2.2 (`contract/ChronosFlashArbV2.sol`, not deployed until you type YES): Morpho Blue flash loans (no fee;
  the lender a profitable Arbitrum competitor uses), the v2.1 venue families (factories that name pools by tick
  spacing, Algebra's one pool per pair, Ramses / Solidly V3 / Algebra callback names) and up to 5 legs. 31 logic and
  attack tests pass, including an attack on each new callback name. The constructor takes the Morpho address.
- Engine: Morpho Blue as a lender. Each scan reads what Morpho holds of every flash-loanable asset; a route borrows
  from the cheapest lender your deployed contract borrows from (Aave 0.05 %, Balancer and Morpho 0 %). Shadow tests
  check the contract's Morpho address and Morpho's liquidity before any send.
- Profit floor per route: the larger of `MIN_NET_PROFIT_USD` (now suggested $0.05) and `FLOOR_GAS_MULT` × that route's
  gas (default 2). Winners on Arbitrum keep $0.06–$1.50 a trade at about $0.02 gas; a fixed $0.35 floor skipped them.
  The re-simulation before each send uses the same rule.
- New node providers, each paced inside its documented plan: dRPC (`DRPC_ARB_URL`, `DRPC_PLAN`), Ankr (`ANKR_ARB_URL`,
  `ANKR_PLAN`) and Chainstack (`CHAINSTACK_ARB_URL`, `CHAINSTACK_PLAN`); `CHRONOS_PUBLIC_NODES=on` adds dRPC's keyless
  endpoint as failover.
- `chronos vault set resend_api_key | alert_email`: saves a secret in your Supabase Vault from an approved device, typed
  hidden (new `vault` function; only these two names).
- One workspace on every device: `sync/workspace-sync.sh` (Syncthing, device to device, no cloud copy; device keys and
  engine data never synced) and the engine applies a synced settings change by itself (`lib/settingswatch.cjs`); a
  broken file is never applied. `sync/laptop-setup.sh` installs, keeps the engine on all the time (systemd user service,
  runs while logged out) and joins the workspace.
- Reference docs: docs/reference/FLASH_LENDERS.md (Aave, Balancer V2/V3, Morpho, from their own docs).
- Device roles (`chronos role primary | standby`, stored per device in ~/.chronos/role, never synced): the primary
  (your laptop) scans at full speed with tempo, runs the VP, its AI brain and research, and is the only device that
  sends; a standby scans every 4th interval with no tempo, no AI calls and no research, and never sends. When no
  primary reports for 10 minutes the first live standby by name takes over, and hands back when the primary returns
  (the insights function now lists every engine's role). No role file = primary, so one device works as before.
- Real-protocol probe (`chronos verify-real`, contract-v2-probe): 14 checks, adding a real Morpho Blue loan on the same
  real route (`real-profit-morpho`) and a refused foreign Morpho callback (`morpho-refuses-foreign-loan`).
- Contract planted-bug check: 24 of 24 caught, including an attack from inside a swap on the Morpho callback.
- Release gate (`chronos release-check`): every version must pass nine checks before `package.sh` builds it, none
  skipped: its CHANGELOG entry, every file parses, docs match the code, every setting documented once, the contract's
  source/bytecode/probe agree, the server functions and schema shipped are the ones deployed (server/DEPLOYED.json),
  every stand-in has a real counterpart, every planted bug targets real code, and the full suite passes.
- Engine planted bugs: 208, all pointing at real code; the 16 new or repointed ones (floor, roles, settings sync,
  relay cap, chain signals, lenders) are all caught.

## 2.9.6 — 2026-11-25
Every node, websocket and API key works, staggered, each inside its provider's documented plan (docs/PROVIDERS.md).
- Gas specialist (`lib/gas.cjs`), the 8th team agent. Gas on Arbitrum is paid in ETH only, and a flash loan needs
  no tokens up front, so this agent manages the ETH side:
  - **Measured gas per route.** Each route is priced with the gas your shadow tests measured for its own type (lender
    + each leg's pool kind, e.g. `balancer_v2|v3,v2`), +15%. It falls back to the leg count, then to
    `GAS_UNITS_ASSUMED`, until 3 measurements exist.
  - **Executor ETH.** It tracks how many sends the executor can still pay for, and the exact top-up to get back to
    200 (told to you; sent only on your YES).
  - **Gas spikes.** More than 5× the recent median pauses sending for 1 h; shadow tests continue.
- Tempo (`lib/tempo.cjs`): the engine amps up as opportunities appear and eases off when they're gone.
  - **Speeding up:** an approved route, or a best route netting above zero, raises the level by one (two at once
    when 2+ routes are approved). At level 3 it scans 3× as often and quotes 2.5× the routes.
  - **Easing off:** 3 quiet scans lower it by one.
  - **Limits that always hold:** each node's plan (the node pool), a 3 s floor, 2,000 routes a scan, and
    `CHRONOS_TEMPO_MAX` (0–3).
- The VP's standing team (`lib/team.cjs`): seven stationary agents, one per angle.
  - **The agents:** Uptime (SRE), Data, Risk, Profit desk, Research, Security, Treasury.
  - **Each cycle (30 s):** each agent checks its triggers against real state, uses only allowlisted skills, and
    reports to the VP, in order and synchronously. Examples: a stale scan → scan now; node errors → next node;
    reverts in LIVE → stop sending and tell you; dust routes → rebuild the pool list; executor gas low → tell you.
  - **The VP's feedback, in the same round:**
    - A trigger cleared by the next cycle counts as effective.
    - One that isn't cleared backs off (its cooldown doubles, up to 16×).
    - After 3 ineffective runs the VP takes the trigger over with a worker cell.
  - **No task runs twice:** team tasks share the VP's schedule.
  - **Reporting:** each agent's effectiveness is in the daily report.
- The VP's brain and its worker cells.
  - **AI brain** (`lib/llm.cjs`): every AI key in turn, each the fallback of the others: `OPENROUTER_API_KEY` …
    `_5` and `ANTHROPIC_API_KEY`. A key out of credits (402) rests 6 h; a rate-limited one rests for its
    Retry-After.
  - **Worker cells** (`lib/mind.cjs`, your Honeycomb design):
    1. The VP opens a cell for each task: a failing audit check, Chronos's own next step, or a setting change.
    2. The cell does the work and passes its own quality check (cause, evidence, a concrete step, a tool used)
       before it may submit.
    3. The VP reviews the quality at once and the effectiveness at the next audit (only checks that now pass, or a
       step verified done, count).
    4. Accepted, the cell collapses to one line. Rejected, it works again with the reasons; after 3 rejections it
       escalates to you.
  - **Using AI sparingly:**
    - Cells exist only for open tasks (`CHRONOS_MIND_MAX_CELLS`, default 120).
    - The analyst runs only for a working cell: at most `CHRONOS_VP_AI_MAX_PER_DAY` (12) times a day,
      `CHRONOS_VP_AI_MIN_GAP_MIN` (60) minutes apart, never the same question within 6 h.
  - **Analyst** (`lib/vpagent.cjs`), allowlisted tools only (your choice): search the archive, read the log,
    read the mind, read the last audit, query Blockscout, fetch from documentation hosts on the allowlist, run a
    real check, run an allowlisted fix, propose a setting (applied by the VP inside its safe ranges). It has no
    shell and no file writes; what it reads is treated as data.
  - **Documentation archive** (`lib/knowledge.cjs`):
    - It holds every Chronos doc, a new chain/protocol/Blockscout reference (`docs/reference/CHAIN.md`), your
      workspace, `CHRONOS_ARCHIVE_FROM`, the Drive documents copied by `chronos archive sync`, and your MCP
      configurations (server names and commands only).
    - Files named env/secret/password/wallet/key are skipped, and keys are redacted.
  - **New commands:**
    - `chronos ask "…"` puts a question to the analyst from your terminal (read-only).
    - `chronos archive search …` searches the archive; `chronos archive sync` copies your Drive documents into it.
- VP audit after every task it completes (a setting applied or verified, a delegation done, a milestone gained or
  lost):
  1. Your real checks run.
  2. Blockscout checks independently (`lib/blockscout.cjs`): the chain head against your node, your contract and who
     created it, each wallet's balance against your node, every send from the executor (only to your contract), and
     every recorded profit as a successful receipt.
  3. The road to cash is reassessed and the next step named.

  A failing check reaches your phone at once and becomes the next step. Tasks finished close together share one audit
  (`CHRONOS_VP_AUDIT_MIN`, default 30); the queue survives restarts. The last audit is in the daily report and
  `data/audit.json`. New real check: blockscout-witness.
- `chronos assist` names drained pools ("Broken pools are taking the quotes") instead of blaming the market.
- Profit fix: broken pools are excluded from routing. Your engines' own data showed drained pools with impossible
  prices taking every quote of every scan: ezETH/WETH V2 `0x52Ce46…` at a "gap" of 1.6e16 bps, rsETH/WETH V2
  `0xb84cd5…` at 2e11 bps, wstETH/USDC on Pancake at 1e7 bps. The 460 quoted routes were all routes through these
  pools; they returned dust (best net −$200.13 on $200, −100%), and the real routes with small honest gaps were never
  quoted. Now a pool more than 20% (`SCAN_MAX_POOL_DEVIATION_BPS`) from the Aave oracle's price for its pair is
  excluded; for tokens without an oracle price, the median of the pair's other pools is the reference. The quotes
  go to routes that can pay, and the excluded pools are reported (`brokenPools`).
- Node pool (`lib/nodepool.cjs`): each scan runs on the node that has gone longest without one, if it has room. Each
  metered node's next turn comes from what it really billed (`lib/chain.cjs` meter: HTTP posts, calls, Infura credits
  by method). A limit answer (429, -32005, "Rate limited") rests that node, and the same scan retries on the next node
  at once. Infura daily limits rest until 00:00 UTC.
- Provider facts (`lib/providers.cjs`) from Infura's and SwiftNodes' docs: plans, credit costs, batch and eth_getLogs
  caps, websocket rules. `INFURA_PLAN` / `SWIFTNODES_PLAN` default to free; `chronos keys` asks once.
- Websocket feed: Infura free and developer are not used for blocks (new blocks alone are 17.3M credits a day against
  3M/15M); SwiftNodes free carries blocks only. Each node's provider websocket is added automatically.
- Packing: Multicall3 batches grow while full batches pass (`QUOTE_BATCH_MAX`, 500 quote calls), and a refused batch
  is split into half-size multicalls instead of single calls. ethers' JSON-RPC batch is capped at 20 on SwiftNodes
  free, and research logs are read in 100-block ranges there.
- More keys: `ARB_RPC_URL_3` … `_5`, plus bare `INFURA_API_KEY` / `SWIFTNODES_API_KEY` / `ALCHEMY_API_KEY` as nodes.
  Trades are broadcast through every node. `CHRONOS_PRIMARY_NODE` overrides which node initialises the engine and
  runs the fast lane (default: the one with most room).
- `chronos nodes`: provider, plan, limits and pace for every node. New real check node-plans sends a real batch to each.
- Fixes from your log:
  - `chronos keys` no longer hangs on "failed to detect network, retry in 1s": every node test uses a fixed network.
  - `chronos set` no longer hangs on "restarting the engine": the restart runs in the background.
  - Each key's prompt is shown once, not twice.
  - The import keeps your working `.env` value and ignores older copies, instead of calling them conflicts. It
    tests every copy and takes the one that works.
  - Drive not linked is reported as optional.
  - Registry audit:
    - wrong checksum casing is read anyway, and the correct form is shown;
    - entries without a literal address are skipped, not counted as mismatches;
    - `chronos audit` uses the same checks.

## 2.9.5 — 2026-11-25
- Fixed: the terminal froze after every key you entered. A hidden prompt left the terminal in raw mode and kept
  listening, so the command never ended and Ctrl+C did nothing. Each prompt now hands the terminal back. `chronos set`
  says it is restarting the engine before it waits on PM2, and `chronos keys` restarts the engine once at the end of
  the sitting instead of after every key.

## 2.9.4 — 2026-11-25
- Several phones: every Termux reports its machine as "localhost", so two phones overwrote each other's heartbeat on
  your server. Each engine now reports as its machine name, or on a phone as localhost plus the start of its own
  pairing code (e.g. localhost-45WM); new phones also join your portal under that name.

## 2.9.3 — 2026-11-25
- Persistence without plaintext. `chronos owner save` keeps your owner private key encrypted on the device in the
  standard Ethereum keystore format (scrypt + AES; MetaMask and geth import it): deploy, venue settings, operator and
  payouts ask for its passphrase instead of the key (three tries, then nothing is sent), and after a typed key they
  offer to keep it. The engine never unlocks it on its own.
- `chronos keys export` seals every setting (node urls, wallets, API keys; never a private key in plaintext) and your
  owner keystore (still encrypted) into `chronos-keys.enc` with a passphrase (scrypt + AES-256-GCM). On a new phone or
  computer, `chronos keys import` (or `chronos keys`, which finds the file in Downloads) restores everything at once;
  values already set there are kept.

## 2.9.2 — 2026-11-25
- `chronos keys` counts a node you already have (ARBITRUM_RPC_URL, RPC_URL or ALCHEMY_RPC_URL), so it no longer asks
  for ARB_RPC_URL, which the engine would use first; the websocket is derived from whichever of your nodes has a
  provider (Alchemy, Infura, QuickNode, Chainstack, dRPC).

## 2.9.1 — 2026-11-25
- `chronos keys`: every wallet address and key in one sitting, in order (node, websocket, second node, tax reserve,
  payout wallet, AI key). Keys already on the device are imported first (your home folder, Downloads, and any folder
  or file in `CHRONOS_IMPORT_FROM`, each value tested; private keys never). The websocket is derived from your node's
  provider (Alchemy, Infura, QuickNode, Chainstack, dRPC) and tested live; Arbitrum's public RPC has none, so it is
  optional and the engine runs on a timer without it. `chronos mainnet` uses it, and keeps the engine running with
  `chronos phone` on a phone or the background service on a computer.
- On a computer, the installer also looks in `~/Downloads` for a newer chronos-console file.

## 2.9.0 — 2026-11-24
- Indicators for the VP: 40 success and 32 failure, each read from a measured source (null when unmeasured, never 0)
  with a trigger. Every duplicate is removed (28 of the first 100 were the same number in another form; each names the
  indicator that carries it), and once a day two indicators whose z-scores move together (|r| ≥ 0.95 over 200 cycles)
  are a measured duplicate: the higher id leaves the index until they part. The algorithm: robust z-scores against each indicator's own history; a momentum index
  (mean of signed z, −3…+3); learned weights ρ (each indicator's correlation with the next change of best net); an
  indicator is proven at 200 measurements and |ρ| ≥ 0.1; forecast Δ̂ = σ·Σρz/Σ|ρ| (the expected change of the best
  route's net at the next scan, with its drivers). An indicator that runs `CHRONOS_INDICATOR_RETIRE_DAYS` (default 7)
  without firing once is retired, and comes back the first time it fires. Daily report, dashboard and portal.
- Price direction, measured: every pair's median price each scan; drift t-statistic (rising / falling / flat at
  |t| ≥ 2) with its confidence and the move expected over 10 scans if it holds; spreads far above their normal
  (z ≥ 2), when gaps tend to close, make the VP scan again at once.
- Every failure mirrored: when a route fails, its opposite direction (the same pools, quoted in the same scan) is
  paired with it. A mirror that clears every rule is a success: it goes to its shadow test, your phone is told, and
  the success webhook fires (kind `mirror`, level `success`; kept in your portal and emailed). A profitable mirror
  below your floor is a lead; when both directions lose, the "fee wall" (how much wider the price gap must be) is
  measured. The daily report has MIRRORS. Mirror successes count in the 2-for-1 ledger.
- Equal effort on success. Every VP cycle has a success pass beside its problem pass: real wins are noticed and sent
  to your phone and email (the first route above your floor, a new closest route, a route crossing break-even or your
  floor, every shadow win, profit rising), a playbook keeps the route patterns that cleared every rule, won or paid
  ("repeat it"), and the daily report has WHAT WORKED and PROFIT & SUCCESS POLICY (profit floor, profit capture, tax
  reserve, drawdown and gas caps, price impact, promotion to LIVE, payouts, receipts-only profit) checked now.
- Two successes for every failure: a ledger counts real failures (incidents opened, reverted sends, a real check
  starting to fail, a road step no longer holding) and real successes (wins, road steps verified, incidents resolved,
  real checks passing again). Short of two per failure, the VP runs a success push (competitor research, a fresh scan,
  real checks rerun) at most every 2 hours. Successes are never invented.
- Road-to-cash notices say how long each step took, start the next step's clock, and give profit verified from
  receipts (all time, 24 h, tax reserve); the list shows each step's time.
- Email from your database (Resend), so alerts reach you even when the phone is off: the daily report, critical alerts
  (an engine silent, money lost, a step no longer holding), money made, every road step verified and every success.
  The API key stays in Supabase Vault (`resend_api_key`); `email_log` records each send.
- The VP drives the road to cash: eight milestones in version order (engine running, contract v2, real checks, HSM
  executor ready, a route above your floor, a shadow win, LIVE, first profit verified from receipts). Each is verified
  from its real source (the chain, the executor's own readiness, receipts, shadow runs, your real checks), never from a
  flag. You are notified the moment each is verified (with the evidence and the next step), at once if one stops
  holding, and about each step that is yours every `CHRONOS_VP_NUDGE_HOURS` (default 3) outside `CHRONOS_VP_QUIET`
  (default 21-08), escalating from the third reminder, until it is verified done. Chronos's own steps it works itself
  (a failing real check is rerun every 2 hours). New `chronos progress`; the dashboard's Visuals tab, the daily report
  and your portal's Road to mainnet panel show the same verified list.
- Database cleanup (daily, 11:17 UTC): route samples older than 14 days and agent activity older than 30 days are
  removed so the portal stays fast. Money records (executions, payouts, revenue, balances, reports) are never deleted.
- Your contract address follows one rule everywhere: Chronos uses `CHRONOS_FLASH_ARB_ADDRESS` only. `CONTRACT_ADDRESS`
  (a name other tools also use) is checked on-chain first and adopted (saved as `CHRONOS_FLASH_ARB_ADDRESS`) only if it
  really is a Chronos contract (MAX_LEGS 4, borrowing from the Aave pool); otherwise it is left alone and never used.
  Before, profit verification, autopilot, payouts and the dashboard read it unchecked.
- Alerts reach you with nothing to set up: `CHRONOS_ALERT_WEBHOOK_URL` and `CHRONOS_WEBHOOK_URL` default to your
  project's new `alerts` function (device-signed, approved devices only, like ingest). Escalations, errors, money made
  or lost and the verify-real test are kept in your portal under "Reports and alerts from your VP"; the rest stays in
  the engine's log. Your own https url still works (HMAC-signed as before; your device key never goes elsewhere), and
  `off` turns either off. verify-real now runs both webhook checks against the real route.
- The AI agent needs only `OPENROUTER_API_KEY`: without `CHRONOS_AGENT_MODEL` it uses the newest Claude Sonnet that
  OpenRouter lists right now (read from its model list, remembered a day; unreachable means off, never a guess).
- Nothing to copy from Cloud Shell: your cloud engine, once you approve it in the portal, offers its HSM executor
  (the address it derives from its own KMS key) through your release service; your phone shows "Your cloud executor
  is ready" (Save it), and `chronos mainnet` picks it up by itself. New `chronos executor` saves it by hand. Your
  portal's Devices list shows which executor each engine signs with. The Cloud Shell script now waits for the cloud
  engine's pairing code and prints it, and leaves `chronos-executor.sh` as a backup it sends to your device.
- Path to profit, across your engines: every 5 minutes each engine uploads its 10 closest routes with the whole cost
  breakdown (gross, flash-loan fee, gas, gap to your floor) and the one thing that stopped each (`route_stats`). Your
  portal's new "Path to profit" panel and the daily report show which routes come closest and what stops them; the
  dashboard's Visuals tab shows the same. New `insights` server function (approved devices, signed) serves it.
- Road to mainnet: a portal panel (and a daily-report line) lists each step to live trading, done or not, from live
  data: engine reporting, contract v2, real checks, cloud engine approved, executor handed off, shadow wins, LIVE,
  verified profit.
- Watchdog in your database (every 5 minutes, no secret involved): an engine silent for 15 minutes is reported once as
  a critical alert in your portal, and again when it is back.
- Reopening Termux no longer prints a job notice when the engine-restart hook runs.

## 2.8.0 — 2026-11-24
- Nothing missing, nothing dead: the server side ships with every release (`server/functions/` for the release,
  ingest and decisions routes, `server/schema.sql` for the database, read from the live project), documented in the new
  docs/API.md (routes, what ingest accepts, every table and column, generated from that source). New tests fail if
  the engine sends a table or column the ingest route would drop, a route uses a column the schema lacks, the engine
  calls a route that does not exist (or a route exists that nothing calls), the portal uses a missing table or
  column, a module is used by nothing or provides nothing, a command is in the help but unhandled (or the reverse),
  a resolver action, remedy, VP task or real check is a dead end, or code would ship unsealed.
- Every environment variable the code reads is documented (`lib/envkeys.cjs` for advanced, location, platform and
  test variables; docs/CONFIGURATION.md "Advanced and platform variables"); the example .env is now generated from
  the code and lists all 80 settings. Removed two variables that were set but never read.
- Database (live project): signed-in accounts could TRUNCATE the reports table (row-level security does not apply to
  TRUNCATE; any portal sign-up was enough); revoked. All tables now grant exactly what the portal does, matching
  server/schema.sql. `portal/real_check.sql` gained two checks: least privilege, and every table and column the code
  needs exists live.
- New real checks: every backup Arbitrum node you set (`backup-nodes`) and your alert notifications webhook
  (`notify-webhook`).
- Fix: a failed `chronos payout` now still sends its confirmed transfers to the portal.
- `chronos lock` is in the help.
- Dashboard: a new Visuals tab (key 3; Measure, Policies and System move to 4, 5, 6) with high-resolution terminal
  graphics: braille charts (8 points per character) of the best route's net after costs with the profit floor, scan
  time and gas against the ceiling; a half-block heatmap of price gaps between venues per pair, scan by scan;
  gradient gauges for what holds routes back, engine vitals and Aave vs Balancer liquidity; and the best route
  drawn token to token. Real data only: nothing is drawn before the first real scan, every screen names its Arbitrum
  One block and age, data older than three scan intervals is marked STALE, and a test fails if it shows a number the
  engine did not measure or the dashboard code gains any source of made-up values.

## 2.7.0 — 2026-11-24
- `chronos phone` (also the first step of `chronos mainnet`): keeps the engine running on your phone. It starts a
  stopped engine; adds a hook to ~/.bashrc so a stopped engine starts again every time Termux opens (Android closing
  Termux stops PM2 and the engine with it, which is what happened on 2026-11-24 at 3:23 PM); holds the wake lock;
  sets up boot start when Termux:Boot is installed; opens Android's battery settings for Termux; checks
  notifications; and checks the engine is reaching your portal from its own record of accepted sends.
- Fix (portal sync): the engine reported outcomes and a severity your database did not accept, so a batch carrying one
  was refused (HTTP 422 on 2026-11-24 at 3:19 PM). The database now accepts the engine's words (`lib/vocab.cjs`), the
  engine maps anything else ('warn' → 'warning', an unknown outcome → 'none' with the original kept), a test fails
  if code uses a word the list does not have, and `portal/real_check.sql` checks the real database accepts each one.
- Fix (portal sync): rows the database refuses are now isolated (the batch is split), set aside in
  data/sync-rejected.jsonl and counted; they no longer hold up every row queued behind them. Network errors and 5xx
  are still retried with backoff.
- `chronos service status` says NOT RUNNING when the engine's last heartbeat is over 2 minutes old (it showed the
  last saved phase, "running", for an engine stopped 4 hours earlier).
- A newer Chronos archive saved into your phone's Downloads now raises a notification with an Install button (one
  tap runs `chronos update`). It is never installed without that tap.

## 2.6.0 — 2026-11-24
- Automatic updates on your phone (`CHRONOS_AUTO_UPDATE`, on by default): the engine checks your release service every
  hour and, when a newer release is published (only devices you allowed may publish; every archive is sha256-checked),
  installs it in the background with your .env and data kept, reseals the code and restarts. You get a notification
  when it starts. Never while a trade is in flight, never twice for the same version, never contract changes (those
  need `chronos deploy` and your YES), and not on the cloud engine (notified there). Off: `chronos set CHRONOS_AUTO_UPDATE off`.
- Fix: `chronos update` (and the automatic update) run the installer from a private copy, because the install
  overwrites go.sh while it runs.

## 2.5.0 — 2026-11-24
- `chronos mainnet`: every remaining step to trade on Arbitrum One, in order, from your phone, and safe to run again
  (finished steps are skipped). It asks for your websocket node and wallets (typed and tested), runs the real checks,
  deploys contract v2 only after its real-protocol checks pass (costs shown, sent only on YES), writes the cloud
  settings pack, prints the one Cloud Shell command, then takes the executor address and KMS key and makes the
  executor an operator with gas.
- `cloud/mainnet-cloud.sh`: the Google Cloud half in one command: the HSM executor key and cloud engine
  (gcp-setup.sh), then the portal when chronos-portal.tgz is uploaded.
- Checked live on Arbitrum One for contract v2: the Uniswap, Sushi and PancakeSwap V3 USDC/WETH 0.05% pools each
  report their own factory (so v2's factory check accepts all three); Balancer's flash fee is 0, Aave's 5 bps.

## 2.4.0 — 2026-11-24
- The engine drives contract v2. It reads which contract is deployed (v1 or v2), its Balancer vault and the factories it
  allows, every hour. On v2 it borrows from Balancer when Balancer is cheaper and holds enough of the asset (Aave
  otherwise, including when Balancer is too dry for the smallest size), swaps directly on V3 pools and V2 pairs of
  allowed factories (routers elsewhere), and the shadow test checks every requirement of that exact call (lender,
  vault, factories, routers, caps) before anything is sent. v1 calls are unchanged.
- `chronos deploy --v2`: deploys contract v2 with the Balancer vault and allows each checked venue's factory (V2 fees
  measured on-chain and rounded up; a fee found set too low on the contract is corrected); a v1 address is kept as
  `CHRONOS_FLASH_ARB_V1_ADDRESS`. Nothing is sent without your YES.
- The VP's site-reliability department runs every real check once a day (`chronos verify-real`, minus the test
  notification); results are in the daily report and the portal's new Real checks panel, and a failed check keeps
  site reliability amber.
- Portal: its render test now asserts instead of printing, and its stand-in Supabase client is paired with your real
  project (`portal/counterparts.json`, `portal/real_check.sql`, and the new `portal-backend` real check: every table
  the portal uses exists and a signed-out visitor can read none of it). The `reports` read policy now applies to
  signed-in users only, like every other table.
- Fix: the v2 contract, its artifact and the real-protocol probe were not covered by the code seal; they are now, and a
  test fails if any contract file ships unsealed.
- Portal shows which contract the engine drives.

## 2.3.0 — 2026-11-24
- Every stand-in now has its real counterpart. The tests use local stand-ins (a local chain, test contracts, fake KMS,
  sync, notification and webhook endpoints) to prove failure handling the real systems cannot be made to produce on
  demand; `test/counterparts.json` pairs each one with the real system it stands in for and the check that runs the
  same behaviour against that real system. The suite fails if a stand-in has no real counterpart.
- New command `chronos verify-real`: runs those real checks: your RPC is Arbitrum One and current, Multicall3, real
  Aave V3 reads, every venue confirmed on chain, a real Uniswap quote, your websocket node streaming blocks, your
  deployed contract, contract v2 against the real Aave / Balancer / Uniswap / Sushi / Pancake contracts, your KMS HSM
  key, your release service, a phone notification, your webhook and your AI agent key. Read-only on chain. A check
  that cannot run here says why and is never counted as a pass. The result is kept in data/live/realcheck.json.
- Contract v2 (ChronosFlashArbV2, not deployed): Balancer V2 flash loans (0% fee today) alongside Aave V3, and direct
  swaps on V3 pools and V2 pairs verified against allow-listed factories. 25 logic and attack tests and 17 planted
  bugs, each caught. Its real-protocol probe ships in contracts/v2 and runs inside `chronos verify-real` as one
  eth_call: nothing is signed or sent; its profit checks make their own price gap inside the call, so they prove the
  machinery, not a market opportunity.

## 2.2.0 — 2026-11-24
- Your company: a VP of Operations and seven departments (trading desk, risk & compliance, treasury, site reliability,
  data & records, research, security) run inside the engine. The VP's mission is to keep building and delegating
  until the first verified profit, with full operational control until then and limits only after.
- The VP runs experiments toward profit one at a time, verifies each (kept when progress holds, reverted when risk
  objects or progress falls) and never repeats one; risk can veto.
- Daily report at your report time (default 07:30 America/Los_Angeles) to your phone and the portal's Reports; immediate
  alerts only for money made, money lost and the database down.
- Portal: Company and Reports panels; a `reports` table (owner-only) and the ingest function accept daily reports,
  alerts and build requests.
- The VP's charter is hard-coded (mission, seven objectives in priority order, rules, acceptance gates, cadence): it
  improves only, never repeats a failed change, never stops before the first verified profit, and keeps going after it.
- New settings: `CHRONOS_REPORT_TIME`, `CHRONOS_TZ`. New document: docs/COMPANY.md.
- Fix: `chronos payout` could stop half-way when the second transfer needed slightly more gas than the first
  estimate; the approved gas cap now includes 25% headroom for every transfer (and still stops above it).

## 2.1.0 — 2026-11-24
- Documentation system: reference docs are generated from the code (settings, execution and deploy policy, keys,
  commands, module index, test and planted-bug counts, version) and checked by the test suite and by packaging
  (`chronos docs`, `chronos docs --check`). A release cannot be packaged with stale docs, a module without a header,
  a test file the runner skips, or no changelog entry.
- New `docs/`: architecture, configuration, commands, operations runbook (setup order, updates, monitoring,
  troubleshooting, rollback, incident response), security, testing and releasing; and this changelog.
- Consistency checks: a doc may not mention a setting the code does not use or a command that does not exist; venue
  tables are generated from `venues.json`; every page links home and every link and anchor must resolve; a user
  journey on the docs home walks from install to profit and back.
- Incident resolver: detected problems and error log lines open incidents; researched resolutions run in order, one
  at a time, each verified and never repeated; then an AI agent limited to allowlisted, untried actions; then
  escalation to you (phone, portal, webhook). Recurring problems escalate instead of looping.
- Death-loop breakers: crash-restart loops enter safe mode until stable (cause recorded); scan failures re-initialise,
  back off (capped) and alert.
- `chronos assist [question] [--fix]`: the help agent on the command line, from the same guide; `--fix` runs the
  allowlisted terminal steps, each verified.
- Alert webhook (`CHRONOS_ALERT_WEBHOOK_URL`, `CHRONOS_ALERT_WEBHOOK_SECRET`): signed, redacted, deduplicated.
- Websocket integration completed: Swap events of every watched pool are streamed; a swap re-checks every cycle
  through that pool at once; feeds can be reconnected by the resolver; feed and swap counts reach the portal.
- README: owner-key handling stated precisely (from `.env` if kept there, otherwise asked hidden per run).

## 2.0.1 — 2026-11-24
- Portal: the engine's heartbeat now carries the last scan's figures (cycles checked, raw gaps before the filters,
  what each filter blocked and what it would have netted, best route and its Balancer comparison, gas to beat, fast
  lane, websocket feeds) and the latest `chronos research` summary. New portal panels show them. No URLs, route keys,
  call data or transaction rows leave the device.
- Packaging refuses stray files (screenshots, logs, archives, env files).

## 2.0.0 — 2026-11-23
- Websocket block feed (`ARBITRUM_WSS_URL`, plus `ARB_WSS_URL`, `ALCHEMY_WSS_URL`, `ARBITRUM_WSS_URL_2` for
  redundancy). Each url is tested live and must answer as chain 42161; dropped feeds reconnect on their own.
- Fast lane runs on every new block: the closest cycles plus every cycle through a pool whose price just moved.
- "Before the filters" indicators: raw gaps at the screen size and, per filter, the routes it blocked and the best
  it would have netted.
- `chronos research [hours]`: flash-loan arbitrage that landed on Arbitrum (Aave, Balancer, pool flashes), read
  through your node: contracts, legs, venues (and factories not scanned yet), gas, and what stayed with them.

## 1.2.0 — 2026-11-23
- Cycle finder: every loop of 2 to 4 legs from each flash-loanable token, across every venue.
- Free price screen: a loop whose marginal rates cannot beat the flash fee at any size is dropped before a quote is
  spent (checked against exact pool math on random pools).
- Flips: the best loops are quoted in the other direction and borrowed in every other flash-loanable token on them.
- Venues: Uniswap V2, PancakeSwap V2 and Sushi V3 added and executable (routers, factories and the Sushi V3 quoter
  confirmed on Arbitrum One on 2026-11-23).
- Token discovery: up to 40 traded tokens beyond Aave's reserves, nominated by Blockscout's public list and confirmed
  on-chain.
- Balancer V2 flash fee and lendable amounts read every scan; each route shows its net through Balancer.
- Profitability indicators on the Measure tab. Fast lane re-checks the closest loops between full scans.

## 1.1.2 — 2026-11-23
- `chronos deploy` ignores a `CONTRACT_ADDRESS` that is not a ChronosFlashArb (another tool's contract) and shows a
  plain error, never a stack trace; every error states that nothing was sent.
- Engine → portal sync signs each request with the device's own approved key; the shared sync secret is retired.
- Integrity check reports files that are not part of Chronos.

## 1.1.1 — 2026-11-23
- One-command installer works on the very first device (before any release is published).
- Dashboard no longer crashes before the engine's first mode evaluation.

## 1.1.0 — 2026-11-23
- Device approval and private, versioned releases; one-command install and update.
- Agents inside the engine (watchdog, tuner through approvals, requirements, AI diagnosis).
- `chronos deploy` and `chronos payout`; portal on Supabase.

---

<!-- GENERATED:nav -->
[Project home](README.md) · [Docs home](docs/README.md) · [Company](docs/COMPANY.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Commands](docs/COMMANDS.md) · [Operations](docs/OPERATIONS.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Releasing](docs/RELEASING.md) · [Server API](docs/API.md) · **Changelog**
<!-- /GENERATED:nav -->
