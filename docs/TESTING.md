# Testing

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · **Testing** · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

## Approach

- **Real code, real contracts.** Tests run the same modules the engine runs. Contract tests deploy your
  `ChronosFlashArb` bytecode to a local chain (ganache, chain id 42161) and execute real flash loans through it.
- **Synthetic data only in tests.** Pools, prices and tokens in tests are labelled test data; production reads
  everything from Arbitrum One.
- **Proofs against exact math.** The free price screen is checked against exact constant-product pool math on random
  pools: no route that is profitable at any size may be dropped.
- **Planted bugs.** `test/mutate.cjs` breaks one guardrail at a time (a removed check, an off-by-one floor, a wrong
  token) and requires the suite to fail. A planted bug that survives means a missing test. An interrupted run restores
  the source on its next start.
- **Install simulations.** Fresh install, upgrade and the one-command path are run from the packaged archive against a
  local chain and a stand-in release server before every release.
- **Documentation is tested.** `test/docs.test.cjs` fails when any document is out of date with the code.

## Suite

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

## Stand-ins and their real counterparts

The suite uses local stand-ins (a local chain, test contracts, fake Cloud KMS, sync, notification and webhook
endpoints) because it must prove behaviour the real systems cannot be made to produce on demand: a router that lies, a
pool that asks to be paid twice, a KMS key that is not HSM, a webhook that is down. A stand-in only prepares for the real
thing, so every one is paired with its real counterpart:

- `test/counterparts.json` lists every stand-in (test contracts, fixtures, fake servers and injected fetches, the local
  chain), the real system it stands in for, and the check in `lib/realcheck.cjs` that runs the same behaviour against
  that real system. `test/realcheck.test.cjs` fails if a stand-in is missing, an entry is stale, or a check is missing.
- `chronos verify-real` runs those checks on your device against Arbitrum One and your own services. It is read-only
  on chain. A check that cannot run where you are (no websocket url, KMS lives on the cloud engine) says why and is
  reported as *not run*, never as a pass.
- Contract v2's stand-ins are paired the same way in the contract project (`test/counterparts.json` there), and its
  real-protocol probe (`contracts/v2/ForkProbe.json`) runs inside `chronos verify-real` as one eth_call against the
  real Aave, Balancer, Uniswap, Sushi and Pancake contracts. Its profit checks make their own price gap inside the
  call, so they prove the machinery, not a market opportunity.

## What no test here can reach

The build environment cannot reach mainnet or your accounts, so these are verified by `chronos verify-real` on your
device (and on the cloud engine for KMS), not here:

- real Arbitrum One mainnet pools, quotes and gas;
- Google Cloud KMS signing with your HSM key;
- the deployed Firebase portal and live Supabase calls from your device;
- Android-specific behaviour (Termux lifecycle, storage paths).

The engine reports what it sees on mainnet to the portal, so these are observable once a device runs.

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · **Testing** · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
