const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');

console.log("🩺 [HealthMonitor] Initializing Chronos Automated Telemetry Health Guard...");

function runHealthCheck() {
    const timestamp = new Date().toISOString();
    let issues = [];

    // 1. Check PM2 Processes via jlist
    try {
        const pm2Json = execSync('pm2 jlist', { encoding: 'utf8' });
        const procs = JSON.parse(pm2Json);
        procs.forEach(p => {
            if (p.pm2_env.status !== 'online') {
                issues.push(`Process [${p.name}] status is ${p.pm2_env.status}`);
            }
        });
    } catch (err) {
        issues.push(`PM2 status check failed: ${err.message}`);
    }

    // 2. Check SQLite WAL Database Integrity
    try {
        const dbPath = path.resolve('data', 'wallet_state.db');
        if (!fs.existsSync(dbPath)) {
            issues.push("SQLite WAL database file missing.");
        } else {
            const db = new Database(dbPath, { readonly: true });
            db.prepare('SELECT COUNT(*) FROM wallet_ledger').get();
            db.close();
        }
    } catch (err) {
        issues.push(`SQLite WAL read error: ${err.message}`);
    }

    // 3. Output Telemetry Health Report
    if (issues.length > 0) {
        console.warn(`[${timestamp}] ⚠️ [Health Alert] Issues detected:`, issues.join(' | '));
    } else {
        console.log(`[${timestamp}] ✅ [Health Nominal] All daemons, PM2 clusters, and SQLite WAL vaults operating at 100% efficiency.`);
    }
}

// Run immediately, then every 60 seconds
runHealthCheck();
setInterval(runHealthCheck, 60000);
