const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve('data', 'vault_store.sqlite');
const backupDir = path.resolve('backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `vault_store_${timestamp}.sqlite`);

console.log("🔒 [VaultBackup] Initializing native atomic WAL backup via built-in SQLite...");

try {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const db = new DatabaseSync(dbPath);
    db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT, val TEXT);`);
    db.exec(`VACUUM INTO '${backupPath}';`);
    db.close();

    console.log(`✅ [Backup Success] Atomic snapshot safely created at: ${backupPath}`);

    const verifyDb = new DatabaseSync(backupPath);
    const integrityResult = verifyDb.prepare(`PRAGMA integrity_check;`).all();
    verifyDb.close();

    console.log("📊 [Integrity Verification Report]:", integrityResult);
} catch (err) {
    console.error("❌ [Backup Failed]:", err.message);
    process.exit(1);
}
