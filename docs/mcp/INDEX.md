# MCP & API Registry Reference — Index

Redacted, repo-ready reference docs for the Chronos MCP servers and API registry. All credentials replaced with `REDACTED`.

| File | Documents |
| :--- | :--- |
| `API_REGISTRY.md` | Master registry of Web3 RPC endpoints, FOIA/property/public-records APIs, internal microservice gateways, settlement routing, and Etherscan API v2 endpoints. Embedded RPC credentials (Alchemy key, QuickNode token) and the Etherscan API key are redacted. |
| `mcp.json` | Gemini MCP server definitions: the `fable-5-1-max-harness` and `opus-5-5-max-vault` servers, their launch commands and environment config (model IDs, effort level, batching, WAL sync). No secrets present. |
| `settings.json` | Swarm orchestrator settings: model class/identifier/context-window/feature definitions, execution parameters, and security guardrails. No secrets present. |
| `policy.json` | Arbitrage/settlement risk policy: allowed EVM chain IDs, Solana genesis hash (public), profit/gas/loan/slippage thresholds, and cooldowns. No secrets present. |
| `error_prevention_registry.json` | Anti-regression registry: registered failures (empty) and preventative rules. No secrets present. |
| `mcp-server.md` | Summary of `src/ai/mcp-server.js`, the minimal Chronos HTTP MCP server exposing the `get_vault_status` tool. Source contained no credentials, so it is documented rather than copied. |
