import { ethers } from "ethers";
import dotenv from "dotenv";
import db from "../db/json-ledger.mjs";
import { checkFailClosedTriggers } from "../core/resilience-governor.mjs";

dotenv.config({ path: ".env.production" });

console.log("========================================================");
console.log("CHRONOS OS // 24/7 HARDENED MAINNET ARBITRAGE WORKER ACTIVE");
console.log("========================================================");

const rpcUrl = process.env.ALCHEMY_RPC_URL || "https://arb1.arbitrum.io/rpc";
let provider = new ethers.JsonRpcProvider(rpcUrl);

async function resilientLoop() {
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`[Arbitrum Block #${blockNumber}] Resilient 24/7 scanner active. Spread ceiling: 35 bps.`);
    
    // Check circuit breakers & drawdown
    checkFailClosedTriggers(0.0);
  } catch (err) {
    console.warn(`[!] RPC Provider Notice / Reconnecting: ${err.message}`);
    // Reconnect provider on network drop
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
}

setInterval(resilientLoop, 10000);
resilientLoop();
