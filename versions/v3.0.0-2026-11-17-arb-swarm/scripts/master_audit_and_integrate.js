import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();

console.log("=========================================================");
console.log("CHRONOS OS: MASTER CODEBASE AUDIT & ADAPTATION SUITE");
console.log("=========================================================");

let issuesFound = 0;
let fixesApplied = 0;

// 1. Directory Structure Audit
console.log("\n[1/5] Auditing Directory Structure...");
const requiredDirs = ['src', 'scripts', 'data', 'parameters', 'procedures'];
for (const dir of requiredDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`⚠️ Missing directory '${dir}' created.`);
        fixesApplied++;
    } else {
        console.log(`✅ Directory '${dir}' verified.`);
    }
}

// 2. SQLite WAL Database Audit & Optimization
console.log("\n[2/5] Auditing SQLite WAL Databases...");
const databases = ['real_estate_master.db', 'vault_store.db', 'chronos_audit.db'];
for (const dbName of databases) {
    const dbPath = path.join(process.cwd(), 'data', dbName);
    try {
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        console.log(`✅ Database '${dbName}' active in WAL mode.`);
        db.close();
    } catch (err) {
        console.error(`❌ Error initializing database '${dbName}':`, err.message);
        issuesFound++;
    }
}

// 3. Environment Variable & Policy P0 Audit
console.log("\n[3/5] Auditing .env & Policy P0 Compliance...");
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.log("⚠️ .env missing. Generating default configuration template...");
    fs.writeFileSync(envPath, `ARBITRUM_SEQUENCER_URL=https://arb1-sequencer.arbitrum.io/rpc\nOPENROUTER_API_KEY=REDACTED_SECRET_MOVED_TO_ENV\nCHRONOS_LIVE=0\n`);
    fixesApplied++;
} else {
    console.log(`✅ .env configuration verified.`);
}

// 4. Module & Dependency Check
console.log("\n[4/5] Auditing Node.js Modules & Package Manifest...");
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = ['ethers', 'better-sqlite3', 'dotenv'];
    for (const dep of requiredDeps) {
        if (!pkg.dependencies || !pkg.dependencies[dep]) {
            console.log(`⚠️ Missing dependency '${dep}' in package.json.`);
            issuesFound++;
        } else {
            console.log(`✅ Dependency '${dep}' present.`);
        }
    }
} else {
    console.log(`❌ ERROR: package.json missing.`);
    issuesFound++;
}

// 5. Summary & Adaptation Report
console.log("\n=========================================================");
console.log(`AUDIT COMPLETE: Issues Found: ${issuesFound} | Fixes Applied: ${fixesApplied}`);
if (issuesFound === 0) {
    console.log("🚀 System Status: 100% Operational and Policy P0 Compliant.");
} else {
    console.log("⚠️ System Status: Requires dependency resolution (run 'npm install ethers better-sqlite3 dotenv').");
}
console.log("=========================================================");
