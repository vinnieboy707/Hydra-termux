import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import db from "../src/db/json-ledger.mjs";

console.log("========================================================");
console.log("CHRONOS OS // STRICT MAINNET TRANSACTION VALIDATOR");
console.log("========================================================");

const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.ARB_RPC_URL || "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function enforceStrictMainnetPurity() {
  const ledger = db.prepare("SELECT * FROM verified_revenue_ledger").all();
  let validCount = 0;
  let purgedCount = 0;

  for (const entry of ledger) {
    const isMock = entry.tx_hash.includes("simulated") || entry.tx_hash.includes("mock") || entry.tx_hash.length < 60;
    
    if (isMock) {
      db.prepare("DELETE FROM verified_revenue_ledger WHERE id = ?").run(entry.id);
      purgedCount++;
      console.log(`[!] Purged Non-Mainnet Entry ID #${entry.id} (Hash: ${entry.tx_hash})`);
    } else {
      try {
        const receipt = await provider.getTransactionReceipt(entry.tx_hash);
        if (receipt && receipt.status === 1) {
          validCount++;
          console.log(`[✔] Verified Mainnet TX ID #${entry.id} (Block #${receipt.blockNumber})`);
        } else {
          db.prepare("DELETE FROM verified_revenue_ledger WHERE id = ?").run(entry.id);
          purgedCount++;
          console.log(`[!] Purged Unmined/Failed TX ID #${entry.id}`);
        }
      } catch (err) {
        db.prepare("DELETE FROM verified_revenue_ledger WHERE id = ?").run(entry.id);
        purgedCount++;
        console.log(`[!] Purged Unindexed TX ID #${entry.id} (${err.message})`);
      }
    }
  }

  const summary = db.prepare("SELECT SUM(net_profit_usd) as total FROM verified_revenue_ledger").get();
  const total = summary?.total || 0;

  console.log("========================================================");
  console.log(`Purged Invalid Records : ${purgedCount}`);
  console.log(`Valid Mainnet Records  : ${validCount}`);
  console.log(`Strict Mainnet Revenue : $${total.toFixed(2)}`);
  console.log("========================================================");
}

enforceStrictMainnetPurity();
