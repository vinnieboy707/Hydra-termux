import fs from "node:fs";
import path from "node:path";

console.log("[Telemetry Agent] Emitting host metrics...");
setInterval(() => {
  const status = {
    uptime: process.uptime(),
    memoryRss: process.memoryUsage().rss,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.resolve("data/arbitrum/telemetry_status.json"), JSON.stringify(status, null, 2));
}, 10000);
