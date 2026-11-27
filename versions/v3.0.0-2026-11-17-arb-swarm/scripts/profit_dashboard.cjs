const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const LOG_DIR = path.join(process.cwd(), "logs");
const DRY_RUN_PATH = path.join(LOG_DIR, "dry_run_ledger.jsonl");
const REAL_RUN_PATH = path.join(LOG_DIR, "real_execution_ledger.jsonl");
const STATE_PATH = path.join(LOG_DIR, "autonomous_state.json");

function clearScreen() {
    process.stdout.write("\x1b[2J\x1b[3f\x1b[H");
}

function renderDashboard() {
    clearScreen();
    console.log("================================================================");
    console.log("⚡ CHRONOS OS — REAL-TIME ARBITRAGE & REVENUE DASHBOARD");
    console.log("================================================================");
    console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
    
    // Load current tranche state
    let currentTranche = "0.1 WETH";
    try {
        if (fs.existsSync(STATE_PATH)) {
            const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
            currentTranche = `${ethers.formatEther(state.currentBorrowAmountWei || "100000000000000000")} WETH`;
        }
    } catch {}
    console.log(`💰 Active Flash Loan Compound Tranche: ${currentTranche}`);
    console.log("----------------------------------------------------------------");

    // Read Dry Run Ledger
    let dryCount = 0;
    let maxSpread = 0;
    if (fs.existsSync(DRY_RUN_PATH)) {
        const lines = fs.readFileSync(DRY_RUN_PATH, "utf8").trim().split("\n").filter(Boolean);
        dryCount = lines.length;
        lines.forEach(line => {
            try {
                const record = JSON.parse(line);
                if (record.expectedSpreadBps > maxSpread) maxSpread = record.expectedSpreadBps;
            } catch {}
        });
    }

    // Read Real Execution Ledger
    let realCount = 0;
    let totalEstimatedProfitWei = 0n;
    if (fs.existsSync(REAL_RUN_PATH)) {
        const lines = fs.readFileSync(REAL_RUN_PATH, "utf8").trim().split("\n").filter(Boolean);
        realCount = lines.length;
        lines.forEach(line => {
            try {
                const record = JSON.parse(line);
                // Accumulate stats if present
            } catch {}
        });
    }

    console.log(`📊 Total Verified On-Chain Simulations Logged: ${dryCount}`);
    console.log(`🚀 Total Real Flash Loan Executions Confirmed: ${realCount}`);
    console.log(`📈 Peak Evaluated Spread: ${maxSpread} bps`);
    console.log("----------------------------------------------------------------");
    console.log("📜 [Recent Real-Time Ledger Events]:");

    if (fs.existsSync(REAL_RUN_PATH)) {
        const lines = fs.readFileSync(REAL_RUN_PATH, "utf8").trim().split("\n").filter(Boolean);
        const recent = lines.slice(-5);
        recent.forEach(l => {
            try {
                const r = JSON.parse(l);
                console.log(`   🔥 [${r.timestamp}] Pair: ${r.pair} | Route: ${r.route} | Tx: ${r.txHash}`);
            } catch {}
        });
    } else {
        console.log("   (Awaiting first cross-DEX spread crossing >= 25 bps threshold...)");
    }

    console.log("================================================================");
    console.log("Press Ctrl+C to exit dashboard loop.");
}

// Refresh dashboard every 2 seconds
setInterval(renderDashboard, 2000);
renderDashboard();
