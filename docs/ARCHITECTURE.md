# Architecture

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · **Architecture** · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

## Purpose and limits

Chronos borrows a token with a flash loan, swaps it through a loop of pools, and repays the loan in the same
transaction, keeping any surplus. It runs on **Arbitrum One only (chain 42161)**. It never uses mock data in
production: every price, amount, fee and balance it acts on is read from the chain or from your settings. The only
simulations are the ones that decide which route and direction pay, and the shadow test of your contract's exact call.

It is not a general trading platform. Income from your other businesses is recorded in the portal with evidence, not
through the engine.

## Components

```
                ┌──────────────────────── your device (phone / Cloud VM) ───────────────────────┐
  Arbitrum One  │  live.cjs ─ chain.cjs ─ batch.cjs        read-only: pools, quotes, Aave,      │
  RPC + wss ───►│      │                                    oracle prices, Balancer             │
                │      ▼                                                                         │
                │  cycles.cjs  (free price screen, 2-4 leg loops)                                │
                │      ▼                                                                         │
                │  scan.cjs ─ engine.cjs  (real quotes, sizing, guardrails, contract call)        │
                │      ▼                                                                         │
                │  daemon.cjs  (24/7 loop · fast lane · block feed · agents · sync · updates)     │
                │      ├─► shadow.cjs   your contract's exact call, simulated (nothing sent)      │
                │      ├─► mode.cjs     SHADOW ↔ LIVE by your rules                               │
                │      ├─► executor.cjs sends only in LIVE, signed by Cloud KMS (HSM key)         │
                │      ├─► livestate ─► tui/app.cjs (dashboard follows the engine)               │
                │      └─► sync.cjs ──── device-signed ────────────────┐                         │
                └──────────────────────────────────────────────────────┼─────────────────────────┘
                                                                       ▼
                Supabase: functions ingest · decisions · release  ─►  tables (RLS, owner only)
                Firebase: static portal (reads Supabase with your sign-in)
```

- **Discovery** (`lib/live.cjs`, `lib/chain.cjs`, `lib/tokens.cjs`): validates each venue on-chain at startup
  (factory, router and quoter must agree), finds pools with liquidity among Aave's reserves and discovered tokens,
  and caches the pool list. Every scan re-reads pool prices at one pinned block.
- **Cycle finder** (`lib/cycles.cjs`): turns pool prices into marginal rates (an upper bound on any trade through
  that pool) and walks every loop of 2 to 4 legs from each flash-loanable token. Loops that cannot beat the flash fee
  at any size are dropped without a quote. Unreadable prices are never dropped.
- **Scan** (`lib/scan.cjs`, `lib/engine.cjs`): quotes surviving loops for real, flips the best ones (other
  direction, other borrow token), optimises size, measures price impact per leg, applies guardrails, and builds the
  contract call. Produces the profitability indicators.
- **Engine** (`lib/daemon.cjs`): full scan every interval; between scans the fast lane re-checks the closest loops
  and every loop through a pool that just moved, on every new block when a websocket feed is up.
- **Shadow and live** (`lib/shadow.cjs`, `lib/mode.cjs`, `lib/executor.cjs`): every approved route is simulated as
  your contract's exact call at the scan's block. The engine switches to LIVE only when your promotion rules hold and
  drops back to SHADOW on losses. In LIVE, the executor re-simulates and sends, signed by an HSM-backed Cloud KMS key.
- **Company** (`lib/company.cjs`): the VP and seven departments assess real state every cycle; the VP runs verified
  experiments toward profit, delegates, and sends your daily report and the three immediate alerts. See
  [Company](COMPANY.md).
- **Self-healing** (`lib/resolver.cjs`, `lib/remedy.cjs`, `lib/webhook.cjs`, `lib/assist.cjs`): incidents from
  detected problems and error log lines; researched resolutions in order, each verified and never repeated; an AI
  agent limited to allowlisted actions; escalation with steps; crash-loop safe mode; alerts by phone, portal and
  webhook. `chronos assist` is the same knowledge on the command line.
- **Websocket stream** (`lib/blockfeed.cjs`): new blocks and the Swap events of every watched pool, from every
  configured `wss://` url at once; a swap triggers an immediate re-check of every cycle through that pool.
- **Portal** (Supabase + Firebase): engines report heartbeats, opportunities, shadow runs, executions and verified
  balances; you approve agent proposals and devices; releases are distributed only to approved devices.
- **Contract** (`contract/ChronosFlashArb.sol`): your contract, unchanged from your Drive copy. Aave V3
  `flashLoanSimple`, up to 4 legs, owner-only withdraw, operator list, router allowlist, max-loan cap, pause. Not
  externally audited.

## Venues

<!-- GENERATED:venues -->
| Venue | Kind | Your contract can trade it | Router | Factory |
| --- | --- | --- | --- | --- |
| `uniswap_v3` | v3 | yes | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| `pancake_v3` | v3 | yes | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| `sushi_v3` | v3 | yes | `0x8A21F6768C1f8075791D08546Dadf6daA0bE820c` | `0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e` |
| `sushi_v2` | v2 | yes | `0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506` | `0xc35DADB65012eC5796536bD9864eD8773aBc74C4` |
| `camelot_v2` | v2 | quote only | `0xc873fEcbd354f5A56E00E710B90EF4201db2448d` | `0x6EcCab422D763aC031210895C81787E87B43A652` |
| `uniswap_v2` | v2 | yes | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` | `0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9` |
| `pancake_v2` | v2 | yes | `0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb` | `0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E` |
| `curve_stable` | curve | yes, through contract v2.3+ (each pool allowlisted) | — (direct pool swaps) | 4 listed pools |

Every venue is checked on-chain at engine start (factory, router and quoter must agree; for Curve, each pool must hold the coins listed for it); one that fails is not used.
<!-- /GENERATED:venues -->

## Trust boundaries

| Boundary | What crosses it | Protection |
| --- | --- | --- |
| Device ↔ RPC / websocket | read calls, signed transactions (LIVE only) | urls are secrets, never logged; chain id 42161 checked on every connection |
| Engine ↔ Cloud KMS | digests to sign | the key never leaves the HSM; the engine holds only its resource name |
| Device ↔ Supabase | allowlisted rows, device-signed | Ed25519 key per device, owner approval, 60 s signature window, allowlisted tables and columns |
| Portal ↔ you | approvals, device decisions, income entries | Supabase sign-in; row-level security makes every table owner-only |
| Release channel ↔ devices | versioned archives | approved devices only; sha256 verified before install; publishing needs a device you allowed to publish |

## Module index

<!-- GENERATED:modules -->
| File | Purpose |
| --- | --- |
| `bin/chronos.cjs` | chronos — one command for the whole console. |
| `lib/actions.cjs` | Things only you can do, with exact steps. Where the console can see the result itself it checks automatically; |
| `lib/agentllm.cjs` | AI diagnosis of a new engine problem through OpenRouter. Read-only by design: it returns an explanation and a |
| `lib/agentmodel.cjs` | Which OpenRouter model the AI agent uses. CHRONOS_AGENT_MODEL if you set one; otherwise the newest Claude Sonnet |
| `lib/agents.cjs` | Agents that run inside the engine. What each may do on its own, and what waits for you: |
| `lib/assist.cjs` | chronos assist: a help agent you can run at any time. It checks this device and its engine, maps what it finds to |
| `lib/audit.cjs` | Registry audit as a function: is each pool in src/registry.ts the exchange, pair and fee tier it claims? |
| `lib/autopilot.cjs` | chronos autopilot: does every step that does not need you, in order, checks each one, and ends with a report |
| `lib/autoupdate.cjs` | Automatic updates on the phone. When your release service has a newer release (published only by a device you |
| `lib/balances.cjs` | Balances, shown only when they are verified by a second, independent source: |
| `lib/batch.cjs` | Read-only call batching. Many eth_calls are packed into one Multicall3.aggregate3 eth_call, so a scan costs a |
| `lib/blockfeed.cjs` | Live block feed over websockets. Every wss:// url you set is connected at once; whichever announces a new block |
| `lib/blockscout.cjs` | Blockscout: an index of Arbitrum One that Chronos does not run and your node providers do not feed, so it is the |
| `lib/capabilities.cjs` | What each key unlocks. "built here" = the console uses it now. Otherwise the key makes your own services |
| `lib/catalog.cjs` | Every key and setting the setup screen knows about: what it is for, whether it is secret, how it is checked. |
| `lib/chain.cjs` | Read-only chain access. Nothing in this file can sign or send a transaction. |
| `lib/chainsignals.cjs` | Chain signals: what successful flash-loan arbitrage on Arbitrum One has in common, measured from real transactions |
| `lib/cloudpack.cjs` | chronos cloud-pack: the settings file for the Google Cloud engine. It carries your scanner settings, limits and |
| `lib/company.cjs` | The company: AI departments that report to a VP, who reports to you (the owner). |
| `lib/config.cjs` | Loads .env (read-only, never printed) and validates every number the scanner uses. |
| `lib/contractinfo.cjs` | Which contract is deployed at your address, read from the chain: v1 (ChronosFlashArb: Aave + routers) or v2 |
| `lib/cycles.cjs` | Cycle finder. Pure math on pool state read from the chain at the scan's block: no network, no clock, no randomness. |
| `lib/daemon.cjs` | chronos daemon: the 24/7 engine. Scans on a fixed interval, keeps the measurement session, verifies realized |
| `lib/deploy.cjs` | chronos deploy: puts YOUR ChronosFlashArb on Arbitrum One and sets it up for the engine, from this phone. |
| `lib/device.cjs` | This device's identity and your private releases. Node built-ins only: it also runs on a brand-new device before |
| `lib/direction.cjs` | Which way prices are moving, measured. For every pair the scanner prices (the median across its pools, each block it |
| `lib/docs.cjs` | Documentation that cannot drift from the code. Reference sections of the docs are GENERATED from the code itself |
| `lib/drivepull.cjs` | Pulls ONLY env-style files from your Google Drive onto this phone, using the rclone "gdrive:" remote your own |
| `lib/emailreport.cjs` | The daily report as an email (2.9.12): a professional HTML page that reads well in Gmail, Outlook and phone mail |
| `lib/engine.cjs` | Pure math + decision logic. No network, no clock, no randomness: everything here is unit-tested. |
| `lib/envfile.cjs` | Safe .env editing. Keeps every line, comment and order you already have; changes only the keys you set. |
| `lib/envkeys.cjs` | Every environment variable the code reads that is NOT one of your settings (those are in lib/catalog.cjs, the |
| `lib/etherscan.cjs` | Etherscan API V2 on Arbitrum One (chainid 42161), with your ETHERSCAN_API_KEY: a second independent witness of the |
| `lib/execpolicy.cjs` | Execution policy: every limit the live executor and the automatic shadow ↔ live switch obey. Values come from |
| `lib/executor.cjs` | Live executor. Sends ChronosFlashArb.execute(...) only when, at that moment: |
| `lib/fan.cjs` | Burst mode (2.9.13): every read a scan makes is spread over all your nodes at once, as fast as they answer. |
| `lib/fixers.cjs` | Automatic fixes for the checklist. Every fix keeps a backup and checks its own result; if anything is uncertain |
| `lib/gas.cjs` | The gas specialist. On Arbitrum gas is paid in ETH only (no other token can pay it), and a flash loan needs no |
| `lib/handoff.cjs` | The executor hand-off between your engines. The cloud engine holds the Cloud KMS HSM key; it derives its address |
| `lib/health.cjs` | "Fail loudly until running smoothly": every problem the console can see, in one list. |
| `lib/history.cjs` | Scan history with a per-install HMAC on every line, so nothing typed or pasted into the file by hand can show up |
| `lib/hookurl.cjs` | Where alerts go when you have not set a webhook of your own: your Supabase project's `alerts` function (the same |
| `lib/importer.cjs` | Finds API keys already sitting in env-style files on this device (your workspace, Drive-synced folders, |
| `lib/indicators.cjs` | The VP's indicators: 40 success and 32 failure (from 50 + 50, with every duplicate removed: see DUPLICATES), every one |
| `lib/insights.cjs` | Path to profit, measured: the routes that came closest in a scan, each with its whole cost breakdown and the one |
| `lib/integrity.cjs` | Tamper / accident protection for the console's own code. |
| `lib/keyagent.cjs` | The key agent (2.9.11): signs trades on this phone with your executor key, so the engine can trade 24/7 without a |
| `lib/keystore.cjs` | Persistence without plaintext. Two encrypted files, both unlocked by a passphrase only you know: |
| `lib/kms.cjs` | Executor signer backed by Google Cloud KMS. The key is an HSM-protected secp256k1 key (Cloud KMS supports that |
| `lib/knowledge.cjs` | The VP's documentation archive: every Chronos document (README, CHANGELOG, docs/*.md, docs/reference/*.md: the |
| `lib/liquidations.cjs` | chronos liquidations (2.9.18): a read-only measurement of Aave V3 liquidations on Arbitrum One and Base, before |
| `lib/live.cjs` | Glue between the chain and the engine. Read-only: nothing here can sign or send. |
| `lib/livestate.cjs` | The background engine publishes its state here; the dashboard follows it. Every write is HMAC-signed with the |
| `lib/llm.cjs` | The VP's AI brain: every AI key you set, used in turn, each one the fallback of the others. |
| `lib/milestones.cjs` | The road to cash, driven by the VP. Eight milestones in order (each is the version it unlocks in the version map, |
| `lib/mind.cjs` | The VP's honeycomb mind-state: what the company knows right now, one cell per topic (a blocker, a route, a pool, a |
| `lib/mirror.cjs` | Every failure, mirrored. When a route fails, the price gap that made it lose points the other way: the same pools in |
| `lib/mode.cjs` | Automatic shadow ↔ live switching. SHADOW simulates every approved opportunity with your contract's exact call. |
| `lib/money.cjs` | The money view: are we making money, what is stopping it right now, how to fix that, and how long it should take. |
| `lib/narrate.cjs` | Live commentary (2.9.17): the engine explains what it is doing, in plain words, as it happens, and `chronos narrate` |
| `lib/nodepool.cjs` | Every Arbitrum node you set works, staggered. Each scan goes to the node with the most room that is free right now: |
| `lib/notify.cjs` | Alerts that reach you without the dashboard open: an Android notification (Termux:API) and/or your webhook |
| `lib/payout.cjs` | chronos payout: moves the profit your contract holds to your wallets, Policy T1 applied. |
| `lib/phone.cjs` | `chronos phone`: keeps the engine running on an Android phone, checked and fixed in one go. |
| `lib/policies.cjs` | Your policy baseline (POLICIES_AND_PROCEDURES_FLASHLOAN_ARB.md, POLICY_P0.md) as live checks. |
| `lib/profit.cjs` | "Running smoothly" means profiting. This is the path from where you are to verified on-chain profit. |
| `lib/providers.cjs` | What each node provider can do for Chronos, from its own documentation (sources below, checked 2026-11-25), so the |
| `lib/realcheck.cjs` | The real counterpart of every stand-in in the test suite. The tests use local stand-ins (a local chain, test |
| `lib/realized.cjs` | Realized profit, from receipts only. A transaction counts when it is confirmed (status 1) and YOUR ChronosFlashArb |
| `lib/record.cjs` | Reads your on-chain record (data/verified_mainnet_actions.json). Only entries with a real tx hash count as transactions. |
| `lib/relay.cjs` | The price-move relay: one node's log stream serves every engine. |
| `lib/releasegate.cjs` | The release gate: every version passes ALL of these before it can be packaged (package.sh runs `chronos |
| `lib/remedy.cjs` | Pre-coded resolutions for every known problem. Each one is either AUTOMATIC (safe and reversible: the engine does it |
| `lib/research.cjs` | chronos research: what the arbitrage that actually lands on Arbitrum One looks like (flash loans and own-capital |
| `lib/resolver.cjs` | Incident resolver: every problem the engine detects, or an error line in its log, opens an INCIDENT. The resolver |
| `lib/roles.cjs` | Device roles: one primary (your laptop) does the heavy work, the others stand by. |
| `lib/safety.cjs` | Safety helpers used everywhere text from outside reaches the screen or a log. |
| `lib/scan.cjs` | Orchestration: find every cycle the pools' own prices allow, flip the best ones (other direction, other borrow |
| `lib/service.cjs` | Runs the engine as a background service with PM2 (which you already use), starts it again at phone boot with |
| `lib/session.cjs` | Counts opportunity EPISODES across scans: a route that stays approved for several scans is one opportunity, not many. |
| `lib/settingswatch.cjs` | One workspace on every device (sync/workspace-sync.sh): when your .env changes because you edited it on another |
| `lib/shadow.cjs` | Shadow test: your contract's exact call against real chain state, with nothing sent. |
| `lib/spend.cjs` | The daily spending cap you approved: one ledger for every cost that a profit does not pay back, per UTC day. |
| `lib/success.cjs` | Building on success, with the same care as handling failure. Every cycle the VP spends one pass on problems |
| `lib/sync.cjs` | Engine -> Supabase sync. One-way, signed, and never in the way of trading: a failure here is logged and |
| `lib/system.cjs` | Real system inventory: RPC nodes from your .env (names only, never URLs), PM2 services, capabilities. |
| `lib/team.cjs` | The VP's standing team: eight stationary specialists, one per angle, designed by the VP's charter. Every VP cycle |
| `lib/tempo.cjs` | Tempo: the engine works harder exactly when there is something to win, and eases off when there is not. |
| `lib/thresholds.cjs` | GO thresholds and scan interval from .env (interval: TUI_REFRESH_SEC, else MEASURE_INTERVAL_SEC, else 20 s). |
| `lib/tokens.cjs` | Token discovery: which tokens to look for pools between, beyond Aave's own reserves. |
| `lib/v2probe.cjs` | Contract v2's real-protocol probe (source: the contract project's test/ForkProbe.sol). Sent as ONE eth_call with no |
| `lib/vocab.cjs` | The words your database accepts (its CHECK constraints). The engine only sends these: agents.event() maps a severity |
| `lib/voice.cjs` | The voice for chronos narrate (2.9.17): the text-to-speech already on your device, free and offline-capable. |
| `lib/vpagent.cjs` | The VP's analyst: an AI agent (lib/llm.cjs: every AI key in turn) that works a question to a decision with real |
| `lib/vpaudit.cjs` | The VP's audit after every task it completes (a setting applied or verified, a delegation done, a milestone gained or |
| `lib/walletbridge.cjs` | MetaMask (or any browser wallet) as your owner wallet, without your private key ever leaving the wallet. |
| `lib/watchdog.cjs` | The hang watchdog. The engine's main loop calls beat() on every pass. A separate thread (worker_threads) watches |
| `lib/webhook.cjs` | Alert webhook: incidents, resolution attempts, verifications and escalations are POSTed as JSON to the https url you |
| `tui/ansi.cjs` | Minimal ANSI toolkit: colour (truecolor with 256-colour fallback), width-safe truncation and padding. |
| `tui/app.cjs` | Chronos console: a full-screen terminal dashboard over the read-only scanner. |
| `tui/assist.cjs` | `chronos assist ["question"]`: the help agent on the command line. Checks this device and its engine, lists every |
| `tui/deploy.cjs` | `chronos deploy` screen. All reads are live; every transaction is listed with its gas estimate and worst-case cost |
| `tui/executorkey.cjs` | `chronos executor import \| unlock \| lock \| status` (2.9.11): your own operator key signs trades on this phone. |
| `tui/hd.cjs` | High-resolution terminal graphics for the dashboard: braille charts (2×4 dots per character, so a 40×8 chart has |
| `tui/keys.cjs` | `chronos keys`: every wallet address and key Chronos uses, in one sitting, in order. Each is typed (secrets hidden), |
| `tui/liquidations.cjs` | chronos liquidations [days] [--arbitrum\|--base]: the read-only measurement in lib/liquidations.cjs, printed in |
| `tui/mainnet.cjs` | `chronos mainnet`: every remaining step to trade on Arbitrum One, in order, from this phone or computer. Safe to run again: it |
| `tui/narrate.cjs` | chronos narrate (2.9.17): reads the engine's live commentary aloud, as it happens. |
| `tui/owner.cjs` | The owner wallet for an action you start (deploy, venue settings, operator, payouts): MetaMask when you ask for it |
| `tui/payout.cjs` | `chronos payout`: profit in your contract → T1 reserve + payout wallet. See lib/payout.cjs for the rules. |
| `tui/prompt.cjs` | Small interactive prompts for the setup screens: arrow-key menus, masked secret entry, validated input. |
| `tui/research.cjs` | `chronos research [hours]`: the flash-loan arbitrage that actually landed on Arbitrum One recently, read through your |
| `tui/setup.cjs` | chronos setup — guided, interactive setup in the terminal. |
| `tui/tune.cjs` | chronos tune small-trades \| undo (2.9.19): research change #1 (2026-11-26), as one decision you approve. |
| `tui/widgets.cjs` | Dashboard building blocks: boxes, tables, bars, money and status chips drawn with the shared ANSI theme. |
| `go.sh` | Chronos in one command, on any device you approve: |
| `install.sh` | Chronos console installer for Termux (also works on Linux/macOS). Offline: the one runtime library (ethers and |
| `cloud/gcp-setup.sh` | Chronos on Google Cloud in one script. Run it in Google Cloud Shell (shell.cloud.google.com), which is already |
| `scan.cjs` | One read-only scan: real on-chain quotes, real Aave premium, real oracle prices. Sends nothing. |
| `measure.cjs` | Measurement run: scan for a fixed window, count distinct opportunity episodes (one per cycle), print GO / NO-GO. |
| `registry_audit.cjs` | Checks every pool in your src/registry.ts against the chain: is it really the exchange, pair and fee tier it claims? |
| `calibrate_gas.cjs` | Turns your real confirmed transactions into measured gas numbers. Usage: node calibrate_gas.cjs 0xHASH [0xHASH ...] |
<!-- /GENERATED:modules -->

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · **Architecture** · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
