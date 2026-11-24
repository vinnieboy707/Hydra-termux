"use strict";

/**
 * APEX Governance Guard: Fail-Closed Production Verifier
 * Mandate: No paper profits, no mock gas, no dummy addresses.
 */
function assertLiveProductionState(config = {}) {
  const disallowedTerms = ["mock", "simulation", "testnet", "dummy", "sandbox"];
  
  if (process.env.NODE_ENV !== "production") {
    throw new Error("[SECURITY CRITICAL] NODE_ENV is not set to 'production'. Execution halted.");
  }

  for (const [key, val] of Object.entries(process.env)) {
    if (typeof val === "string") {
      for (const term of disallowedTerms) {
        if (val.toLowerCase().includes(term) && !key.includes("TEST")) {
          throw new Error(`[GOVERNANCE VIOLATION] Environment variable ${key} contains mock value '${val}'. Aborting.`);
        }
      }
    }
  }

  // Validate critical RPC endpoints
  if (!process.env.EVM_RPC_URL || process.env.EVM_RPC_URL.includes("localhost")) {
    throw new Error("[FATAL] Missing or local-only EVM_RPC_URL. Fail-closed enforced.");
  }
  if (!process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL.includes("localhost")) {
    throw new Error("[FATAL] Missing or local-only SOLANA_RPC_URL. Fail-closed enforced.");
  }

  return true;
}

function verifyRealWithdrawableProfit(reportedAmount, onChainTxReceipt) {
  if (!onChainTxReceipt || !onChainTxReceipt.status || onChainTxReceipt.status !== 1) {
    throw new Error("[GOVERNANCE VIOLATION] Unverified or reverted transaction cannot be classified as profit.");
  }
  if (!reportedAmount || reportedAmount <= 0) {
    throw new Error("[GOVERNANCE VIOLATION] Profit must be greater than zero real withdrawable currency.");
  }
  return true;
}

module.exports = {
  assertLiveProductionState,
  verifyRealWithdrawableProfit
};
