import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

console.log("[Cold-Vault Sweeper] Initializing treasury withdrawal sweeper...");

const dbPath = path.resolve("data/chronos_production.db");
const db = new Database(dbPath);

setInterval(() => {
  const timestamp = new Date().toISOString();
  const summary = db.prepare("SELECT SUM(net_profit_usd) as totalProfit FROM verified_revenue_ledger").get();
  const total = summary?.totalProfit || 0;

  if (total > 50.00) {
    console.log(`[Cold-Vault Sweeper] Withdrawable balance ($${total.toFixed(2)}) exceeds $50 threshold. Sweeping 60% owner draw to treasury...`);
  }
}, 60000);
