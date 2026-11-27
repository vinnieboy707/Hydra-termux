# Commands

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · **Commands** · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

Every command is read-only unless the table says it sends. Commands that send always show each transaction's cost
first and wait for you to type YES.

<!-- GENERATED:commands -->
| Command | What it does |
| --- | --- |
| `chronos` | open the live dashboard |
| `chronos autopilot` | do everything that does not need you, then list what does |
| `chronos setup` | import keys from this phone, paste missing ones, settings, action checklist |
| `chronos set KEY` | change one setting or key (checked; secrets are typed hidden) |
| `chronos role R` | this device's role: primary (your laptop: does the heavy work, the only sender) or standby |
| `chronos ask "…"` | ask the VP's analyst (docs, logs, mind-state, Blockscout, allowlisted web; read-only) |
| `chronos archive` | the VP's documentation archive: search <words> · sync (copies your Drive documents, never secrets) |
| `chronos nodes` | every node and websocket: provider, plan limits (from their docs), its turn in the scans (alias: providers) |
| `chronos deploy` | deploy your ChronosFlashArb and set it up (asks YES before each send; --plan shows costs only; --v2 deploys contract v2: Balancer loans and direct pool swaps) |
| `chronos payout` | move your contract's confirmed profit: T1 reserve to TAX_RESERVE_VAULT, rest to PAYOUT_WALLET_ADDRESS |
| `chronos research [h]` | what flash-loan arbitrage actually landed on Arbitrum in the last h hours (default 2): contracts, legs, venues, gas, kept |
| `chronos service …` | background engine: install \| status \| start \| stop \| restart \| logs \| uninstall |
| `chronos cloud-pack` | write chronos-settings.env (your settings, no secrets) for the Google Cloud engine |
| `chronos keys` | every wallet address and key in one sitting, in order (websocket derived from your node when it can be) |
| `chronos keys export` | seal every setting and your owner keystore into chronos-keys.enc (passphrase) for another device |
| `chronos keys import` | restore them on a new phone or computer from chronos-keys.enc |
| `chronos owner save` | keep your owner private key encrypted here: deploy and payouts then ask only its passphrase |
| `chronos progress` | the road to cash: each milestone, verified from the chain, receipts and your checks |
| `chronos executor` | save the HSM executor your cloud engine offered (address + KMS key name; nothing to copy) |
| `chronos narrate` | the engine explains what it is doing, out loud, live (space pause/resume · n next · r repeat · q quit; your place is kept) · --voices · --from-start |
| `chronos update` | get the newest private release for this device, install it, deploy, open the dashboard |
| `chronos publish [F]` | publish a release (newest chronos-console*.tgz in Downloads) to your approved devices |
| `chronos device` | this device's approval status and pairing code |
| `chronos scan` | one scan, printed as text (sends nothing) |
| `chronos measure` | timed measurement run with GO / NO-GO (sends nothing) |
| `chronos audit` | check src/registry.ts pools on-chain |
| `chronos gas 0xTX…` | measured gas from your real transactions |
| `chronos doctor` | check settings, policies, nodes and services |
| `chronos assist [Q]` | help agent: finds every problem, says what is fixed automatically and what needs you; answers Q (--fix: run the safe fixes, each verified) |
| `chronos test` | run the test suite |
| `chronos phone` | keep the engine running on this phone: starts it, restarts it whenever Termux opens, wake lock, boot start, battery setting, checks it reaches your portal |
| `chronos mainnet` | every remaining step to trade on Arbitrum One, in order (settings, real checks, contract v2, executor); safe to run again |
| `chronos verify-real` | run every test stand-in's real counterpart: your RPC, Multicall3, Aave, venues, a real quote, websocket feed, deployed contract, contract v2 against the real protocols (one eth_call), KMS, release service, phone notification, webhook, AI agent. Sends nothing on chain |
| `chronos docs` | regenerate the reference sections of the docs from the code (--check: report stale docs) |
| `chronos verify` | check the code against its integrity seal |
| `chronos unlock` | make the code editable (for a deliberate change) |
| `chronos lock` | make the code read-only again (chronos seal also does this) |
| `chronos seal` | record the current code as trusted and lock it again |
| `chronos help` | this text |

Sends happen only in three places: the engine in LIVE mode (signed by your Google Cloud HSM key), and chronos deploy and chronos payout (signed by your owner key, after you type YES).
<!-- /GENERATED:commands -->

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | finished |
| 1 | stopped safely (cancelled, nothing to do, or a check failed); nothing was sent unless the output says so |
| 2 | needs setup first (no `.env`, missing settings, integrity check failed) |
| 75 | engine asked its service manager to restart it (watchdog) |

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · **Commands** · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
