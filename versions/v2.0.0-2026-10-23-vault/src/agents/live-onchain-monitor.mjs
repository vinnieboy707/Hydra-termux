import { ethers } from "ethers";
import db from "../db/json-ledger.mjs";

console.log("========================================================");
console.log("CHRONOS OS // STRICT ON-CHAIN MAINNET MONITOR ACTIVE");
console.log("========================================================");

const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.ARB_RPC_URL || "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(rpcUrl);
const executorWallet = process.env.EXECUTOR_WALLET_ADDRESS || "0x52a7158a00000000000000000000000000000052";

async function pollRealOnChainActivity() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const balance = await provider.getBalance(executorWallet);
    console.log(`[Mainnet Live Scan] Block #${blockNumber} | Executor Wallet Balance: ${ethers.formatEther(balance)} ETH`);
  } catch (err) {
    console.warn(`[!] Mainnet RPC Poll Warning: ${err.message}`);
  }
}

setInterval(pollRealOnChainActivity, 15000);
pollRealOnChainActivity();
