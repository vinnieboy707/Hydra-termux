const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../vault_store.db');

console.log('========================================================');
C = console.log;
C(' CHRONOS OS // LIVE SQLITE WAL VAULT TELEMETRY');
C('========================================================');

if (!fs.existsSync(dbPath)) {
  console.log('[WARN] vault_store.db not found at root. Initializing new WAL database...');
}

const db = new Database(dbPath, { verbose: null });
db.pragma('journal_mode = WAL');

// Check Integrity
const integrity = db.pragma('integrity_check', { simple: true });
console.log(`[Database Integrity Status] : ${integrity}`);

// Check WAL mode status
const journalMode = db.pragma('journal_mode', { simple: true });
console.log(`[Journal Mode Active]      : ${journalMode.toUpperCase()}`);

// Check tables and record counts
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
console.log(`[Registered Tables]         : ${tables.map(t => t.name).join(', ') || 'None'}`);

for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get().cnt;
  console.log(`  - Table '${t.name}': ${count} records`);
}

console.log('========================================================');
db.close();
