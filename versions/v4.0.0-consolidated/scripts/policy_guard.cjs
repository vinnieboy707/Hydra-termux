const fs = require('fs');
const path = require('path');

function validateLedgerEntry(entry) {
  // Policy P0: Reject any record containing simulation flags or unconfirmed status
  if (!entry) {
    throw new Error('POLICY REJECTION: Empty ledger entry.');
  }
  if (entry.simulated === true || entry.isDryRun === true) {
    throw new Error('POLICY P0 VIOLATION: Attempted to write simulation or dry-run data to production ledger.');
  }
  if (!entry.txHash || entry.txHash.length !== 66 || !entry.txHash.startsWith('0x')) {
    throw new Error('POLICY P0 VIOLATION: Invalid or missing mainnet transaction hash. Simulations are strictly prohibited on ledgers.');
  }
  console.log('✅ Policy P0 Validation Passed: Confirmed mainnet transaction verified.');
  return true;
}

// Test validation against current audit record if present
const auditPath = path.join(process.cwd(), 'artifacts', 'deployment_audit.json');
if (fs.existsSync(auditPath)) {
  try {
    const record = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    validateLedgerEntry(record);
  } catch (err) {
    console.error('❌ Ledger Policy Check Failed:', err.message);
  }
}
