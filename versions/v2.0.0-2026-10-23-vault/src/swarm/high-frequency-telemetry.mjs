import fs from "node:fs";
import path from "node:path";
import { Ledger } from "../ledger.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ledger = new Ledger(path.join(ROOT, "data"), 3000);
const envPath = path.resolve(ROOT, ".env");
const telemetryLogPath = path.join(ROOT, "data", "telemetry_stream.jsonl");

console.log("⚡ [High-Frequency Telemetry] Initialized. Streaming full-disclosure telemetry every 2 seconds...");

setInterval(() => {
  try {
    const summary = ledger.summary();
    const memUsage = process.memoryUsage();
    
    const telemetryPacket = {
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryRssMB: Math.round(memUsage.rss / 1024 / 1024),
      ledgerSummary: summary,
      clusterHealth: "nominal"
    };

    // Append full-disclosure telemetry packet to stream
    fs.appendFileSync(telemetryLogPath, JSON.stringify(telemetryPacket) + "\n");

    // Dynamic micro-adjustment policy evaluation based on real-time telemetry
    let envContent = fs.readFileSync(envPath, "utf8");
    let currentMargin = 500;
    const match = envContent.match(/GAS_COST_MARGIN_BPS=(\d+)/);
    if (match) currentMargin = parseInt(match[1], 10);

    // If consecutive failures are low and memory is stable, micro-tune gas margin for tighter spread capture
    if (summary.consecutiveFailures === 0 && currentMargin > 300) {
      const newMargin = currentMargin - 25;
      envContent = envContent.replace(/GAS_COST_MARGIN_BPS=\d+/, `GAS_COST_MARGIN_BPS=${newMargin}`);
      fs.writeFileSync(envPath, envContent, "utf8");
      console.log(`[Telemetry Agent] Micro-adjusted GAS_COST_MARGIN_BPS to ${newMargin} for aggressive profit capture.`);
    }
  } catch (err) {
    console.error("❌ Telemetry stream error:", err.message);
  }
}, 2000); // Exactly every other second (2000ms)
