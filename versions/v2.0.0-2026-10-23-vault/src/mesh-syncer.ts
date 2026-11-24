import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

import { DatabaseSync } from 'node:sqlite';
import { join } from 'path';

const dbPath: string = join(__dirname, '../../vault_store.db');
const db: DatabaseSync = new DatabaseSync(dbPath);

console.log('[MESH-SYNCER] Initializing Tier 2 WAL Mesh Snapshot...');

try {
  db.exec('PRAGMA wal_checkpoint(FULL);');
  console.log('[MESH-SYNCER] WAL checkpoint successful. Mesh synchronized.');
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error('[MESH-SYNCER ERROR] Failed to synchronize WAL ledger:', errorMessage);
  process.exit(1);
}
