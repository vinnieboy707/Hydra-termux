# Server API and database

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · **Server API** · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

Everything the engine and the portal talk to in your Supabase project. The source ships with every release:
`server/functions/` (the three routes) and `server/schema.sql` (the database). The tables below are generated from that
source by `chronos docs`, so they cannot drift from it.

## Who may call what

There is no shared secret anywhere. A device makes its own Ed25519 key (`~/.chronos/device.key`, never sent), asks to
join with `chronos device`, and you approve its pairing code in the portal. Every request after that is signed:
headers `x-device-pub`, `x-chronos-ts` (milliseconds, must be within 60 s of the server clock) and `x-chronos-sig`
(Ed25519 over `ts.body`). A device you have not approved, or have revoked, is refused.

The portal reads the database directly as you, signed in; row-level security lets only the owner (the account
signed in with your email, marked owner by `grant_owner_role()`) read anything, and lets the owner change only the
columns the portal changes.

## Routes

<!-- GENERATED:routes -->
| Route | Method | Who may call | Operations |
| --- | --- | --- | --- |
| `/functions/v1/release` | GET | anyone (no secrets) | `?f=go.sh`, `?f=device.cjs`: the installer and device helper of the newest release |
| `/functions/v1/release` | POST | `enroll`: anyone proving its key; others: an enrolled device, signed | `enroll`, `status`, `latest`, `executor_offer`, `executors`, `download`, `publish` |
| `/functions/v1/ingest` | POST | an approved device, signed | `{table, rows}` for the tables below; `pool_moves` rows are also broadcast on Realtime topic `chronos-pool-moves` (the price-move relay) |
| `/functions/v1/decisions` | POST | an approved device, signed | `list`, `ack` |
| `/functions/v1/insights` | POST | an approved device, signed | `{}` → the 24 h path to profit across your engines (closest routes, what stops them), the road to mainnet step by step, engines the watchdog reports silent, and `chain`: the policies, competitors, venues and chain signals (indicators with verdicts) from every engine's studied trades |
| `/functions/v1/alerts` | POST | an approved device, signed | one alert as JSON (the default for `CHRONOS_ALERT_WEBHOOK_URL` and `CHRONOS_WEBHOOK_URL`); escalations, errors, money made or lost and the verify-real test are kept in `reports` (kind `alert`), the rest answered `{kept:false}` |
<!-- /GENERATED:routes -->

Answers are JSON. Errors: `400` malformed request, `401` missing, stale or bad signature, `403` device not approved
(the message carries its pairing code), `404` unknown release, `405` wrong method, `409` release not newer than
what is published, `413` too large, `422` the database refused the rows (the engine sets those rows aside in
`data/sync-rejected.jsonl` and carries on), `429` too many pending devices.

### What the ingest route accepts

<!-- GENERATED:ingest -->
| Table | Columns accepted (anything else is dropped) | Write |
| --- | --- | --- |
| `opportunities` | `scanned_at`, `block`, `route_key`, `asset`, `amount_raw`, `legs`, `gross_usd`, `gas_usd`, `premium_usd`, `net_usd` | upsert on block,route_key |
| `shadow_runs` | `ts`, `block`, `route_key`, `stage`, `win`, `net_usd`, `profit_usd`, `gas_usd`, `failed`, `error` | upsert on block,route_key |
| `executions` | `tx_hash`, `sent_at`, `route_key`, `status`, `receipt_block`, `gas_used`, `gas_usd`, `profit_usd`, `net_usd`, `tax_reserve_usd`, `updated_at` | upsert on tx_hash |
| `mode_events` | `ts`, `mode`, `reason` | insert |
| `balances_verified` | `label`, `token`, `address`, `amount`, `verified`, `block`, `ts` | upsert on label,token |
| `heartbeats` | `service`, `ts`, `mode`, `version`, `detail` | upsert on service |
| `agent_events` | `ts`, `agent`, `severity`, `source`, `message`, `action`, `outcome`, `detail` | insert |
| `approvals` | `ref`, `agent`, `kind`, `title`, `detail` | upsert on ref |
| `payouts` | `ts`, `tx_hash`, `kind`, `token`, `amount_raw`, `amount_usd`, `to_address`, `block` | upsert on tx_hash |
| `reports` | `day`, `kind`, `title`, `body`, `critical` | insert |
| `route_stats` | `ts`, `block`, `route_key`, `path`, `legs`, `lender`, `size_usd`, `gross_usd`, `premium_usd`, `gas_usd`, `net_usd`, `floor_usd`, `killer`, `approved` | upsert on device,block,route_key |
| `chain_trades` | `tx_hash`, `block`, `contract`, `sender`, `lender`, `assets`, `success`, `legs`, `venues`, `gas_used`, `gas_price_gwei`, `gas_usd`, `kept_usd`, `net_usd`, `priced` | upsert on tx_hash |
| `pool_moves` | `block`, `pools` | insert |
<!-- /GENERATED:ingest -->

The words in the checked columns (outcomes, severities, modes, stages, statuses, kinds) are listed in
`lib/vocab.cjs`; the engine sends only those.

## Database

<!-- GENERATED:schema -->
| Table | Columns |
| --- | --- |
| `agent_events` | `id`, `ts`, `agent`, `severity`, `source`, `message`, `action`, `outcome`, `detail` |
| `approvals` | `id`, `created_at`, `agent`, `kind`, `title`, `detail`, `status`, `decided_at`, `expires_at`, `ref`, `applied_at`, `applied_result` |
| `balances_verified` | `label`, `token`, `address`, `amount`, `verified`, `block`, `ts` |
| `devices` | `id`, `name`, `pubkey`, `code`, `status`, `can_publish`, `created_at`, `decided_at`, `last_seen`, `version`, `executor_address`, `kms_key`, `executor_at` |
| `executions` | `tx_hash`, `sent_at`, `route_key`, `status`, `receipt_block`, `gas_used`, `gas_usd`, `profit_usd`, `net_usd`, `tax_reserve_usd`, `updated_at` |
| `heartbeats` | `service`, `ts`, `mode`, `version`, `detail` |
| `mode_events` | `id`, `ts`, `mode`, `reason` |
| `opportunities` | `id`, `scanned_at`, `block`, `route_key`, `asset`, `amount_raw`, `legs`, `gross_usd`, `gas_usd`, `premium_usd`, `net_usd` |
| `payouts` | `tx_hash`, `ts`, `kind`, `token`, `amount_raw`, `amount_usd`, `to_address`, `block` |
| `releases` | `version`, `sha256`, `size_bytes`, `path`, `notes`, `published_by`, `created_at` |
| `reports` | `id`, `ts`, `day`, `kind`, `title`, `body`, `critical` |
| `revenue_entries` | `id`, `received_on`, `business`, `description`, `amount`, `currency`, `method`, `evidence`, `tax_reserved`, `created_at` |
| `shadow_runs` | `id`, `ts`, `block`, `route_key`, `stage`, `win`, `net_usd`, `profit_usd`, `gas_usd`, `failed`, `error` |
| `route_stats` | `id`, `ts`, `block`, `device`, `route_key`, `path`, `legs`, `lender`, `size_usd`, `gross_usd`, `premium_usd`, `gas_usd`, `net_usd`, `floor_usd`, `killer`, `approved` |
| `watchdog_state` | `service`, `down`, `since` |
| `email_log` | `id`, `ts`, `subject`, `request_id`, `sent`, `why` |
| `chain_trades` | `tx_hash`, `block`, `seen_at`, `device`, `contract`, `sender`, `lender`, `assets`, `success`, `legs`, `venues`, `gas_used`, `gas_price_gwei`, `gas_usd`, `kept_usd`, `net_usd`, `priced` |
| `pool_moves` | `id`, `ts`, `block`, `pools`, `device` |
<!-- /GENERATED:schema -->

To recreate the database in a new, empty Supabase project, run `server/schema.sql` in its SQL editor, then deploy the
three functions from `server/functions/` (Supabase dashboard → Edge Functions, or `supabase functions deploy`), with
JWT verification off (they check device signatures themselves).

## Checking the live project

`portal/real_check.sql` (in the portal bundle) checks the live database is what the code needs: every table and column
exists, row-level security is on, signed-out visitors get nothing, no one may TRUNCATE, every write is covered by an
owner-only policy, and every word the engine sends is accepted. No rows back means it passes. `chronos verify-real`
checks the same from your phone: a signed-out visitor reads nothing.
