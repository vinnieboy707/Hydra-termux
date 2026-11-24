const fs = require("fs");
const path = require("path");

const logDir = path.join(process.cwd(), "logs");
const dryPath = path.join(logDir, "dry_run_ledger.jsonl");
const realPath = path.join(logDir, "real_execution_ledger.jsonl");

console.log("📊 [Chronos Ledger Analytics] Scanning operational logs...");

function analyzeLedger(filePath, label) {
    if (!fs.existsSync(filePath)) {
        console.log(`ℹ️ [${label}] Ledger file not yet created (waiting for block triggers).`);
        return;
    }
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);
    console.log(`\n📂 [${label}] Total Entries: ${lines.length}`);
    
    let totalSpread = 0;
    lines.forEach((line, idx) => {
        try {
            const entry = JSON.parse(line);
            totalSpread += entry.expectedSpreadBps || 0;
            if (idx < 3 || idx === lines.length - 1) {
                console.log(`  #${idx + 1} [Block ${entry.blockNumber}] Route: ${entry.route} | Spread: ${entry.expectedSpreadBps} bps | Decision: ${entry.agentDecision}`);
            }
        } catch (e) {
            console.log(`  ⚠️ Error parsing line ${idx + 1}`);
        }
    });
    if (lines.length > 0) {
        console.log(`  📈 Average Expected Spread: ${(totalSpread / lines.length).toFixed(2)} bps`);
    }
}

analyzeLedger(dryPath, "DRY-RUN SIMULATION LEDGER");
analyzeLedger(realPath, "REAL EXECUTION LEDGER");
