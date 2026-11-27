# Chronos — Compliance, MCP & Honeycomb reference

This index covers the governance, MCP/API, and Honeycomb operating-model material that was
gathered from Chenzo's Docs and Drive and ingested into the repository so it lives alongside the
code instead of scattered across Drive. It sits beside chronos-console's own generated reference
docs (`ARCHITECTURE.md`, `CONFIGURATION.md`, `SECURITY.md`, `TESTING.md`, `API.md`, …).

**Every secret value in this material was stripped before ingestion** — API keys, private keys,
tokens and the like appear only as `REDACTED` or an env-var reference. Nothing here is a live
credential. What each redaction was is noted in the section indexes.

## Sections

### `governance/` — compliance & governance policies
The rules the system is meant to run under: the master governance protocol, the compliance
governance policy, the mainnet-validation policy, money policies, anti-contradiction and
error-prevention / anti-regression policies, and a compliance audit report. See
[`governance/INDEX.md`](governance/INDEX.md). These are prose policy docs — no secrets were present.

### `mcp/` — MCP server & API registry
The Model-Context-Protocol server definitions and the external-API registry the engine talks to:
`mcp.json` (MCP server defs), `settings.json` (orchestrator settings), `policy.json` (risk policy),
the `API_REGISTRY.md` of providers/endpoints, the error-prevention registry, and a summary of the
MCP server source. See [`mcp/INDEX.md`](mcp/INDEX.md). Redactions: the Alchemy and QuickNode RPC
credentials embedded in provider URLs were replaced with `REDACTED` (the keys belong in `.env`).

### `honeycomb/` — the Honeycomb operating model ("mindstate")
How the helper-cell swarm operates: the merged master mind-state/runbook and a distilled
operating-model page (each cell has one goal and one report; cells run in parallel; a cell writes
only its own files; results are reviewed before they are combined). See
[`honeycomb/INDEX.md`](honeycomb/INDEX.md).

## How this maps to the live engine
The repository root is the live app, `chronos-console` 2.9.19 (KMS-signed executor, no private key
in code). The policies in `governance/` and the risk settings in `mcp/policy.json` are the
intended guardrails; `honeycomb/` is the operating model for the parallel helper cells that keep
the engine improving. The earlier scattered copies of Chronos are archived under `versions/`.
