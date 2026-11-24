const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🔍 [HealthCheck] Initiating Chronos OS System Verification...\n");

let failures = 0;

// 1. PM2 Daemon & Process Status
console.log("--- [1/3] PM2 Daemon Telemetry ---");
try {
    const pm2ListJson = execSync('pm2 jlist', { encoding: 'utf8' });
    const procs = JSON.parse(pm2ListJson);
    if (procs.length === 0) {
        console.warn("⚠️ [PM2] No active PM2 processes registered.");
        failures++;
    } else {
        procs.forEach(p => {
            const status = p.pm2_env.status;
            const memory = (p.monit.memory / 1024 / 1024).toFixed(2);
            const cpu = p.monit.cpu;
            console.log(`  - Process [${p.name}]: Status = ${status.toUpperCase()} | RAM = ${memory} MB | CPU = ${cpu}%`);
            if (status !== 'online') failures++;
        });
    }
} catch (err) {
    console.error("❌ [PM2] Failed to query PM2 daemons:", err.message);
    failures++;
}

// 2. POSIX Permissions & Workspace Structure
console.log("\n--- [2/3] POSIX Permissions & Directory Integrity ---");
const criticalPaths = [
    { path: 'contracts/ChronosFlashArb.sol', type: 'file' },
    { path: 'scripts/deploy_direct.cjs', type: 'file' },
    { path: 'data', type: 'dir' },
    { path: 'package.json', type: 'file' }
];

criticalPaths.forEach(item => {
    const fullPath = path.resolve(item.path);
    if (!fs.existsSync(fullPath)) {
        console.error(`  - ❌ Missing required asset: ${item.path}`);
        failures++;
        return;
    }
    const stats = fs.statSync(fullPath);
    const mode = stats.mode & parseInt('777', 8);
    console.log(`  - 🛡️ [POSIX] ${item.path} -> Permissions: octal ${mode.toString(8)}`);
});

// 3. Policy P0 Compliance Verification
console.log("\n--- [3/3] Policy P0 Compliance Parameters ---");
const expectedHurdleBps = 8.5;
const expectedGasCapGwei = 0.05;

const contractSourcePath = path.resolve('contracts', 'ChronosFlashArb.sol');
if (fs.existsSync(contractSourcePath)) {
    const source = fs.readFileSync(contractSourcePath, 'utf8');
    const hasReentrancy = source.includes('ReentrancyGuard');
    const hasOwnable = source.includes('Ownable');
    console.log(`  - Policy P0 Hurdle Requirement: ${expectedHurdleBps} bps (${expectedHurdleBps / 100}% net gain)`);
    console.log(`  - Policy P0 Gas Cap Ceiling: ${expectedGasCapGwei} Gwei`);
    console.log(`  - Reentrancy Guard Protection: ${hasReentrancy ? 'ACTIVE (Verified)' : 'MISSING'}`);
    console.log(`  - Access Control (Ownable): ${hasOwnable ? 'ACTIVE (Verified)' : 'MISSING'}`);
    
    if (!hasReentrancy || !hasOwnable) failures++;
} else {
    console.error("  - ❌ ChronosFlashArb.sol not found for policy verification.");
    failures++;
}

console.log("\n====================================================================");
if (failures === 0) {
    console.log("✅ [System Health] ALL CHECKS PASSED. Strict mode nominal.");
} else {
    console.error(`❌ [System Health] Verification completed with ${failures} warning(s)/failure(s).`);
    process.exitCode = 1;
}
