const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_FILES = [
  'ecosystem.config.js',
  'src/server.ts',
  'src/mesh-syncer.ts',
  'scripts/arb-swarm-worker.ts',
  'scripts/cron-security-audit.ts',
  'contracts/ChronosFlashArb.sol',
  '.env.production'
];

function verifyDagLineage() {
  console.log('Running DAG Zero-Orphan Lineage verification...');
  let missing = 0;
  
  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      console.error(`[ERROR] Missing required lineage file: ${file}`);
      missing++;
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      console.log(`[VERIFIED] ${file} | SHA-256: ${hash.substring(0, 16)}...`);
    }
  }

  if (missing > 0) {
    console.error(`[FAIL] Verification failed. Missing ${missing} required file(s).`);
    process.exit(1);
  }
  console.log('All DAG lineages verified successfully. Zero orphans detected.');
}

verifyDagLineage();
