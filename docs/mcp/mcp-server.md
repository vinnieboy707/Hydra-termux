# Chronos MCP Server (`src/ai/mcp-server.js`)

Minimal Node.js HTTP MCP server for the Chronos vault. Contains no hardcoded
credentials — summarized here rather than copied verbatim.

## Runtime

- **Transport:** plain Node `http` server (no external deps).
- **Port:** `process.env.MCP_PORT`, default `8787`.
- **Response content type:** `application/json`.
- **Identity:** name `Chronos MCP Server`, status `ONLINE`, version `8.0`.

## Routes

| Method | Path | Behavior |
| :--- | :--- | :--- |
| `POST` | `/mcp/tools/call` | Parses `{ tool, arguments }` from the request body and dispatches to a tool handler. |
| any | (other) | Returns the server identity/status JSON. |

## Tools

### `get_vault_status`

Reads settlement records from `reports/vault_settlements.json` (relative to
`process.cwd()`), returns `{ success, totalSettlements, grossProfitUSD }` where
`grossProfitUSD` is the sum of each record's `netProfitUSD`. Returns an empty
result set if the settlements file does not exist.

Any other `tool` value returns HTTP 404 with `{ success: false, error: "TOOL_NOT_FOUND" }`.
Malformed JSON bodies return HTTP 400 with the parse error message.

## Notes

- No API keys, tokens, private keys, or connection strings are present in the source.
- Settlement data is read from the local filesystem, not an authenticated remote endpoint.
