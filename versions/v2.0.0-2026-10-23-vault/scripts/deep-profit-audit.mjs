import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const envPath = path.join(ROOT, ".env");

console.log("🔍 Executing Deep Profitability & Spread Architecture Audit...");

let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

const getEnv = (key, defaultVal) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : defaultVal;
};

const gasMarginBps = parseInt(getEnv("GAS_COST_MARGIN_BPS", "500"), 10);
const minProfitUnits = getEnv("MIN_NET_PROFIT_TOKEN_UNITS", "1000000000000000");
const maxFeeGwei = getEnv("MAX_FEE_GWEI", "60");

console.log("\n📊 --- ACTIVE EXECUTION PARAMETERS ---");
console.log(`Gas Safety Margin (BPS): ${gasMarginBps} (${gasMarginBps / 100}% buffer)`);
console.log(`Min Net Profit Units (Wei): ${minProfitUnits}`);
console.log(`Max Fee Gwei Ceiling: ${maxFeeGwei}`);

console.log("\n💡 AUDIT RECOMMENDATIONS FOR INSTANT PROFIT CAPTURE:");
console.log("  1. Route Multi-Hop Liquidity Directly: Ensure scanner checks Balancer V2 vaults against Uniswap V3 pools with liquidity depth > $500k.");
console.log("  2. Eliminate Static Gas Overestimation: Arbitrum gas spikes are transient; utilizing dynamic basefee estimation prevents false-positive trade drops.");
console.log("  3. Enable Flash Loan Premium Inclusion: Ensure Aave v3 pool flash loan fee (0.05%) is explicitly deducted prior to hurdle calculation.");
