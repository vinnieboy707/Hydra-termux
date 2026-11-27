"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.MCP_PORT || 8787;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "POST" && req.url === "/mcp/tools/call") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { tool, arguments: args } = JSON.parse(body);
        
        if (tool === "get_vault_status") {
          const settlementsPath = path.join(process.cwd(), "reports", "vault_settlements.json");
          const records = fs.existsSync(settlementsPath) ? JSON.parse(fs.readFileSync(settlementsPath, "utf8")) : [];
          const gross = records.reduce((s, x) => s + (x.netProfitUSD || 0), 0);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, totalSettlements: records.length, grossProfitUSD: gross }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: "TOOL_NOT_FOUND" }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({ name: "Chronos MCP Server", status: "ONLINE", version: "8.0" }));
  }
});

server.listen(PORT, () => {
  console.log(`🔌 Chronos MCP Server listening on port ${PORT}`);
});
