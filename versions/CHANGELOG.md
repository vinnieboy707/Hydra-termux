# Chronos consolidation — changelog

Chronological record of every version in `versions/`, what each contains, and **exactly what
differs between them**. The complete file-by-file lists (Added / Removed / Changed / Identical for
each step) are in **[DIFF_MATRIX.md](DIFF_MATRIX.md)**; this file is the readable
summary. For a live diff: `git diff v1.0.0 v2.0.0`, `git diff v2.0.0 v3.0.0`, `git diff v3.0.0 v4.0.0`.

## Headline

The three source copies **overlap almost not at all**. These are not incremental edits of one tree —
they are three divergent snapshots the code was spread across:

| Step | Added | Removed | Changed | Identical |
|------|------:|--------:|--------:|----------:|
| v1 → v2 | 435 | 302 | 3 | 0 |
| v2 → v3 | 96 | 436 | 2 | 0 |
| v3 → v4 | 12 | 0 | 0 | 98 |
| v4 → v5 | 259 | 110 | 0 | 0 |

Between v1 and v2 only **3** paths exist in both (`.gitignore`, `README.md`, `package.json`) — and
all three changed. Between v2 and v3 only **2** paths exist in both (`contracts/ChronosFlashArb.sol`,
`scripts/audit_ledger.ts`) — and both changed. So the lineage is best read as: a Termux pen-test/
full-stack app (v1) → a broad Chronos "vault" workspace (v2) → a focused arbitrage swarm (v3) →
the consolidated go-forward (v4).

---

## v1.0.0 — 2026-02-24 — Hydra-Termux (the base)
`versions/v1.0.0-2026-02-24-hydra-termux/` · 305 files · source: GitHub `vinnieboy707/Hydra-termux` @ `main`

The original repo everything traces back to. A Termux-oriented brute-force / penetration-testing
suite plus a separate full-stack web app.

Top-level: `fullstack-app/` (130 — React frontend + Node backend), `scripts/` (59), `docs/` (32),
`.github/` (8), `Library/` (7), `config/` (4), Docker/compose/nginx/monitoring, `hydra.sh`,
`install.sh`. Full git history (306 commits) is preserved — this version is the branch point.

Excluded: nothing added or removed; this is the repo as-is. (It contains only env-var references
and placeholder templates, no live secrets.)

## v2.0.0 — 2026-10-23 — ChronosMasterVault / "repo" (the bridge)
`versions/v2.0.0-2026-10-23-vault/` · 438 files · source: Google Drive `ChronosMasterVault/repo`

The broadest Chronos snapshot. This is where the project became "Chronos": a large multi-part
workspace.

Top-level: `src/` (128), root scripts (112), `scripts/` (33), `mansion/` (32), `fullstack-app/`
(31), `api-dashboard-swarm/` (16), `data/` (15), `arbitrage_engine/` (15), `dig-ai-system/` +
`dig_ai_production/` (11), `exploit_core/` (2), `alchemy_project/`, `apps/`, `contracts/` (1),
and ~20 agent `*-skill/` folders (accessibility-auditor, alert-dispatcher, auth-guard, threat-
detector, rate-limiter, redis-healer, etc.). Governance/policy docs and many `verify_*` / `test_*`
root scripts.

**Difference from v1:** effectively a complete replacement. 435 files added, 302 removed. The only
shared paths are `.gitignore`, `README.md`, `package.json`, and all three were rewritten. None of
v1's `fullstack-app/` or Termux tooling carried over at the path level.

Excluded from this version (retrieved but deliberately left out):
- Secrets (6): `.env`, `.env.production`, `.env.example`, `arbitrage_engine/.env.example`,
  `scripts/validate_secrets.mjs`, `scripts/configure-secrets.mjs`
- Databases (8): `vault_store.db(+ -shm/-wal)`, `chronos_production.db`, `data/chronos_production.db`,
  `arbitrage_engine/vault_store.db`, `arbitrage_engine/arbitrage_pipeline.db`,
  `arbitrage_engine/data/arbitrage.db`
- Large/noise: `data/telemetry_stream.jsonl` (2.8 MB), `unresolved-audit.log` (549 KB)
- Vendored/generated trees pruned entirely (~2,168 files): `google-cloud-sdk/`, `__pycache__/`
  (68 instances), `dist/`
- 24 genuine zero-byte files preserved as empty (e.g. `KILL_SWITCH`, empty `__init__.py`).

## v3.0.0 — 2026-11-17 — Chronos arbitrage swarm
`versions/v3.0.0-2026-11-17-arb-swarm/` · 98 files · source: Google Drive `chronos_workspace_backup_…json.gz`

A focused DeFi arbitrage/execution swarm — the newest reachable complete snapshot.

Top-level: `scripts/` (87 — mostly `.cjs` swarm/deploy/execution engines: `chronos_master_swarm`,
`arb-swarm-worker`, `deploy_*`, `gas_monitor`, `policy_guard`, `safe_executor`, `profit_dashboard`,
monitoring/health), `contracts/` (7 Solidity flash-arb contracts), `artifacts/` (4 compiled).

**Difference from v2:** 96 added, 436 removed, 2 changed. The broad v2 workspace (src/mansion/
dig-ai/skills/arbitrage_engine/fullstack-app) is gone; what remains and grows is the swarm's
scripts and contracts. The two shared files both changed between Oct 23 and Nov 17:
- `contracts/ChronosFlashArb.sol` — rewritten, 225 → 156 lines.
- `scripts/audit_ledger.ts` — 53 → 55 lines, ~10 lines changed.
86 of the 87 scripts here are new relative to v2; v3 has 7 contracts vs v2's 1.

Excluded: `.env`, `data/vault_store.db*`, `data/vault_store.sqlite*`, `data/real_estate_master.db`,
`data/wallet_ledger.json`, and 29 runtime `logs/` + `.jsonl` files.

Not retrieved: the 194 MB `chronos_workspace_backup_1794945173.tar.gz` (same day) — the Drive
connector can't hand over a file that large, so v3 was rebuilt from the same-day JSON content
backup instead. The phone/Termux working copy is also out of reach, so a copy newer than Nov 17,
if one exists, is not represented here.

## v4.0.0 — 2026-11-24 — Consolidated go-forward
`versions/v4.0.0-consolidated/` · 98 + 11 files · source: v3.0.0 + imports from the other projects

v3 unchanged (all 98 files byte-identical) plus a new `integrations/` folder holding 11 reusable
modules pulled from Chenzo's other repos, each with a provenance header, reading all secrets from
env vars. See `versions/v4.0.0-consolidated/integrations/README.md` for the manifest and rationale.

**Difference from v3:** 12 files added (the 11 modules + an `integrations/README.md`), nothing
removed, nothing changed.

Imported:
- From `Assets-in-control-` (`server/`): `onChainVerification.js`, `blockchain.js`, `priceService.js`,
  `validationChain.js`, `errorRecovery.js`, `recoveryMiddleware.js`, `rateLimiter.js`
- From `daugherty-INC` (`backend/`): `asyncHandler.js`, `validate.js`
- From `Vip-Registatiom` (`backend/`): `logger.ts`, `errorHandler.ts`

Not imported: `public-record` (a Python public-records app — belongs to the real-estate side, not a
DeFi swarm); `Hernandez_Advertisment` (README only); the other projects' frontends/routes/models
(app-specific scaffolding, not reusable infrastructure). The imported modules are staged, not yet
wired into the swarm scripts — that is a deliberate follow-up so you can review them first.

## v5.0.0 — 2026-11-26 — chronos-console 2.9.19 (newest engine)
**the repository root** (the live app) · 259 files · source: Google Drive `chronos-console-2.9.19.tgz` (uploaded 2026-11-26)

> **Layout note:** v5 was promoted to the repo root as the working codebase (it is the engine the
> phones and laptop run 24/7). v1–v4 remain archived under `versions/`. Everything below describes
> the same files; only their location changed (from `versions/v5…/` to the root).

The newest Chronos, and the one the live engine now runs. The loose Nov-17 arbitrage swarm (v3) has been
re-engineered into a single structured package, `chronos-console` v2.9.19: a self-running flash-loan arbitrage
system for Arbitrum One with a shadow-test gate before any live trade, a terminal dashboard (TUI), an autopilot
installer, device pairing, phone alerts, and a one-script Google Cloud deployment.

Top-level: `lib/` (97 — engine, chain, scanner, optimizer, policies, payout, measurement, `kms.cjs`, `walletbridge.cjs`),
`test/` (88 — a real test suite with mocks **and** on-chain/devchain fixtures), `tui/` (17 — the dashboard),
`docs/` (17 — generated-and-checked reference: ARCHITECTURE, CONFIGURATION, COMMANDS, SECURITY, TESTING, API…),
`server/` (13 — Supabase edge functions: alerts, decisions, ingest, insights, release, vault + `schema.sql`),
`contract/` + `contracts/v2/` (Solidity + compiled ABIs), `cloud/` and `sync/` (GCP + laptop/phone setup), and the
`bin/chronos.cjs` CLI. `package.json` pins `ethers 6.17.0`, `ganache 7.9.2`, `solc 0.8.24`.

**Security posture (notable upgrade):** there is **no private key anywhere in this code**. Trades are signed by an
HSM-protected secp256k1 key in Google Cloud KMS that cannot be exported (`lib/kms.cjs`); the owner key for `chronos
deploy` is read from the environment for that run only and never written. The secret scan found **no hardcoded live
credentials** — the only key-shaped strings are the public secp256k1 group order, compiled contract bytecode in ABI
JSON, on-chain transaction hashes in fixtures, and ganache's documented public test keys in `test/`. One synthetic
`sk_live_…` string used as **input** to a redaction test (`test/console.test.cjs`, which asserts that `redact()`
scrubs keys from the terminal) was replaced with an obviously-fake placeholder so it no longer trips secret scanners;
the test still passes. This directly honours the preference that every mock in tests has a real counterpart: the
suite exercises both mocks (`test/mocks/`, `test/fixtures/`) and a live devchain.

**Difference from v4:** 259 added, 110 removed, 0 changed, 0 identical — it shares **no path** with v4 and only two
basenames with v3 (`ChronosFlashArb.sol`, `ChronosFlashArb.json`). So, as with every earlier step, this is a
reorganization rather than an incremental edit: the flat `scripts/*.cjs` swarm became a packaged, tested `lib/`+`tui/`
console, and v4's staged `integrations/` do not carry into it.

Excluded (retrieved but deliberately left out):
- `vendor/deps.tgz` (681 KB bundled dependency archive — a vendored binary blob, rebuilt from `vendor/build-deps.sh`).
- Kept: `.env.scanner.example` (a config **template** — every value commented out, no secrets), and `vendor/build-deps.sh`.

Not retrieved newer than this: none found. This 1.44 MB `.tgz` is the copy that was "newer than Nov 17" and out of
reach when v3 was built; it is now the newest reachable Chronos. (The 194 MB Nov-17 tarball remains too large for the
Drive connector, but its source is already represented by v3 via the companion JSON backup.)

---

## Security note — secrets found hardcoded in source (redacted, not committed)

While consolidating, live credentials were found **hardcoded directly in source files** (not in
`.env`). They were replaced in place with `REDACTED_SECRET_MOVED_TO_ENV` / an env-var reference, so
no secret is committed or pushed. The real values are **not** reproduced anywhere here. These keys
should be treated as exposed and **rotated**:

- `versions/v2.0.0-2026-10-23-vault/check_real_onchain_balance.js:11` — a hardcoded wallet private key.
- `versions/v3.0.0-2026-11-17-arb-swarm/scripts/master_audit_and_integrate.js:50` — an OpenRouter API key
  (same file carried into `versions/v4.0.0-consolidated/`).

Each version's code should read these from environment variables instead (the separate env/key
consolidation work covers that). Flagging so they can be rotated.
