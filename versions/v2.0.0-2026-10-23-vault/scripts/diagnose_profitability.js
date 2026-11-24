import { ethers } from "ethers";
import db from "../src/db/json-ledger.mjs";

console.log("========================================================");
console.log("CHRONOS OS // MAINNET PROFITABILITY & SPREAD DIAGNOSTIC");
console.log("========================================================");

const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.ARB_RPC_URL;
if (!rpcUrl) {
  console.error("[!] CRITICAL: Mainnet RPC URL (`ALCHEMY_RPC_URL` or `ARB_RPC_URL`) is NOT set in environment.");
  console.error("    Without a live RPC provider, the bot cannot query real-time pool prices or dispatch trades.");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);

async function checkProfitability() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    const gasPriceGwei = ethers.formatUnits(feeData.gasPrice || 0n, "gwei");

    console.log(`[+] Mainnet RPC Connected Successfully.`);
    console.log(`[+] Current Block Number : ${blockNumber}`);
    console.log(`[+] Current Gas Price    : ${Number(gasPriceGwei).toFixed(2)} Gwei`);

    const summary = db.prepare("SELECT SUM(net_profit_usd) as totalProfit FROM verified_revenue_ledger").get();
    console.log(`[+] Current Ledger Total : $${summary?.totalProfit || 0.00}`);

    console.log("\n--------------------------------------------------------");
    console.log("Why hasn't a live trade cleared yet?");
    console.log("1. High Gas Competition: Public mempool gas prices on Arbitrum/Ethereum require spreads > gas cost.");
    console.log("2. Strict Net-Profit Hurdle: System rejects any spread where net yield < $10 after gas and 30% tax reserve.");
    console.log("3. Mempool Front-Running: Without private RPC endpoints (e.g., Flashbots / Alchemy private transactions), public arbitrage loops get sniped by competing bots.");
  } catch (err) {
    console.error("[!] Diagnostic Error:", err.message);
  }
}

checkProfitability();
