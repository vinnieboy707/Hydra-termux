# Security

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · **Security** · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

## Principles

1. **Fail closed.** A missing price, failed node, wrong chain, stale quote or unreadable contract means no send.
2. **Nothing invented.** Every number acted on comes from the chain or your settings. Simulations only choose between
   routes and prove your contract's exact call before a send.
3. **Gated autonomy.** Routine work runs on its own. Keys, limits, contract code and moving funds need your approval.
4. **Least privilege.** Each part holds only what it needs: the engine holds a key name, not a key; devices hold only
   their own identity; the portal reads with your sign-in.

## Keys and custody

| Key | Held by | Used for | Never |
| --- | --- | --- | --- |
| Executor signing key | Google Cloud KMS (HSM, secp256k1) | signing LIVE sends | exported, written to disk, or seen by Chronos |
| Executor key on your phone (2.9.11, instead of KMS) | encrypted keystore `data/keystore/executor.json` (600); in memory only inside the key agent after `chronos executor unlock` | signing trades: chain 42161, to your contract, `execute()` only, no ETH, ≤ 0.05 ETH worst-case gas, ≤ 30/min | in plaintext, in `.env`, in chat, in the settings bundle, in the engine's memory, or used for anything but a trade; never your owner key |
| Owner key | your wallet; optionally your `.env` | deploy, contract setup, payout (after YES) | written by Chronos, logged, or sent anywhere |
| RPC and websocket urls | `.env` (mode 600) | reading the chain | logged, synced, packaged or shown |
| Device key (Ed25519) | `~/.chronos/device.key` (mode 600) | signing portal requests | shared between devices |
| Supabase publishable key | portal page | reading tables with your sign-in | sufficient on its own: every table is owner-only |

The phone executor is weaker than the HSM: while unlocked, the key is in the key agent's memory on a phone that runs
24/7. What limits the damage if the phone were compromised: the agent signs only trades to your contract (the contract
itself then enforces operator-only, allowlisted venues and the on-chain profit minimum), an operator can never
withdraw (only the owner can), and the most it can spend is the ETH you keep on the executor for gas. Keep that gas
small, and move to the Cloud KMS executor (`cloud/gcp-setup.sh`) when you can; then `chronos executor lock`.

## Devices and releases

- Each device creates its own Ed25519 key, shows a pairing code, and waits until you approve it in the portal.
- Requests are signed over `timestamp.body`; the server accepts a signature only within 60 seconds.
- Only devices you allowed to publish can publish a release. Approved devices download releases and verify the
  sha256 before installing. Revoking a device stops its access immediately.

## Data leaving a device

Only allowlisted tables and columns: heartbeats (status and scan figures), opportunities that passed every guardrail,
shadow-test results, executions from receipts, balances verified by a second source, and agent events. Never: urls,
keys, `.env` contents, call data or route internals. The portal's database uses row-level security so only the owner
account can read or write.

## Money

- The contract repays the loan and fee and enforces `minProfit` in the same transaction, or reverts. A revert costs
  only gas, capped per day by policy.
- Every live send is preceded by a fresh simulation of the exact call at the current block.
- Payouts move only verified holdings (confirmed by a second node or Blockscout), reserve 30% of net profit for taxes
  first (rounded up), and resume safely if interrupted.

## The VP's authority

Until the first verified profit the VP may change execution limits and a listed set of trading settings, each inside a
safe range ([Company](COMPANY.md#the-vp)); after it, limits only. It can never move funds except to your own wallets,
touch keys, exceed the gas and loss caps, switch off the profit guard, or run unsealed code.

## Automatic actions and the AI agent

- The engine's automatic resolutions are a fixed allowlist (see [Operations → Automatic
  resolution](OPERATIONS.md#automatic-resolution)). None touches keys, limits, deploys, code or funds.
- The AI agent can only choose an action from that allowlist that has not been tried for the incident; any other
  answer is refused and the incident is escalated to you. What it receives is redacted.
- `chronos assist --fix` runs only its listed terminal steps (wake lock, engine service start or install, device key)
  and verifies each.
- The alert webhook accepts only https urls; payloads are redacted and can be signed with your secret.

## Code integrity

The installed code is sealed with SHA-256 hashes of every shipped file. The engine refuses to run, and deploy refuses
to send, if the code differs from its seal. Files that are not part of Chronos are reported. Packaging refuses stray
files (screenshots, logs, archives, env files).

## Known limits

- The contract (`ChronosFlashArb`) is your own and **has not been externally audited**.
- Real Arbitrum mainnet behaviour, Cloud KMS signing and the Firebase deployment are verified on your device and in
  your cloud project, not in the build environment (see [Testing](TESTING.md#what-no-test-here-can-reach)).
- Android may stop Termux when the screen is off; use `termux-wake-lock` or the Cloud engine.

## Reporting and rotation

Rotate any secret that appears outside your `.env`: in a chat, a screenshot, a shared document or a log. Restrict link
sharing on any file that holds keys.

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · **Security** · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
