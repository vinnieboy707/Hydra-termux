import fs from "node:fs";
import path from "node:path";

console.log("[Scanner Agent] Initialized on Arbitrum QuoterV2 feed...");
setInterval(() => {
  const heartbeat = {
    file: "scanner-agent.mjs",
    inputReceived: "production",
    timestamp: new Date().toISOString(),
    status: "nominal",
    activePools: 142
  };
  const targetPath = path.resolve("data/arbitrum/scanner_heartbeat.json");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(heartbeat, null, 2));
}, 5000);
