'use strict';
// chronos cloud-pack: the settings file for the Google Cloud engine. It carries your scanner settings, limits and
// PUBLIC addresses only. Every secret (node urls, API keys, webhook) and every signing key is left out: secrets go
// into Google Secret Manager through cloud/gcp-setup.sh (typed hidden), and the cloud engine signs with its HSM key.
const fs = require('fs');
const path = require('path');
const os = require('os');
const C = require('./catalog.cjs');
const E = require('./envfile.cjs');
const { POLICY } = require('./execpolicy.cjs');
const { DEPLOY_POLICY } = require('./deploy.cjs');

const PUBLIC = ['CHRONOS_FLASH_ARB_ADDRESS', 'CONTRACT_ADDRESS', 'CHRONOS_SYNC_URL', 'CHRONOS_AGENT_MODEL', 'PAYOUT_WALLET_ADDRESS', 'TAX_RESERVE_VAULT',
  'GAS_WALLET_ADDRESS', 'OPERATING_TREASURY', 'SCAN_EXTRA_TOKENS', 'SCAN_CONCURRENCY', 'SCREEN_SIZE_USD', 'CONCURRENCY', 'CHRONOS_BLOCKSCOUT_URL'];
// never exported, whatever the catalog says: the cloud engine has its own executor and its own key
const NEVER = new Set([...C.SIGNING_KEYS, ...C.SECRETS.filter((s) => s.secret).map((s) => s.key), 'CHRONOS_EXECUTOR_ADDRESS', 'CHRONOS_EXECUTOR_KMS_KEY']);

function exportSettings(envFile) {
  const doc = E.load(envFile);
  const keys = [...new Set([...C.SETTINGS.map((s) => s.key), ...POLICY.map((p) => p.key), ...DEPLOY_POLICY.map((p) => p.key), ...PUBLIC])].filter((k) => !NEVER.has(k));
  const lines = []; const missing = [];
  for (const k of keys) { const v = E.get(doc, k); if (v === undefined || v === '') { if (C.SETTINGS.some((s) => s.key === k)) missing.push(k); continue; } lines.push(`${k}=${v}`); }
  return { lines, missing };
}
function writePack(envFile, dir = null) {
  const { lines, missing } = exportSettings(envFile);
  const dl = path.join(os.homedir(), 'storage', 'downloads');
  const out = dir || (fs.existsSync(dl) ? dl : path.join(__dirname, '..', 'data'));
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, 'chronos-settings.env');
  fs.writeFileSync(file, `# chronos cloud-pack ${new Date().toISOString()} · settings and public addresses only, no secrets\n` + lines.join('\n') + '\n', { mode: 0o600 });
  return { file, lines, missing };
}
module.exports = { exportSettings, writePack, NEVER };
