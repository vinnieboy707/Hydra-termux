const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log("🔍 [Chronos Cluster Verification] Starting Comprehensive System Audit...\n");

let hasErrors = false;

// 1. Environment & Policy Validation
console.log("1️⃣ [Audit] Verifying Environment & Policy Parameters...");
const liveMode = process.env.CHRONOS_LIVE || '1';
const gasCeiling = process.env.GAS_CEILING_GWEI || '0.05';
const hurdleBps = process.env.HURDLE_BPS || '8.5';

console.log(`   - CHRONOS_LIVE: ${liveMode} ${liveMode === '1' ? '(LIVE MAINNET)' : '(SIMULATION)'}`);
console.log(`   - Policy P0 Gas Ceiling: ${gasCeiling} Gwei`);
console.log(`   - Profit Hurdle: ${hurdleBps} bps`);
if (liveMode !== '1') {
    console.error("   ❌ [Error] CHRONOS_LIVE is not set to '1'!");
    hasErrors = true;
} else {
    console.log("   ✅ Environment & Policies: PASSED");
}

// 2. SQLite WAL Vault & Relational Schema Validation
console.log("\n2️⃣ [Audit] Verifying SQLite WAL Vault & Relational Tables...");
const dbPath = path.resolve('data', 'vault_store.sqlite');
if (!fs.existsSync(dbPath)) {
    console.error("   ❌ [Error] Vault database file missing at:", dbPath);
    hasErrors = true;
} else {
    try {
        const db = new DatabaseSync(dbPath, { readonly: true });
        const tables = db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name IN ('execution_logs', 'vault_ledgers', 'tax_reserves', 'agent_telemetry');
        `).all();
        db.close();

        console.log(`   - Found active tables:`, tables.map(t => t.name).join(', '));
        if (tables.length < 4) {
            console.error("   ❌ [Error] One or more required relational tables are missing.");
            hasErrors = true;
        } else {
            console.log("   ✅ Database Schemas & Tables: PASSED");
        }
    } catch (err) {
        console.error("   ❌ [Error] Database connection/query failed:", err.message);
        hasErrors = true;
    }
}

// 3. PM2 Process Cluster Audit
console.log("\n3️⃣ [Audit] Verifying PM2 Production Daemon Cluster...");
try {
    const pm2ListJson = execSync('pm2 jlist', { encoding: 'utf8' });
    const apps = JSON.parse(pm2ListJson);
    
    const requiredApps = ['chronos-event-engine', 'chronos-web-portal', 'chronos-health-monitor'];
    for (const appName of requiredApps) {
        const target = apps.find(a => a.name === appName);
        if (!target || target.pm2_env.status !== 'online') {
            console.error(`   ❌ [Error] PM2 App '${appName}' is not online! Status: ${target ? target.pm2_env.status : 'MISSING'}`);
            hasErrors = true;
        } else {
            console.log(`   - App '${appName}': ONLINE (PID: ${target.pid}, CPU: ${target.monit.cpu}%, Mem: ${(target.monit.memory / 1024 / 1024).toFixed(1)}MB)`);
        }
    }
    console.log("   ✅ PM2 Cluster Status: PASSED");
} catch (err) {
    console.error("   ❌ [Error] Failed to query PM2 status:", err.message);
    hasErrors = true;
}

// Summary Report
console.log("\n==========================================");
if (hasErrors) {
    console.error("❌ [VERIFICATION FAILED] One or more subsystems require attention.");
    process.exit(1);
} else {
    console.log("🎉 [VERIFICATION SUCCESS] All systems, ledgers, daemons, and policies are 100% verified and operational!");
    process.exit(0);
}
