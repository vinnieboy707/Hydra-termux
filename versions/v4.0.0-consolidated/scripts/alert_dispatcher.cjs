const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const REAL_RUN_PATH = path.join(process.cwd(), "logs", "real_execution_ledger.jsonl");
const STATE_PATH = path.join(process.cwd(), "logs", "autonomous_state.json");
const WALLET_ADDRESS = "0xbdf5cC5F73e81E5BE2d495f04BAc1A864372407a";

let lastProcessedLines = 0;

function checkLedgerForAlerts() {
    try {
        if (!fs.existsSync(REAL_RUN_PATH)) return;

        const content = fs.readFileSync(REAL_RUN_PATH, "utf8").trim();
        if (!content) return;

        const lines = content.split("\n").filter(Boolean);
        if (lines.length > lastProcessedLines) {
            const newLines = lines.slice(lastProcessedLines);
            newLines.forEach(line => {
                const record = JSON.parse(line);
                console.log("\n================================================================");
                console.log("🚨 [CHRONOS REVENUE ALERT] Profit Event Dispatched to External Wallet!");
                console.log("================================================================");
                console.log(`🕒 Timestamp: ${record.timestamp}`);
                console.log(`🔗 Target Wallet: ${WALLET_ADDRESS}`);
                console.log(`📈 Pair: ${record.pair} | Route: ${record.route}`);
                console.log(`⚡ Spread Captured: ${record.spreadBps} bps`);
                console.log(`🔍 Transaction Hash: ${record.txHash}`);
                console.log(`💰 Updated Tranche: ${record.newTranche || "Compounded"}`);
                console.log("================================================================\n");

                // Optional: Insert webhook push here (Telegram/Discord API call)
            });
            lastProcessedLines = lines.length;
        }
    } catch (err) {
        console.error("Error reading ledger for alerts:", err.message);
    }
}

console.log("🔔 [Chronos Alert Dispatcher] Monitoring dual-ledger for external wallet revenue events...");
setInterval(checkLedgerForAlerts, 3000);
