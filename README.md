# ◆ Chronos console

<!-- GENERATED:nav -->
**Project home** · [Docs home](docs/README.md) · [Company](docs/COMPANY.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Commands](docs/COMMANDS.md) · [Operations](docs/OPERATIONS.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Releasing](docs/RELEASING.md) · [Server API](docs/API.md) · [Changelog](CHANGELOG.md)
<!-- /GENERATED:nav -->

A flash-loan arbitrage system for Arbitrum One that runs itself: a 24/7 engine with a **shadow test** of your own
contract and **automatic live execution** once the shadow test proves profit, a terminal dashboard, an autopilot
installer, phone alerts and a one-script Google Cloud deployment. There is **no private key anywhere in this code**:
trades are signed by an HSM key in Google Cloud KMS that cannot be exported, and `chronos deploy` uses your owner key
from your `.env` if you keep one there, otherwise asks for it hidden for that run only; Chronos never writes it.

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

**Documentation:** [architecture](docs/ARCHITECTURE.md) · [configuration](docs/CONFIGURATION.md) ·
[commands](docs/COMMANDS.md) · [operations](docs/OPERATIONS.md) · [security](docs/SECURITY.md) ·
[testing](docs/TESTING.md) · [releasing](docs/RELEASING.md) · [changelog](CHANGELOG.md).
Reference sections are generated from the code and checked on every test run and every package build.

## What Chronos is, and what it is not
Chronos is one thing: a flash-loan **arbitrage** engine for Arbitrum One with its own payout, tracking and device
control. Its revenue is the profit your contract makes, proven by receipts. It does **not** run your other businesses
(cleaning, cloud services, real-estate data and so on): their income does not pass through a smart contract, so it
can only be **recorded** — in the portal's *Other income* ledger, by you, each entry with its evidence — not earned or
moved by this code.

## Start here
**Any device, one command** (Termux on Android, or Linux/macOS with Node 18+):

    sh -c "$(curl -fsSL https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/release)"

It makes this device's key and shows a **pairing code**; approve that code in your portal → *Devices*. Then it
downloads the newest private release (sha256-checked), installs or upgrades it, runs `chronos deploy` (your contract;
nothing is sent until you type YES) and opens the dashboard. Run it again any time: it is also the update.
**First device ever** (nothing published yet): put `chronos-console.tgz` in Downloads and run
`sh /sdcard/Download/go.sh` or extract and run `sh chronos-console/go.sh` — it installs from Downloads and, if you approved
the device with *may publish*, publishes it for your other devices.

| # | Where | What you type | What happens |
|---|---|---|---|
| 1 | phone | the one command above | device approved, installed, engine running in shadow, contract deployed |
| 2 | phone | `chronos cloud-pack` | writes `chronos-settings.env` (your settings, no secrets) |
| 3 | Google Cloud Shell | upload `chronos-console.tgz` + `chronos-settings.env`, then `tar xzf chronos-console.tgz && bash chronos-console/cloud/gcp-setup.sh PROJECT_ID` | HSM key, VM, secrets (typed hidden); prints your executor address |
| 4 | phone | `chronos set CHRONOS_EXECUTOR_ADDRESS 0x…` then `chronos deploy` | makes the executor an operator and sends it the gas it lacks |
| 5 | portal | approve the device named `chronos-engine` (the cloud engine) | the portal fills with both engines' records; nothing to copy |
| 6 | phone, when profit is in the contract | `chronos payout` | T1 reserve to `TAX_RESERVE_VAULT`, the rest to `PAYOUT_WALLET_ADDRESS` |

After step 4 the cloud engine shadow-tests your contract every scan and switches to live by itself when your rules are
met.

## Payouts (chronos payout)
The contract can only withdraw to its owner, so `chronos payout` (your owner key, typed hidden or from .env, never
stored) withdraws each token to the owner wallet and sends it on in the same run:
* **Amounts**: the contract's balances at one block, each confirmed by a second source (second node at that block, or
  Blockscout). A token the sources disagree on is not paid out that run.
* **Policy T1**: reserve = `POLICY_T1_TAX_BPS` (30%) of *net* = value − the gas every execution paid since your last
  payout (from each receipt, succeeded or reverted), at the Aave oracle prices of that moment; rounded up, never short.
* Every transaction is listed with its cost before you type YES; `--plan` sends nothing. A run that stops part-way is
  finished by the next one. Each transaction hash goes to `data/payouts.jsonl` and the portal's *Payouts*.

## Devices and private releases
Every device holds its own Ed25519 key (`~/.chronos/device.key`, mode 600; never leaves the device). A device that asks
to join shows a pairing code; nothing is served to it until you approve that code in the portal. You choose which
devices may *publish*. Releases live in a private Supabase Storage bucket; an approved device gets a 120-second link and
checks the sha256 before installing. The engine checks for a newer release every 6 hours and offers it (phone alert +
dashboard header); `chronos update` installs it. Revoke a device in the portal and it gets nothing from then on.
`chronos device` shows this device's status and pairing code; `chronos publish` publishes the newest archive in
Downloads.

## Other income (portal)
For income that does not land in a crypto wallet. Each entry needs a date, business, amount, currency, how it was paid
and evidence (invoice number, bank reference, link); amounts cannot be edited after saving (delete and re-enter), so
the ledger stays an honest record. Totals are shown per currency, with what you set aside for tax.

## Install from a downloaded archive (what the one command does for you)
    F=$(ls -t /sdcard/Download/chronos-console*.tgz | head -1)
    tar xzf "$F" -C ~/workspaces/chronos-master-workspace/ && cd ~/workspaces/chronos-master-workspace/chronos-console && sh install.sh

`install.sh` works **offline** and shows a 5-step progress bar: it checks every file against the seal the archive
shipped with, unpacks the runtime library from the sealed bundle (`vendor/deps.tgz`: ethers 6.17.0 and its
dependencies, 0.7 MB; no network, no npm), installs the `chronos` command and a Termux:Widget shortcut, seals and locks
the code and the library, then runs the **autopilot** (each step timed, summary bar at the end):

| Step | What it does |
|---|---|
| Integrity | refuses to continue if any code file or library differs from the seal |
| .env | finds or creates it, sets permissions 600 (Policy S0) |
| Drive keys | if rclone has your `gdrive:` remote, pulls only .env-style files to a private folder |
| Import | every key with exactly one value on the phone is tested (live where possible) and saved; conflicts are left for you; the pulled Drive copies are deleted afterwards |
| Settings | missing scanner/measurement/policy values get suggested starting values (listed in `data/defaults_applied.json`) |
| Backup scripts | disables the lines that put `.env` into Drive backups (backup kept, syntax checked, multi-line cases left to you) |
| Quarantine | moves known fake-profit scripts to `_quarantine/` |
| Engine | starts the 24/7 engine under PM2 early, so it is already scanning while the checks below run; boot start via Termux:Boot, Termux wake lock |
| Node · audit · gas · profit | run at the same time: RPC probe, `src/registry.ts` audit, gas from your receipts, realized profit |
| First scan | taken from the engine (or scanned here with `--no-service`) and reported |
| Report | what came online, and the short list only you can do (also in `data/autopilot_report.txt`) |

Run it again any time: `chronos autopilot` (safe to repeat; it only changes what still needs changing).
Flags: `--no-service`, `--no-drive`, `--no-scan`; `sh install.sh --no-auto` installs only. Installing a new version
over an old one keeps `data/` (history, measurements, keys for signed state) and moves files the new version no longer
ships to `data/leftovers-<time>/` instead of deleting them.

## The money panel
The first thing on the Overview (and in full on the Measure tab), on every screen width:

    Making money?   NO   no Arbitrage receipts from your contract yet
    Path to profit  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━───────────────────────────  3/7 done
    Blocking now    4 · GO verdict from a measurement run
      why   episodes 3/5 · distinct blocks 1/5 · $/day after 10 more min
      fix   nothing to do: keep the engine running, it measures continuously
      time  about 10 min at the current rate
    Upside          $/day shown after 10 more min of data · 3 opportunities in 1 scan

* **Making money?** comes only from receipts of your contract (YES shows net after gas and the count of verified
  executions; executions that lost money are named as such).
* **Blocking now** is the first unmet stage of the path to profit, with **why** (from the last real scan: rejection
  mix, the closest route's gross − flash fee − gas = net and how far it is below your floor, node or scan errors),
  **fix** (what to press or set, or "nothing to do" when the engine handles it) and **time**.
* **Time** is a rate from this session's own data when one exists; when it depends on the market it says so
  ("cannot be estimated") instead of guessing. The scan progress bar shows on the engine card while a scan runs.

The same status is **pinned in your phone's notification shade** while the engine runs (Termux:API): headline
(stage N of 7, or PROFITING with the net), progress bar, blocker, time, best quote now, with **Scan now** and
**Pause / Resume** buttons. It is edited in place without sound, refreshed after scans (at most once a minute unless
the stage changes), and turns into a dismissible "engine stopped" notice when the engine stops.

## Use
    chronos               dashboard (follows the background engine when it runs)
    chronos service …     install | status | start | stop | restart | logs | uninstall
    chronos setup         keys (masked paste, tested), settings, action checklist   (or press e)
    chronos doctor        settings, policies, nodes, services, integrity as text
    chronos scan | measure | audit | gas 0xTX… | verify | seal | unlock | test

Dashboard tabs: **1 Overview** (money panel, MODE shadow ↔ live with the switch conditions, gas, best opportunity,
engine with live scan progress, verified balances, opportunities (profitable ones only), GO/NO-GO, recent scans) ·
**2 Routes** (profitable opportunities only; enter: legs, costs, every guardrail ✓/✗, the exact contract call) ·
**3 Measure** (money panel and MODE in full with the last shadow runs, path to profit, GO/NO-GO, session, episodes, edge) · **4 Policies** (P0 G1 T1 S0 INT, gas, floor, impact, drawdown, every parameter) ·
**5 System** (nodes, services, engine, alerts, batching, venues, Aave, registry audit, on-chain record, integrity,
realized profit, capabilities). Keys: `r` scan now · `p` pause/resume the engine · `L` scan in this window ·
`a` audit · `n` probe nodes · `e` setup · `?` help · `q` quit.

## Shadow test → live execution (automatic)
* **Shadow test** (always on): for the best approved routes of every scan, the engine checks every requirement of
  your ChronosFlashArb and of Aave for that exact call (deployed, not paused, executor is an operator, both routers
  allowed, amount within `maxLoan`, the contract's pool is Aave's, legs within `MAX_LEGS`, minProfit > 0, deadline,
  reserve active/not frozen/not paused/flash-loan enabled, Aave liquidity), then runs `execute(...)` as an `eth_call`
  from your executor at the scan block. The profit is the contract's own return value; a failure is the contract's
  own error, decoded (e.g. `Unprofitable(...)`, `Slippage()`), and a failed requirement names the owner call that fixes it.
* **Switch to LIVE** when all hold: executor ready (KMS key reachable, operator on the contract, gas ETH ≥
  `EXEC_MIN_GAS_ETH`), shadow wins in 24 h ≥ `PROMOTE_MIN_WINS`, win rate ≥ `PROMOTE_MIN_WIN_RATE_BPS`, simulated
  $/day ≥ `GO_MIN_USD_PER_DAY`. **Back to SHADOW** on any of: realized loss today beyond `MAX_DAILY_DRAWDOWN_USD`,
  `MAX_CONSECUTIVE_REVERTS` in a row, gas lost to reverts today ≥ `MAX_DAILY_GAS_USD`, executor gas low, kill switch
  (`data/live/kill`), `CHRONOS_MODE=shadow`. Money limits hold until the next UTC day; reverts hold 30 minutes and
  then need fresh shadow wins. In LIVE the shadow test keeps running on everything, so the MODE panel shows
  simulated $/day next to realized $/day: the gap is what competitors capture.
* **Every send** is re-checked and re-simulated at that moment; it goes out only if net ≥ your floor after the flash
  fee, gas and the **priority-fee bid**. Arbitrum One orders each 125 ms round by priority fee, so the executor bids
  `EXEC_TIP_SHARE_BPS` of the surplus above your floor, never more than a revert could cost inside today's cap.
  The contract's `minProfit` makes a trade revert rather than lose; a revert costs only its gas. Sizes are the
  profit-maximising size inside your ladder, capped by `maxLoan` and Aave liquidity: the largest loan is not the most
  profitable one, because price impact grows with size.
* Each sent transaction is written to `data/executions.jsonl` before waiting for it; realized profit is verified
  from its receipt (Arbitrage event of your contract, net of the gas actually paid), never from the engine's own
  numbers.
* All limits live in `.env` (`lib/execpolicy.cjs` lists them with bounds); values outside the bounds are refused.

## Agents (inside the engine)

| Agent | Does on its own | Waits for your approval |
|---|---|---|
| watchdog | records every problem and when it clears; restarts a stalled engine (max 3 per hour, then alerts you) | — |
| profit | reports every shadow ↔ live switch. The **profit guard** (`GUARD_MIN_SENDS`, default 5): after that many live sends in a UTC day, a realized net ≤ $0 switches back to shadow until the next day | — |
| tuner | — | a higher priority-fee share (`EXEC_TIP_SHARE_BPS`) when ≥ 4 live sends today and ≥ half reverted |
| requirements | reports each failing contract / flash-loan requirement once a day, with the owner call that fixes it | — |
| diagnosis | AI explanation of a new error (OpenRouter; set `CHRONOS_AGENT_MODEL`). Text only; nothing it says is run | — |

Approvals appear in the portal. The cloud stores only a reference and your yes/no: the change itself is kept on the
engine, so a decision can only apply something the engine proposed. Only execution-policy settings can be changed,
each within its bounds; nothing touches keys, addresses, contract code or funds. A change you made yourself in the
meantime, or a proposal older than 24 h, is not applied. After an approved change the engine restarts to load it.

## Portal data (Supabase)

The engine can copy its records to your Supabase project so the web portal (separate `chronos-portal` package, hosted on Firebase) can show them from any device. It is one-way and never in the way of trading: if the cloud is down, the rows queue (bounded) and retry with backoff.

Nothing to set up: every engine signs its records with its own device key (`~/.chronos/device.key`, never leaves the
device) and the portal accepts them only from devices you approved under *Devices*. There is no shared secret.

What is synced: profitable opportunities, shadow runs, mode changes, receipt-verified executions (and reverts), a 30-second heartbeat, and only balances a second source confirmed. Requests are HMAC-signed over timestamp + body (60 s window). The signing key and `.env` never leave the device.

## Balances: only externally verified
Executor, contract, payout wallet and tax reserve balances (ETH and every flash-loanable token) are read at one
block from your node and confirmed by an independent source: `ARB_RPC_URL_2` (a node from another provider, same
block, must match exactly) or the Blockscout explorer index. A balance the sources disagree on shows no number.

## Google Cloud (engine + HSM key)
`bash chronos-console/cloud/gcp-setup.sh PROJECT_ID` in Cloud Shell (steps 3–4 above). It creates the HSM secp256k1 key
(Google lists HSM key versions at $0.003424658/hour, about $2.50/month), a service account that can only sign with that
key and read its own secrets, Secret Manager entries (typed hidden; on the VM they live only in RAM), a private network
with no inbound traffic except IAP SSH, and an e2-small Shielded VM in us-east4 running the engine under systemd with
your `chronos-settings.env` (refused if it contains anything secret-looking). It prints the executor address; step 5
does the rest from your phone. Cross-chain price gaps are not flash-loanable (a flash loan must be repaid in the same
transaction on the same chain), so they are not listed as opportunities.

## chronos deploy
Deploys `contract/ChronosFlashArb.sol` — your Drive file, unchanged — as built in `contract/ChronosFlashArb.json`
(solc 0.8.24, OpenZeppelin 5.4.0, viaIR, optimizer 200; the exact bytecode the tests run; its sha256 is checked before
use). **Not externally audited.** Then, only where still missing: `setOperator(executor)`, `setRouter` for each
executable venue that passed its on-chain check, `setMaxLoan` per flash-loanable traded asset (your largest
`SIZE_LADDER_USD` × (1 + `MAX_LOAN_HEADROOM_PCT`, default 20%) at the Aave oracle price; caps you already set are kept),
and the ETH the executor lacks to reach `EXEC_GAS_TOPUP_ETH` (default 0.005). Every transaction is listed with the
node's gas estimate and the worst-case cost before you type YES; `--plan` shows that and sends nothing. It refuses a
contract address that holds no contract, one owned by another wallet, or one that borrows from another pool. Each
transaction is logged to `data/deployments.jsonl`.

## Finding opportunities
* **Every cycle, 2 to 4 legs.** Each scan reads every pool's price at one block and walks every loop that starts and
  ends in a token Aave will flash-loan: A→B→A, A→B→C→A and A→B→C→D→A, across every venue. Your contract runs up to 4.
* **Free screen, never a hidden profit.** A pool's marginal price (after its fee) is the best rate any trade through it
  can get; a loop whose prices multiply to less than 1 + the flash fee cannot profit at any size and is dropped before
  a quote is spent. A test checks this against exact pool math on random pools. Unreadable prices are never dropped.
* **Flips.** The best loops are also quoted the other way round and borrowed in every other flash-loanable token on
  them; the quotes decide which direction (if any) pays.
* **Real quotes decide.** Survivors are quoted by each venue's own quoter at the scan's block, sized inside your
  ladder, impact-checked per leg, and built into your contract's exact call (every leg has its own floor; the last
  must repay loan + fee + minProfit).
* **Fast lane.** Between full scans the engine re-checks the closest loops every `HOT_SCAN_MS` (default 3000 ms) at the
  newest block; anything approved goes straight to the shadow test and, in LIVE, to the executor.
* **Wider universe.** Aave's reserves plus up to `CHRONOS_DISCOVER_TOKENS` (default 40) tokens nominated by Blockscout's
  public list (market cap, traded in the last 24 h) and confirmed on-chain; every venue in the table under
  [Not verified here](#not-verified-here).
* **Live block feed.** Set one or more websocket urls (`ARBITRUM_WSS_URL`, plus `ARB_WSS_URL`, `ALCHEMY_WSS_URL`,
  `ARBITRUM_WSS_URL_2` for redundancy) in `chronos setup`; each is tested live (must answer as chain 42161). The fast lane
  then runs on every new block: the closest loops plus every loop through a pool whose price just moved.
* **Before the filters.** The Measure tab counts raw gaps at the screen size and, for every route a filter blocked,
  which filter and what it would have netted, so you see what is in front of the scanner, not only what passed.
* **chronos research [hours]** reads every flash loan of the last hours on Arbitrum (Aave, Balancer, Uniswap-style pool
  flashes) through your node: which contracts, how many legs, which venues (and factories you do not scan yet), gas,
  and what stayed with them. Saved to `data/research.json`. Read-only.
* **Indicators (Measure tab).** Cycles checked / allowed by price / within 10 bps; closest loops by edge; widest
  cross-pool spreads; biggest price moves; gas to beat for 2/3/4 legs; flash fees; Aave and Balancer flash liquidity;
  flip results. All from the scan's block.
* **Balancer comparison.** Balancer V2's flash fee (read on-chain: 0 bps on 2026-11-23) and what it can lend are read
  every scan; each route shows its net through Balancer. Your contract borrows from Aave only, so using Balancer is a
  contract change for you to approve.

## How the numbers stay real
* **One block per scan.** Every quote and price in a scan is read at the same block, so a spread can never be
  manufactured by mixing quotes from different blocks. Calls are batched through Multicall3 (hundreds of calls in a
  few requests); if batching fails, each call is retried alone at the same block.
* **Failures are failures.** A reverted, empty or undecodable answer is dropped, never turned into a number.
* **Net** = what comes back − what was borrowed − Aave flash fee (read from the pool) − gas (live gas price ×
  `GAS_UNITS_ASSUMED`, scaled per leg for 3-4 legs; the shadow test measures the real gas before anything is sent). Guardrails come only from `.env`; the optimiser tunes size inside your ladder.
* **Episodes** count each cycle once (both borrow directions of a cycle are the same opportunity). No verdict before
  10 minutes of data (MEASURING); the $/day figure is an upper bound with zero competition; GO means "worth a shadow
  test", not "profit is coming".
* **Profit** counts only from receipts: a confirmed transaction in which *your* contract emitted `Arbitrage` with
  profit above the gas that transaction paid. Nothing in a summary, log or database can raise it. Policy T1 reserve is
  30% of that net.

## Fail loudly until profiting
A red banner sits under the tabs while anything is wrong, and the engine alerts your phone (Termux:API) and/or
`CHRONOS_WEBHOOK_URL`. With no faults the banner still reads **NOT PROFITING** and names the first unmet stage:
1 settings and keys · 2 live scanner · 3 net-positive routes · 4 GO verdict · 5 shadow test · 6 reviewed contract live ·
7 verified on-chain profit. It turns green only at verified profit; once receipts prove profit, unmet checklist items stay unticked but no
longer block.

## Security
* **Integrity seal** over every code file, the lockfile, the library bundle and every runtime library installed from
  it (ethers and each dependency, per the lockfile; symbolic links are recorded, never followed); the dashboard, the
  engine and the autopilot refuse to run on a mismatch (the engine exits with code 78 so PM2 does not restart it).
* **Read-only code** after install. Deliberate change: `chronos unlock` → edit → `chronos test` → `chronos seal`.
* **Signed data**: scan history and the engine's state are HMAC-signed with a per-install key; anything typed or
  pasted into them is ignored and flagged.
* **No secrets on screen or in alerts**: node urls and key-like strings are scrubbed from every message; token
  symbols and file text are stripped of terminal control codes.
* `.env` writes: backup first (last 5 kept, 600), atomic rename, permissions 600, your lines and comments preserved.
* One runtime dependency (ethers 6.17.0, pinned, lockfile): `npm audit` 0 vulnerabilities. It ships as
  `vendor/deps.tgz`, built reproducibly by `vendor/build-deps.sh` (npm ci checks each package against the lockfile's
  sha512, then only the CommonJS build is kept; licence files stay). Test-only tools are never installed on the phone.
* Honest limit: someone holding your unlocked phone with a shell can unlock and re-seal. These checks stop accidents
  and casual tampering, not an attacker who already controls the device.

## Not verified here
Not run against Arbitrum mainnet, real Cloud KMS or real Google Cloud: the build sandbox reaches none of them.
* **Engine, shadow test, live executor, chronos deploy**: end to end on a local chain with test contracts standing in
  for Aave/Uniswap/Multicall3, your real contract bytecode, and a stand-in for Cloud KMS that signs the way KMS does
  (DER, including high-s signatures).
* **gcp-setup.sh**: run end to end against a stand-in `gcloud` that records every call; the VM startup script it
  generates was syntax-checked, not booted.
* **Supabase**: the deployed `ingest` and `decisions` function code was run under Deno against a stand-in database API;
  the database permissions (owner-only, no re-deciding, no expired approvals, anonymous blocked) were tested on the
  live project inside a rolled-back transaction.
* **On Arbitrum One itself (read through Blockscout)**: PancakeSwap V3 pool, quoter and router agree on one factory, and
  the router takes the exact swap call your contract sends.
Factory addresses marked `recall` in `venues.json` are checked on-chain at every start and switched off if wrong.
Sushi V3, Uniswap V2 and PancakeSwap V2 routers and the Sushi V3 quoter were confirmed on Arbitrum One through
Blockscout on 2026-11-23. A 3-leg route was run through your real contract bytecode on a local chain. Venues, from
`venues.json` (the file the scanner reads):

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

## Tests
    chronos unlock && npm ci      # adds the test tools (ganache, solc: ~100 MB)
    chronos test                  # every test, including the documentation check
    node test/mutate.cjs "$PWD"   # breaks one guardrail at a time; every one must fail a test
    chronos docs                  # regenerate the reference sections of the docs after a change
    chronos seal --yes            # sealed and read-only again

<!-- GENERATED:tests -->
**315 tests in 62 files; 269 planted bugs in `test/mutate.cjs`.** Run `chronos test`; run the planted-bug check with `node test/mutate.cjs "$PWD"`.

| Test file | Tests | Covers |
| --- | --- | --- |
| `test/wiring.test.cjs` | 5 | No component without an input or an output: every module is used by something and provides something; every |
| `test/engine.test.cjs` | 14 | Engine math and decisions: flash premium, sizing, guardrails, run parameters, and the synthetic-pool scan pipeline. |
| `test/chain.test.cjs` | 1 | Exercises lib/chain.cjs (the real ethers code the scanner uses on mainnet) against mock contracts on a local chain, |
| `test/realcheck.test.cjs` | 5 | Every stand-in has a real counterpart (test/counterparts.json → lib/realcheck.cjs), the contract v2 probe works |
| `test/v2engine.test.cjs` | 7 | The engine drives contract v2 end to end on a local chain with the real ChronosFlashArbV2 bytecode |
| `test/mainnet.test.cjs` | 4 | chronos mainnet: the right next step for every state, nothing skipped, nothing repeated, contract v2 offered only |
| `test/autoupdate.test.cjs` | 3 | Automatic updates: installed on the phone when a newer release is published, never while a trade is in flight, |
| `test/phone.test.cjs` | 3 | chronos phone: a stopped engine is started, the restart-on-open hook is written once (and updated, never |
| `test/envkeys.test.cjs` | 3 | Every environment variable the code reads is documented exactly once: your settings (lib/catalog.cjs), the |
| `test/server.test.cjs` | 6 | Nothing the code sends, reads or writes has nowhere to land: every table and column the engine sends is accepted |
| `test/visuals.test.cjs` | 4 | The Visuals tab shows real on-chain data only (P0): nothing before the first real scan; every screen names its |
| `test/alerts.test.cjs` | 4 | Where alerts go by default (your project's alerts function, device-signed), how `off` and your own url win, and |
| `test/handoff.test.cjs` | 4 | The executor hand-off: the cloud engine offers the address it derived from its KMS key; this phone saves it |
| `test/insights.test.cjs` | 4 | Path to profit: the closest routes of each scan are uploaded with their full cost breakdown and the one thing that |
| `test/milestones.test.cjs` | 7 | The road to cash: every milestone verified from its real source, the VP notifying you of each verified step (with |
| `test/success.test.cjs` | 4 | Building on success: real wins are noticed and told (first route above the floor, closest-ever route, shadow wins, |
| `test/mirror.test.cjs` | 3 | Every failure mirrored: a failed route's opposite direction (quoted in the same scan) is paired with it; a mirror |
| `test/indicators.test.cjs` | 6 | The 100 indicators: exactly 50 success and 50 failure, each measured from a real source or null (never a stand-in |
| `test/keys.test.cjs` | 5 | chronos keys: every wallet address and key in one sitting, in order; what is already on this device imported first |
| `test/keystore.test.cjs` | 6 | Persistence without plaintext: the owner key kept in the standard Ethereum keystore (scrypt + AES, unlocked by your |
| `test/keyagent.test.cjs` | 6 | Your executor key on this phone (2.9.11): the encrypted keystore, the key agent (a real detached process started |
| `test/emailreport.test.cjs` | 3 | The daily report email (2.9.12): steps left from today to $100,000, the road with who acts, the profit ladder with |
| `test/drivepull.test.cjs` | 3 | The Drive key pull (2.9.12): rclone's error is explained in words with its fix instead of "error"; harmless problems |
| `test/dataapis.test.cjs` | 2 | 1inch and Etherscan API keys (2.9.13): set at a hidden prompt with chronos set, checked live, never saved when the |
| `test/witness.test.cjs` | 2 | The independent-witness check (2.9.15): Blockscout first, Etherscan V2 (your key) when Blockscout does not answer. |
| `test/narrate.test.cjs` | 4 | chronos narrate (2.9.17): the engine's live commentary and the narrator that reads it aloud. Speech is played by |
| `test/liquidations.test.cjs` | 2 | chronos liquidations (2.9.18): Aave V3 liquidations read through Etherscan API V2, measured, gated. Etherscan is |
| `test/tune.test.cjs` | 2 | chronos tune small-trades (2.9.19): research change #1 as one approved decision: shown before → after, applied |
| `test/fan.test.cjs` | 6 | Burst mode (2.9.19, lib/fan.cjs): every scan read spread over all your nodes at once; a rate limit or a slow node |
| `test/providers.test.cjs` | 18 | Node providers: each plan's documented limits (Infura and SwiftNodes docs, sources in lib/providers.cjs and |
| `test/vpaudit.test.cjs` | 5 | The VP's audit: your checks, then Blockscout as the independent witness (chain head, your contract, every wallet, |
| `test/vpbrain.test.cjs` | 5 | The VP's brain, mind, archive and analyst. Real counterparts: chronos verify-real 'ai-agent' (your AI keys and model |
| `test/team.test.cjs` | 3 | The VP's standing team: seven agents, triggers on real state, allowlisted skills, a report each cycle, the VP's |
| `test/tempo.test.cjs` | 1 | Tempo: up when a scan measures something to win, down after quiet scans, inside every limit. Real counterpart: the |
| `test/gas.test.cjs` | 3 | The gas specialist: per route type (lender + pool kinds) from measured shadow gas, the executor's sends left and |
| `test/chainsignals.test.cjs` | 1 | Chain signals: groups, verdicts and the route prior, checked on two real Arbitrum One transactions of one competitor |
| `test/relay.test.cjs` | 2 | The price-move relay: the publisher batches moved pools into pool_moves rows (at most every 2 s, 500 pools a row), |
| `test/settingswatch.test.cjs` | 2 | The synced workspace: a .env changed on another device is applied once, after it settles; identical rewrites and |
| `test/roles.test.cjs` | 3 | Device roles: the primary works, standbys back it up, exactly one device sends, a silent primary is replaced by |
| `test/spend.test.cjs` | 4 |  |
| `test/watchdog.test.cjs` | 4 |  |
| `test/walletbridge.test.cjs` | 4 | MetaMask signing (lib/walletbridge.cjs): the real page, driven in a real browser (Chromium) where available, with a |
| `test/releasegate.test.cjs` | 1 | The release gate runs every check in a fixed order and never reports a skipped check as passed; the server record |
| `test/cycles.test.cjs` | 20 | Cycle finder: the free price screen never hides a profitable cycle (checked against exact constant-product math on |
| `test/blockfeed.test.cjs` | 4 | Websocket block feed against a real websocket node (a local chain on chain id 42161 serving ws://), plus a wrong-chain |
| `test/research.test.cjs` | 4 | chronos research: the analysis of real flash-loan transactions, checked on a hand-built receipt whose numbers are |
| `test/docs.test.cjs` | 3 | Documentation matches the code: every generated section is current, every module says what it is for, the changelog |
| `test/assist.test.cjs` | 6 | The help agent and the pre-coded resolutions: every problem the agent can find has a guide entry and a remedy; crash |
| `test/resolver.test.cjs` | 9 | Incident resolver: researched resolutions in order, each verified, never repeated; the AI agent may only pick |
| `test/company.test.cjs` | 13 | The company: departments report from real state; the VP runs experiments toward profit one at a time, verifies each |
| `test/batch.test.cjs` | 2 | Batching + block pinning against a local chain. Proves: one scan = one block, batched requests return exactly what |
| `test/realized.test.cjs` | 3 | Realized profit is read from receipts of YOUR contract (the real Drive ChronosFlashArb bytecode is used here). |
| `test/execution.test.cjs` | 8 | Shadow test → automatic live execution, end to end, with your real ChronosFlashArb bytecode on a local chain and a |
| `test/sync.test.cjs` | 8 | Engine to portal sync: device-signed requests, offline queue, retries, and only allowlisted fields leave the device. |
| `test/agents.test.cjs` | 8 | Agents inside the engine: watchdog restarts, tuner proposals through approvals, and changes applied only within policy. |
| `test/deploy.test.cjs` | 8 | chronos deploy, end to end on a local test chain (synthetic chain, test only): the real `chronos deploy` code path |
| `test/payout.test.cjs` | 2 | chronos payout end to end on a local test chain (synthetic chain, test only): your real contract artifact, deployed |
| `test/device.test.cjs` | 2 | This device's key and private-release downloads (a local stand-in plays the release function; test only). |
| `test/console.test.cjs` | 20 | Console rendering + policy checks. Synthetic state is used ONLY inside these tests. |
| `test/setup.test.cjs` | 6 | chronos setup and chronos set: key import, validation, hidden secret entry, and safe .env edits. |
| `test/engine-service.test.cjs` | 4 | The 24/7 engine end to end, against a local test chain (synthetic data, test only): |
| `test/autopilot.test.cjs` | 1 | Autopilot end to end in a fake phone home (synthetic test data only): keys pulled from "Drive" (fake rclone), |
<!-- /GENERATED:tests -->

---

<!-- GENERATED:nav -->
**Project home** · [Docs home](docs/README.md) · [Company](docs/COMPANY.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Commands](docs/COMMANDS.md) · [Operations](docs/OPERATIONS.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Releasing](docs/RELEASING.md) · [Server API](docs/API.md) · [Changelog](CHANGELOG.md)
<!-- /GENERATED:nav -->
