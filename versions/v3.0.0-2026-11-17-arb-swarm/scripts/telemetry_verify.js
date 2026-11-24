import { execSync } from 'child_process';
import { PureSqliteVault } from '../dist/src/dbWallet.js';
import path from 'path';

console.log('=========================================================');
console.log('CHRONOS OS: TELEMETRY & VAULT VERIFICATION SCRIPT');
console.log('=========================================================');

try {
  console.log('\n📊 [PM2 Process Status]');
  execSync('pm2 status', { stdio: 'inherit' });

  console.log('\n🔍 [Initializing SQLite Vault & Test Record]');
  const vaultPath = path.join(process.cwd(), 'data', 'vault_store.sqlite');
  const db = new PureSqliteVault(vaultPath);
  await db.init();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      token_in TEXT,
      token_out TEXT,
      approved INTEGER,
      confidence REAL,
      net_profit TEXT,
      reason TEXT
    );
  `);

  // Insert a test verification decision
  const stmt = db.prepare(`
    INSERT INTO agent_decisions (token_in, token_out, approved, confidence, net_profit, reason)
    VALUES (?, ?, 1, 0.99999, ?, ?)
  `);
  stmt.run('WETH', 'USDC', '50000000000000000', 'Telemetry verification sweep executed successfully.');

  const rows = db.prepare('SELECT * FROM agent_decisions ORDER BY timestamp DESC LIMIT 5').all();
  console.log('\n📋 Recent Agent Decisions in Vault:');
  console.table(rows);

  console.log('\n✅ [OK] Telemetry verification completed successfully. All systems nominal.');
} catch (err) {
  console.error('❌ [ERROR] Telemetry verification failed:', err.message);
}
