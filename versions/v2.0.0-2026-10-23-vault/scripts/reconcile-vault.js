"use strict";

const fs = require("fs");
const path = require("path");

const settlementsPath = path.join(process.cwd(), "reports", "vault_settlements.json");

if (!fs.existsSync(settlementsPath)) {
  console.log("No settlements on file. System actively monitoring live orderbooks.");
  process.exit(0);
}

let records = [];
try {
  records = JSON.parse(fs.readFileSync(settlementsPath, "utf8"));
} catch (e) {
  console.error("Failed to parse settlement ledger:", e.message);
  process.exit(1);
}

let grossCleared = 0;
let taxReserve = 0;
let netWithdrawable = 0;

console.log("\n========================================================================");
console.log("⚡ CHRONOS OS // VAULT & STATUTORY TAX RECONCILIATION REPORT");
console.log("========================================================================");
console.log(`Audited Settlements Count : ${records.length}`);

for (const [idx, item] of records.entries()) {
  grossCleared += (item.netProfitUSD || 0);
  taxReserve += (item.taxReserveUSD || 0);
  netWithdrawable += (item.netWithdrawableUSD || 0);
  console.log(`[${idx + 1}] ${item.timestamp || "N/A"} | ${item.network || "UNKNOWN"} | Net: +$${(item.netProfitUSD || 0).toFixed(4)} | Ref: ${item.txRef || "N/A"}`);
}

const targetProgressPct = ((grossCleared / 1000.00) * 100).toFixed(2);

console.log("------------------------------------------------------------------------");
console.log(`Total Gross Settled       : $${grossCleared.toFixed(2)} USD`);
console.log(`Policy T1 Tax Reserve     : $${taxReserve.toFixed(2)} USD (30.00%)`);
console.log(`Net Withdrawable Capital  : $${netWithdrawable.toFixed(2)} USD (70.00%)`);
console.log(`Milestone Progress        : $${grossCleared.toFixed(2)} / $1,000.00 USD (${targetProgressPct}%)`);
console.log("========================================================================\n");
