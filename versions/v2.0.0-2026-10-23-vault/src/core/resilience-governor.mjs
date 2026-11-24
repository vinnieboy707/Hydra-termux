import fs from "node:fs";
import path from "node:path";

console.log("[✔] Resilience Governor & Circuit Breaker Initialized.");

export function checkFailClosedTriggers(currentDrawdownUSD) {
  const MAX_DAILY_DRAWDOWN = 50.0; // USD
  if (currentDrawdownUSD >= MAX_DAILY_DRAWDOWN) {
    console.error(`[!] CRITICAL: Drawdown limit breached ($${currentDrawdownUSD}). Triggering FAIL-CLOSED state.`);
    process.env.CHRONOS_LIVE = "0";
    fs.writeFileSync(path.resolve(process.cwd(), ".fail-closed"), new Date().toISOString());
    process.exit(1);
  }
}
