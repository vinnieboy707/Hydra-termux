import db from "../db/json-ledger.mjs";
import router from "../mesh/agent-router.mjs";

console.clear();
console.log("========================================================");
console.log("CHRONOS OS // LIVE SOVEREIGN COMMAND MATRIX & AGENT I/O");
console.log("========================================================");

router.displayMatrix();

try {
  const summary = db.prepare("SELECT SUM(net_profit_usd) as total FROM verified_revenue_ledger").get();
  const count = db.prepare("SELECT COUNT(*) as total FROM verified_revenue_ledger").get();
  const total = summary?.total || 0;

  console.log("\n[REVENUE & POLICY T1 RECONCILIATION]");
  console.log(`Total Cleared Transactions : ${count?.total || 0}`);
  console.log(`Gross Cleared Revenue      : $${total.toFixed(2)}`);
  console.log(`Statutory Tax Reserve (30%): $${(total * 0.30).toFixed(2)}`);
  console.log(`Net Withdrawable Treasury  : $${(total * 0.70).toFixed(2)}`);
  console.log("========================================================");
} catch (err) {
  console.error("[!] Dashboard Error:", err.message);
}
