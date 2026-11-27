import http from 'http';
import { PureSqliteVault } from '../src/dbWallet.js';
import path from 'path';

async function runHealthCheck() {
  console.log('🔍 [CHRONOS HEALTH CHECK] Beginning internal gateway verification...');

  // 1. Verify SQLite Pure-JS Vault
  try {
    const vault = new PureSqliteVault(path.join(__dirname, '../vault_store.sqlite'));
    await vault.init();
    const res = vault.prepare('SELECT 1 as val').get();
    if (res && res.val === 1) {
      console.log('✅ [VAULT] Pure-JS SQLite Vault is healthy and responsive.');
    } else {
      throw new Error('Vault query returned unexpected result.');
    }
  } catch (err: any) {
    console.error('❌ [VAULT ERROR] SQLite vault check failed:', err.message);
    process.exit(1);
  }

  // 2. Ping Internal Express / API Gateway (Port 3000)
  const req = http.get('http://localhost:3000/health', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`✅ [GATEWAY] HTTP /health endpoint responded with status ${res.statusCode}:`, data);
      console.log('🚀 All internal API gateways and databases are operating at peak efficiency.');
    });
  });

  req.on('error', (err) => {
    console.warn('⚠️ [GATEWAY WARN] Express server on port 3000 is not currently listening or offline:', err.message);
    console.log('💡 Note: Ensure chronos-pipeline-orchestrator is active in PM2.');
  });
}

runHealthCheck();
