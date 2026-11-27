# Operations runbook

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · **Operations** · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

## First-time setup, in order

One command does the phone side in this order and hands the Google Cloud side to one Cloud Shell command:
`chronos mainnet` (run it again after Cloud Shell; finished steps are skipped). The table is what it does.

| # | Step | Command or place | Done when |
| --- | --- | --- | --- |
| 1 | Install on the device | put `chronos-console-<version>.tgz` in Downloads, run the one-command installer | the dashboard opens |
| 2 | Approve the device | portal → Devices → match the pairing code | `chronos device` says approved |
| 3 | Keys and settings | `chronos setup` (imports env-style files on the device, tests each key) | `chronos doctor` shows no missing settings |
| 4 | Websocket feed | `chronos set ARBITRUM_WSS_URL` (hidden prompt; tested live) | portal → Scanner: feeds up, pools watched |
| 5 | Wallets for profit | `chronos set TAX_RESERVE_VAULT 0x…`, `chronos set PAYOUT_WALLET_ADDRESS 0x…` | both saved (checksummed) |
| 6 | Executor key | run `cloud/gcp-setup.sh` in Google Cloud Shell, approve device `chronos-engine` | the script prints the executor address and KMS key name |
| 7 | Executor settings | `chronos set CHRONOS_EXECUTOR_ADDRESS …`, `chronos set CHRONOS_EXECUTOR_KMS_KEY …` | `chronos doctor` shows the executor |
| 8 | Contract | `chronos deploy` (costs shown, type YES) | contract deployed, routers allowed, executor is operator and funded |
| 9 | Portal | upload `chronos-portal.tgz` to Cloud Shell, `tar xzf chronos-portal.tgz && sh chronos-portal/deploy.sh`, sign in | portal shows heartbeats |

The engine starts in SHADOW. It switches to LIVE on its own only when your promotion rules hold (see
[Configuration](CONFIGURATION.md#execution-policy)).

## Updating

- **Normal path (automatic):** on your phone the engine checks every hour and installs a newer release by itself
  (`CHRONOS_AUTO_UPDATE`, on by default; `off` only notifies, every 6 hours). `chronos update` installs it now. Every archive's sha256 is verified before install; your `.env` and `data/` are kept.
- **From a file:** put the new `chronos-console-<version>.tgz` in Downloads and run the one-command installer. If this
  device may publish, it also publishes the release to your other approved devices.
- **Contract changes** are never automatic: a new contract version is deployed only by `chronos deploy` after you
  approve it.

## Daily operation

| Watch | Where | Healthy |
| --- | --- | --- |
| Engine alive | portal → Engine, dashboard header | heartbeat under 90 s old |
| Scans current | dashboard → Path to profit, stage 2 | last scan within 3 × the scan interval |
| Block feed | portal → Scanner, dashboard System tab | at least one websocket feed up |
| What blocks trades | portal → Scanner "blocked by", dashboard Measure tab | understood; change a limit only on purpose |
| Shadow results | portal → Shadow tests | wins before LIVE |
| Realized profit | portal → Realized (receipts only) | positive after gas |
| Approvals | portal → Needs your approval | decided before they expire |
| Real checks | portal → Real checks, `chronos verify-real` | no fail; "not run" only where nothing is configured |
| Your contract | portal → Scanner "your contract" | v2 to borrow from Balancer and swap pools directly |

`chronos research 6` shows what flash-loan arbitrage actually landed on Arbitrum in the last 6 hours (contracts,
legs, venues, gas, kept), and the portal shows its summary.

## Keeping the engine running on your phone

Android may close Termux (swiped away, battery optimisation, low memory), and the engine stops with it. `chronos phone`
fixes what can be fixed from Termux and lists the rest: it starts a stopped engine, makes Termux start it again every
time you open Termux, holds the wake lock, sets up boot start (needs the Termux:Boot app from F-Droid), opens the battery
settings (set Termux to Unrestricted), checks notifications (Termux:API) and checks the engine is reaching your portal.
It is safe to run any time; `chronos mainnet` runs it first.

## Your executor key on the phone (2.9.11)

Until the Cloud KMS executor runs, your own operator account can sign trades on the phone:

1. `chronos executor import`: type its private key at the hidden prompt (Termux, never in chat) and pick a passphrase
   (twice). It is kept only in the encrypted keystore; the owner key is refused here.
2. `chronos executor unlock` (asked at the end of import too): starts the key agent. The engine picks it up within a
   minute; `chronos executor status` shows the agent and checks your real contract (operator, gas, refusal probes).
3. After a phone restart the agent is locked: you get a notification, trading is held, and `chronos executor unlock`
   resumes it. Engine restarts never lock it.
4. `chronos executor lock` stops it at any time (for example once the Cloud KMS executor is live).

## Hearing what Chronos does (2.9.17)

`chronos narrate` reads the engine's live commentary aloud. Once on the phone: install the Termux:API app (F-Droid,
same source as Termux) and run `pkg install termux-api`; `chronos narrate --voices` lists your voice engines and
`chronos set CHRONOS_VOICE_ENGINE <name>` picks one (Google's speech engine has the most natural voices; choose the
voice itself in Android Settings → Text-to-speech). Space pauses and resumes, q quits; your place is kept.

## Moving to contract v2

Contract v2 (`ChronosFlashArbV2`) borrows from Balancer V2 (0% fee when last read) as well as Aave, and swaps directly
on V3 pools and V2 pairs of factories it allows, which costs less gas than going through a router. It is not
externally audited. In order:

1. `chronos verify-real` on your phone: its contract v2 line runs v2 against the real Aave, Balancer, Uniswap, Sushi
   and Pancake contracts in one eth_call (nothing sent). All 12 of its checks should pass.
2. `chronos deploy --v2 --plan`: every transaction and its worst-case cost, nothing sent. It deploys v2 with the Balancer
   vault, allows each checked venue's factory (V3 with fee 0; V2 with its swap fee measured on-chain, rounded up), makes
   your executor an operator, allows the routers and sets the loan caps.
3. `chronos deploy --v2` and type YES. Your v1 address is kept as `CHRONOS_FLASH_ARB_V1_ADDRESS` (still yours: withdraw
   from it any time); `CHRONOS_FLASH_ARB_ADDRESS` becomes v2 and the engine restarts on it.
4. The engine reads which contract it drives every hour. On v2 it borrows from Balancer when Balancer is cheaper and
   holds enough of the asset (otherwise Aave), swaps directly on pools and pairs of allowed factories (routers
   elsewhere), and shadow-tests each exact call against your contract before anything is sent, as before.

## Automatic resolution

Every problem the engine detects, and every error line in its log, opens an **incident**. For each incident the
engine:

1. runs the problem's researched resolutions **in order, one at a time** (table below);
2. **verifies** each one: it waits, then checks whether the problem is still there, and records the evidence;
3. **never repeats** a resolution within the same incident;
4. when the list is used up, lets the **AI agent** (if `OPENROUTER_API_KEY` and `CHRONOS_AGENT_MODEL` are set) pick up
   to two more steps, only from the allowlisted actions not yet tried, verified the same way;
5. **escalates to you** when nothing is left: phone alert, portal (agent activity), and your webhook, with the exact
   steps;
6. escalates at once a problem that **came back 3 times within an hour** after being resolved, instead of looping.

Death loops are broken separately: a crash-restart loop puts the engine in **safe mode** (shadow only, websocket feed
and fast lane off, no token discovery, 4× slower scans) until it has run 30 minutes without crashing; the recorded
crash cause is shown by `chronos assist`. Repeated scan failures re-initialise after 3, back off from 6 (at most 5
minutes between scans), and alert you at 10. The watchdog restarts a stalled engine at most 3 times an hour.

Nothing automatic touches keys, limits, deploys, code or funds.

<!-- GENERATED:resolutions -->
| Problem | Automatic resolutions, in order (each verified, never repeated) | When those are used up, you |
| --- | --- | --- |
| No RPC node answers as Arbitrum One | `web-reference-check` → `reinit` → `failover-node` → `backoff` → `reduce-load` | fix the url in chronos setup or add ARB_RPC_URL_2 |
| Node unreachable or timing out | `web-reference-check` → `reinit` → `failover-node` → `backoff` | check your provider; add a second node (ARB_RPC_URL_2) |
| Node rate-limited (HTTP 429) | `reduce-load` → `backoff` → `fast-lane-off` → `failover-node` | chronos nodes shows each plan's limits; raise the plan (INFURA_PLAN / SWIFTNODES_PLAN tell Chronos) or add a node from another provider |
| Node behind the chain | `failover-node` → `reinit` | switch provider or add a second node |
| Last scan failed | `reinit` → `failover-node` → `clear-market-cache` → `reduce-load` → `backoff` | read the message; chronos doctor |
| Stage 2 not met, 0 errors | `scan-now` → `reinit` → `restart-engine` | chronos service status, then chronos service restart |
| Many quotes failing | `reduce-load` → `failover-node` → `clear-market-cache` | check your node; chronos doctor |
| No executable venue passed its check | `web-reference-check` → `reinit` → `failover-node` | check venues.json against the chain (chronos audit) |
| Aave reports no flash-loanable asset | `web-reference-check` → `reinit` → `failover-node` | check Aave status; the engine stays in shadow |
| Websocket feed down | `restart-feed` → `fast-lane-off` | check the wss url (chronos set ARBITRUM_WSS_URL) |
| Portal sync backlog | `flush-sync` | chronos device (approved?), then check the portal |
| Disk full or state cannot be written | `prune-logs` | free space on the device |
| Trades reverting | `shadow-only` | read the shadow failures in the portal before changing limits |
| Nonce errors | `reinit` | make sure no other program sends from the executor address |
| Executor out of gas | none: only you can resolve it | send ETH on Arbitrum to the executor address (chronos deploy tops it up) |
| `Code integrity check failed` | none: only you can resolve it | chronos update (reinstalls the verified release) or re-seal a deliberate change |
| State file failed its signature check | none: only you can resolve it | something wrote to the engine state file: check the device; chronos service restart |
| Policy check failing | none: only you can resolve it | chronos doctor lists the policy and its fix |

| Action | What it does |
| --- | --- |
| `web-reference-check` | compare your node with Arbitrum's public endpoint (is the chain moving? is your node behind or down?) |
| `reinit` | re-initialise the chain connection, venues and pool list |
| `failover-node` | switch to your next configured RPC node |
| `backoff` | double the time between scans (at most 5 minutes) |
| `reduce-load` | halve parallel quotes and batch size, and pause the fast lane |
| `fast-lane-off` | pause the per-block fast lane (full scans continue) |
| `clear-market-cache` | drop the cached pool list and rediscover pools |
| `restart-feed` | reconnect the websocket block feeds |
| `scan-now` | start a scan immediately |
| `shadow-only` | stop sending for an hour (shadow tests continue; nothing is sent) |
| `flush-sync` | push the queued portal rows now |
| `prune-logs` | rotate engine logs larger than 5 MB (the last 1 MB is kept) |
| `restart-engine` | restart the engine (at most 3 times an hour) |
<!-- /GENERATED:resolutions -->

On this device, `chronos assist --fix` runs the terminal resolutions that need no decision from you (keep Termux
awake, start or install the engine service, create the device key), in order, verifying each.

**Webhook:** set `CHRONOS_ALERT_WEBHOOK_URL` (https) and optionally `CHRONOS_ALERT_WEBHOOK_SECRET` with
`chronos set`. Each incident, attempt, verification, resolution and escalation is POSTed as JSON with
`x-chronos-signature: t=<unix seconds>,v1=<HMAC-SHA256 of "t.body">`. Text is redacted; the same event is not sent
twice within a minute.

## Troubleshooting

`chronos assist` checks your device and engine, finds which of these rows apply, and shows the fix. Ask it a question
too: `chronos assist "why no trades?"`.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `curl: (22) … 404` on the first device | nothing published yet | put the release archive in Downloads; the installer uses it |
| engine stops; logs show `WebSocket was closed before the connection was established` or `provider destroyed` (before 2.9.12) | a websocket feed error that nothing caught | update to 2.9.12 or newer; then `chronos service start` (and `chronos phone` on phones) |
| `Chronos engine cannot start: exceeded maximum retry limit` | your node is rate-limiting or out of quota | 2.9.12 moves to your next node each minute; add a second provider (`chronos set ARB_RPC_URL_2`) or a paid plan |
| emails stop with `daily limit of 40 emails reached` in email_log | one alert repeating (before 2.9.12) | fixed server-side: repeats within 30 min are not emailed |
| update check: `Registry audit … N mismatch(es)` on every pool (2.9.8–2.9.11) | the Curve venue broke the audit | fixed in 2.9.12; what remains is real (`chronos audit` shows each pool) |
| update check: `Drive env files … rclone reported an error` | rclone's message was hidden | 2.9.12 shows it with its fix; `chronos verify-real` (drive-remote) tests Drive on its own |
| Drive: `your Drive sign-in for rclone expired` | Google token revoked or expired | `rclone config reconnect gdrive:` and sign in once |
| Drive: `took over 4 min to list` | a large Drive | `chronos set CHRONOS_DRIVE_ENV_FOLDER "<folder with your env files>"` |
| portal: killer `dead pool` | a route through a pool with almost nothing behind it | nothing to do: it is benched automatically; `DEPTH_MIN_USD` sets the floor |
| verify-real: `blockscout-witness` fails (before 2.9.15) | Blockscout indexing a few seconds behind, or asking for a key | 2.9.15 tolerates indexer lag and uses Etherscan (`chronos set ETHERSCAN_API_KEY`) when Blockscout does not answer |
| verify-real: executor-agent `no executor keystore on this device` | the phone key was never imported here | `chronos executor import`, then `chronos executor status` |
| `No speech engine on this device` (chronos narrate) | Termux:API missing | install the Termux:API app, then `pkg install termux-api` |
| narrate: `no voice engine answered` | Termux:API not allowed yet | open the Termux:API app once and allow it |
| log: `burst: every node is cooling down` | every node in the burst hit its limit at once | nothing to do: the next scan starts when the first node is back; add a node (`chronos set ARB_RPC_URL_2`) for more room |
| log: `burst mode: no node can join it` | every node may bill per request, or you have one node | add a free node, or `chronos set CHRONOS_BURST_NODES all` if you accept per-request billing |
| `executor key is locked (the key agent is not running on this phone)` | the phone restarted, or `chronos executor lock` | `chronos executor unlock` |
| `refused by the key agent: …` | something asked the phone key to sign a non-trade (or over the gas cap) | nothing was signed; if it is a real trade over the cap, raise `CHRONOS_AGENT_MAX_TX_ETH`, then lock and unlock |
| `the executor keystore here is 0x… but CHRONOS_EXECUTOR_ADDRESS is 0x…` | the key you imported is for another account | `chronos executor import` with the key for your executor, or set the address to the imported one and make it an operator (`chronos deploy`) |
| `the agent was unlocked for contract 0x…, yours is now 0x…` | you deployed a new contract after unlocking | `chronos executor lock`, then `chronos executor unlock` |
| `chronos deploy` says `CONTRACT_ADDRESS … is not a ChronosFlashArb` | that address belongs to another tool | nothing to do: Chronos uses `CHRONOS_FLASH_ARB_ADDRESS` and leaves the other key alone |
| `not a valid 0x address (checksum failed)` | a placeholder or mistyped address | paste the real address from your wallet |
| Portal shows no data from a device on 1.1.0 | 1.1.0 used the retired shared secret | install 2.0.1 or newer; it signs with the device key |
| `this device is not enrolled yet` | device key missing or not approved | `chronos device`, then approve the pairing code in the portal |
| Stage 2 not met, 0 errors | scans stale: engine stopped or dashboard not following it | `chronos service status`, then `chronos service restart` |
| Engine stops when the phone screen is off | Android killed Termux | run `termux-wake-lock` in Termux |
| `Code integrity check failed` | code differs from its seal | reinstall the release, or `chronos unlock` → change → `chronos seal` if deliberate |
| Foreign files reported by `chronos doctor` | files from another project in the Chronos folder | move them out (do not delete without checking what they are) |
| No routes approved for hours | real market: gaps closed or below your floor | read "blocked by" and `chronos research`; lower a limit only deliberately |
| Broken pools are taking the quotes | the best route loses ~100% of its size: a drained pool with a fake price, not the market | `chronos update` (2.9.6 leaves pools more than 20% from the oracle out of routing) |
| Engine keeps crashing (safe mode) | an error stops the engine again and again | `chronos assist` shows the recorded cause; fix it, then `chronos service restart` |
| Node unreachable or timing out | the provider is down, slow, or the network dropped | automatic: reference check, re-initialise, switch node, back off; you: check your provider, add `ARB_RPC_URL_2` |
| Node rate-limited (HTTP 429) | too many requests for your provider plan | automatic: lower load, back off, pause fast lane, switch node; you: raise the plan or add a node |
| Node behind the chain | your node's block is well behind Arbitrum's public endpoint | automatic: switch node, re-initialise; you: change provider |
| Many quotes failing | node trouble or a pool that changed | automatic: lower load, switch node, rediscover pools; you: `chronos doctor` |
| No executable venue passed its check | a venue address changed or the node is wrong | automatic: reference check, re-initialise, switch node; you: `chronos audit` |
| Aave reports no flash-loanable asset | node trouble or Aave paused | automatic: reference check, re-initialise, switch node; the engine stays in shadow |
| Websocket feed down | the websocket provider dropped or the url is wrong | automatic: reconnect, then fall back to timed re-checks; you: `chronos set ARBITRUM_WSS_URL` |
| Portal sync backlog | the device cannot reach the portal or is not approved | automatic: push the queue; you: `chronos device`, approve in the portal |
| Disk full or state cannot be written | the device ran out of space | automatic: rotate large engine logs; you: free space |
| Trades reverting | the market moved between simulation and inclusion | automatic: stop sending for an hour (shadow continues); the profit guard also returns to shadow |
| Nonce errors | another program sends from the executor address | automatic: re-initialise; you: use the executor address for Chronos only |
| Executor out of gas | the executor's ETH ran low | you: send ETH on Arbitrum to the executor (`chronos deploy` tops it up) |
| State file failed its signature check | something other than the engine wrote its state file | you: check the device, then `chronos service restart` |
| Policy check failing | a policy from your baseline is not met | you: `chronos doctor` lists it and its fix |
| Settings missing | required settings are not in `.env` | `chronos setup`, then `chronos doctor` |
| No RPC node answers as Arbitrum One | url wrong, provider down, or not chain 42161 | check the url in `chronos setup`; add a second node (`ARB_RPC_URL_2`) |
| Device not approved yet | the pairing code has not been approved in the portal | portal → Devices → approve the code `chronos device` shows |
| Engine not running | service stopped or never installed | `chronos service install` (first time) or `chronos service start` |
| Last scan failed | node, quote or settings error shown in the message | read the message; `chronos doctor`; the watchdog restarts a stalled engine |
| No websocket feed | no `wss://` url set, so re-checks run on a timer | `chronos set ARBITRUM_WSS_URL` (hidden prompt, tested live) |
| No executor yet | the Cloud KMS signing key is not set up | run `cloud/gcp-setup.sh` in Cloud Shell, then `chronos set CHRONOS_EXECUTOR_ADDRESS` and `CHRONOS_EXECUTOR_KMS_KEY` |
| Contract not deployed | `CHRONOS_FLASH_ARB_ADDRESS` is not set | `chronos deploy` (costs shown, type YES) |
| Profit wallets not set | `TAX_RESERVE_VAULT` or `PAYOUT_WALLET_ADDRESS` missing | `chronos set TAX_RESERVE_VAULT 0x…` and `chronos set PAYOUT_WALLET_ADDRESS 0x…` |

## Database: one-time SQL for 2.9.7
Run once in the Supabase SQL editor (project qpjbikkfkpzywyzanrgv). It lets the VP's audits into `reports` and removes
the default public grants on the new tables and views (row-level security already hides every row; this closes the
grants too):

```sql
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind = any (array['daily-report','alert','build-request','audit']));
revoke all on public.chain_trades, public.pool_moves, public.competitors, public.venue_usage, public.chain_policies, public.chain_indicators, public.chain_numbers from anon, authenticated;
grant select on public.chain_trades, public.pool_moves, public.competitors, public.venue_usage, public.chain_policies, public.chain_indicators, public.chain_numbers to authenticated;
revoke all on function public.chronos_pool_moves_broadcast(), public.chronos_prune_moves() from public, anon, authenticated;
```

## Rollback

The installer only moves forward to newer releases, so a rollback is done by hand. Your `.env` (in the workspace
folder) is untouched; `data/` is copied across.

```sh
cd ~/workspaces/chronos-master-workspace
chronos service stop
mv chronos-console chronos-console.prev
tar xzf /sdcard/Download/chronos-console-<previous version>.tgz
cp -r chronos-console.prev/data chronos-console/
(cd chronos-console && sh install.sh)
chronos service start && chronos doctor
```

The contract is unaffected by engine rollbacks. To stop all sends immediately without touching the engine, run
`chronos set CHRONOS_MODE shadow`, or pause the contract from the owner wallet.

## Incident response

| Incident | Do now | Then |
| --- | --- | --- |
| A secret was exposed (chat, screenshot, shared file) | rotate it at the provider; set the new value with `chronos set KEY` | check the provider's usage log; restrict the file's sharing |
| Executor key suspected compromised | disable the KMS key version in Google Cloud; `chronos set CHRONOS_MODE shadow` | remove the operator with `setOperator(executor, false)` from the owner wallet; create a new key |
| Repeated reverts | the profit guard returns the engine to SHADOW after losses; confirm in the portal | read the shadow failures; adjust limits only after understanding them |
| Unknown device in the portal | Deny or Revoke it | review approved devices; only approved devices receive releases |
| Funds left in the contract | `chronos payout` | verify the receipts in the portal |

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · **Operations** · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
