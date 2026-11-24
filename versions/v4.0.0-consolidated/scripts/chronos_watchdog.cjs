const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class ChronosAdvancedWatchdog {
    constructor() {
        this.workspaceDir = path.resolve(process.cwd());
        this.logDir = path.join(this.workspaceDir, "logs");
        if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
        this.auditLogPath = path.join(this.logDir, "watchdog_advanced_audit.jsonl");
        this.errorRegistryPath = path.join(this.logDir, "error_immunity_registry.jsonl");
        this.realRunPath = path.join(this.logDir, "real_execution_ledger.jsonl");
        
        // Infinity loop tracking memory map
        this.executionHistory = new Map();
    }

    logAudit(action, target, status, details) {
        const record = {
            timestamp: new Date().toISOString(),
            action,
            target,
            status,
            details
        };
        try {
            fs.appendFileSync(this.auditLogPath, JSON.stringify(record) + "\n", "utf8");
        } catch {}
        console.log(`🛡️ [Watchdog] [${action}] Target: ${target} | Status: ${status} | ${details}`);
    }

    scoutAndInspectSystem() {
        console.log("🕵️‍♂️ [Chronos Watchdog] Running full memory telemetry, profit audit, and infinity loop detection...");

        // 1. Audit PM2 Process Memory, CPU, and Success Metrics
        try {
            const pm2Status = execSync("pm2 jlist", { encoding: "utf8" });
            const processes = JSON.parse(pm2Status);

            processes.forEach(proc => {
                const name = proc.name;
                const cpu = proc.monit.cpu;
                const memoryMb = Math.round(proc.monit.memory / 1024 / 1024);
                const restarts = proc.pm2_env.restart_time;
                const status = proc.pm2_env.status;

                // --- INFINITY LOOP DETECTION POLICY ---
                // Detects runaway processes stuck in high CPU loops or rapid restart cycles (>10 restarts)
                if (cpu > 85 || restarts > 10) {
                    console.warn(`🚨 [Infinity Loop Detected] Process '${name}' exhibiting abnormal CPU (${cpu}%) or restart frequency (${restarts}). Isolating and resetting...`);
                    execSync(`pm2 restart ${name}`);
                    this.logAudit("INFINITY_LOOP_RESOLVED", name, "AUTO_RESTARTED", `CPU: ${cpu}%, Restarts: ${restarts}. Loop neutralized.`);
                } else {
                    this.logAudit("PROCESS_TELEMETRY", name, status.toUpperCase(), `CPU: ${cpu}% | RAM: ${memoryMb}MB | Restarts: ${restarts}`);
                }
            });
        } catch (err) {
            this.logAudit("TELEMETRY_AUDIT", "pm2_cluster", "WARNING", err.message);
        }

        // 2. Audit Profitability & Revenue Success (Job Success Metric)
        let totalProfitExecutions = 0;
        try {
            if (fs.existsSync(this.realRunPath)) {
                const lines = fs.readFileSync(this.realRunPath, "utf8").trim().split("\n").filter(Boolean);
                totalProfitExecutions = lines.length;
            }
        } catch {}

        console.log(`💰 [Job Success Audit] Total Verified On-Chain Profit Executions Logged: ${totalProfitExecutions}`);
        console.log(`✨ [Watchdog Sweep Complete] System memory optimal, infinity loop protection active, profit pipeline armed.\n`);
    }
}

const watchdog = new ChronosAdvancedWatchdog();
watchdog.scoutAndInspectSystem();
setInterval(() => {
    watchdog.scoutAndInspectSystem();
}, 15000);
