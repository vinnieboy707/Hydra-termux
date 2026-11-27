// =========================================================================
// APEX v3.0 PHASE C: AUTOMATED COLD-VAULT SWEEPER DAEMON
// =========================================================================
const { execSync } = require("child_process");
const path = require("path");
const dbPath = path.resolve(__dirname, "../data/chronos_production.db");

const COLD_VAULT_ADDRESS = process.env.COLD_VAULT_ADDRESS || "0x000000000000000000000000000000000000dEaD";
const SWEEP_THRESHOLD_USD = 50.00;

function sweepClearedProfits() {
  try {
    const query = "SELECT SUM(net_cleared_usd) FROM verified_revenue_ledger WHERE status=\"CONFIRMED_CLEARED\";";
    const rawSum = execSync('sqlite3 "' + dbPath + '" "' + query + '" 2>/dev/null').toString().trim();
    const totalYield = parseFloat(rawSum) || 0;

    if (totalYield >= SWEEP_THRESHOLD_USD) {
      console.log("[COLD SWEEPER] Profit threshold exceeded: $" + totalYield.toFixed(2) + " >= $" + SWEEP_THRESHOLD_USD.toFixed(2) + ". Initiating transfer to " + COLD_VAULT_ADDRESS + "...");
      const updateQuery = "UPDATE verified_revenue_ledger SET status=\"SWEEP_PENDING\" WHERE status=\"CONFIRMED_CLEARED\";";
      execSync('sqlite3 "' + dbPath + '" "' + updateQuery + '" 2>/dev/null');
      console.log("[COLD SWEEPER] Revenue allocation updated to SWEEP_PENDING.");
    }
  } catch (_) {}
}

setInterval(sweepClearedProfits, 60000);
sweepClearedProfits();
console.log("🛡️ [Cold Vault Sweeper] Daemon initialized (Hurdle: $" + SWEEP_THRESHOLD_USD.toFixed(2) + " USD).");
