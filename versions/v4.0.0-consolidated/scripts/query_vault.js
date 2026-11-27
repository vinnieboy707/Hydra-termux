import { PureSqliteVault } from '../dist/src/dbWallet.js';
import path from 'path';

(async () => {
  const dbPath = path.join(process.cwd(), 'data', 'vault_store.sqlite');
  const db = new PureSqliteVault(dbPath);
  await db.init();

  console.log('=========================================================');
  console.log('CHRONOS OS: VAULT LEDGER INSPECTION');
  console.log('=========================================================');

  const policies = db.prepare('SELECT * FROM system_policies').all();
  console.log('\n🛡️ [System Policies]');
  console.table(policies);

  const decisions = db.prepare('SELECT * FROM agent_decisions').all();
  console.log('\n📋 [Agent Decisions Ledger]');
  if (decisions.length > 0) {
    console.table(decisions);
  } else {
    console.log('✨ Ledger is pristine (0 entries). Policy P0 active.');
  }
})();
