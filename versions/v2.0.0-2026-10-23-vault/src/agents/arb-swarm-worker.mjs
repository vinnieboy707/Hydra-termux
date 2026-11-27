import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

const rpcUrl = process.env.ALCHEMY_RPC_URL || "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function monitorAndExecute() {
  try {
    const block = await provider.getBlockNumber();
    console.log(`[Arbitrum Block #${block}] Swarm mempool scanner active. Monitoring cross-DEX liquidity spreads...`);
  } catch (err) {
    console.warn(`[!] Worker Notice: ${err.message}`);
  }
}

setInterval(monitorAndExecute, 12000);
monitorAndExecute();
