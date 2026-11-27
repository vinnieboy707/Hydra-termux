import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

console.log("========================================================");
console.log("CHRONOS OS // REVENUE & ARBITRAGE PIPELINE DIAGNOSTIC");
console.log("========================================================");

const isLive = process.env.CHRONOS_LIVE === "1";
console.log(`[+] CHRONOS_LIVE Mode: ${isLive ? "LIVE SOVEREIGN MAINNET (1)" : "SIMULATION/DRY-RUN (0)"}`);

if (!isLive) {
  console.log("\n[!] ROOT CAUSE IDENTIFIED: System is running in SIMULATION/DRY-RUN mode.");
  console.log("    The scanner and risk agents are evaluating live spreads from QuoterV2,");
  console.log("    but transactions are not dispatching or clearing on-chain because");
  console.log("    CHRONOS_LIVE is not set to 1, or live RPC execution is bypassed.");
}

const dbPath = path.resolve("data/chronos_production.db");
if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath, { readonly: true });
  const ledger = db.prepare("SELECT * FROM verified_revenue_ledger ORDER BY id DESC LIMIT 5").all();
  console.log(`\n[+] Recent Ledger Entries (${ledger.length}):`);
  console.table(ledger);
  db.close();
} else {
  console.log("\n[!] SQLite revenue ledger database not found.");
}

console.log("\n--------------------------------------------------------");
console.log("Checklist to Unlock Live Revenue Generation:");
console.log("1. Ensure CHRONOS_LIVE=1 is set in your environment variables (.env.production).");
console.log("2. Verify your RPC endpoint (Arbitrum QuoterV2 / Alchemy / Infura) is returning live price feeds without 401/rate-limit errors.");
console.log("3. Ensure the executor wallet holds sufficient native gas tokens or that the ERC-4337 Paymaster URL is actively sponsoring UserOps.");
console.log("4. Verify slippage and gas price thresholds (e.g., 35 bps ceiling) are not overly restrictive for current market volatility.");
