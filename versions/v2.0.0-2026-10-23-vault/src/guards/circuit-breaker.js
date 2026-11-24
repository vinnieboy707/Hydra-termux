"use strict";

const fs = require("fs");
const path = require("path");

const MAX_DAILY_DRAWDOWN_USD = 50.00;
const MAX_SLIPPAGE_BPS = 35; // 0.35%
const MIN_NET_PROFIT_USD = 0.35;

function checkCircuitSafety(candidateTrade) {
  const settlementsPath = path.join(process.cwd(), "reports", "vault_settlements.json");
  let todayDrawdown = 0;

  if (fs.existsSync(settlementsPath)) {
    try {
      const records = JSON.parse(fs.readFileSync(settlementsPath, "utf8"));
      const today = new Date().toISOString().slice(0, 10);
      
      for (const tx of records) {
        if (tx.timestamp && tx.timestamp.startsWith(today)) {
          if (tx.netProfitUSD < 0) {
            todayDrawdown += Math.abs(tx.netProfitUSD);
          }
        }
      }
    } catch (_) {}
  }

  // 1. Drawdown Breach Check
  if (todayDrawdown >= MAX_DAILY_DRAWDOWN_USD) {
    console.error(`🚨 [CIRCUIT_BREAKER_TRIGGERED]: Daily drawdown of $${todayDrawdown.toFixed(2)} reached limit ($${MAX_DAILY_DRAWDOWN_USD}). Tripping fail-closed.`);
    return { safe: false, reason: "MAX_DAILY_DRAWDOWN_BREACHED" };
  }

  // 2. Slippage Ceiling Check
  if (candidateTrade.slippageBps > MAX_SLIPPAGE_BPS) {
    return { safe: false, reason: `SLIPPAGE_EXCEEDED_${candidateTrade.slippageBps}_BPS` };
  }

  // 3. Profit Floor Check
  if (candidateTrade.netProfitUSD < MIN_NET_PROFIT_USD) {
    return { safe: false, reason: "NET_PROFIT_BELOW_STATUTORY_FLOOR" };
  }

  return { safe: true, reason: "ALL_RISK_GATES_PASSED" };
}

module.exports = { checkCircuitSafety };
