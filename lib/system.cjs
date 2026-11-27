'use strict';
// Real system inventory: RPC nodes from your .env (names only, never URLs), PM2 services, capabilities.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { ethers } = require('ethers');
const { parseEnvFile } = require('./config.cjs');
const { clean, redact } = require('./safety.cjs');

const NODE_KEYS = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL', 'ARB_RPC_URL_2', 'ARB_RPC_URL_3', 'ARB_RPC_URL_4', 'ARB_RPC_URL_5', 'ARB_PRIVATE_RPC', 'ETH_PROVIDER_URL'];

async function probeNodes(envFile, timeoutMs = 6000) {
  const env = envFile ? parseEnvFile(envFile) : {};
  const out = [];
  for (const k of NODE_KEYS) {
    const url = process.env[k] || env[k];
    if (!url) continue;
    if (!/^https?:\/\//.test(url)) { out.push({ key: k, ok: false, detail: 'not an http(s) url (websocket or other); not probed' }); continue; }
    const t0 = Date.now();
    try {
      const p = new ethers.JsonRpcProvider(url, 42161, { staticNetwork: ethers.Network.from(42161) }); // fixed: no detect-network retry loop on a dead url
      const r = await Promise.race([Promise.all([p.send('eth_chainId', []), p.send('eth_blockNumber', [])]), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))]);
      const chain = Number(BigInt(r[0]));
      out.push({ key: k, ok: chain === 42161, chain, block: Number(BigInt(r[1])), ms: Date.now() - t0, detail: chain === 42161 ? 'Arbitrum One' : `chain ${chain} (not Arbitrum One)` });
      p.destroy();
    } catch (e) { out.push({ key: k, ok: false, ms: Date.now() - t0, detail: redact(e.shortMessage || e.message).slice(0, 50) }); }
  }
  return out;
}

function pm2List() {
  return new Promise((resolve) => {
    execFile('pm2', ['jlist'], { timeout: 5000 }, (err, stdout) => {
      if (!err) {
        const i = stdout.indexOf('[');
        try { return resolve({ source: 'pm2 jlist', apps: JSON.parse(stdout.slice(i)).map((a) => ({ name: clean(a.name), status: clean(a.pm2_env && a.pm2_env.status), restarts: a.pm2_env && a.pm2_env.restart_time, script: a.pm2_env && a.pm2_env.pm_exec_path })) }); } catch (_) { /* fall through */ }
      }
      const dump = path.join(os.homedir(), '.pm2', 'dump.pm2');
      try { return resolve({ source: 'saved list (~/.pm2/dump.pm2; daemon not running)', apps: JSON.parse(fs.readFileSync(dump, 'utf8')).map((a) => ({ name: clean(a.name), status: 'saved', script: a.pm_exec_path })) }); } catch (_) { resolve({ source: 'pm2 not found', apps: [] }); }
    });
  });
}

function ecosystemApps(workspace) {
  const f = path.join(workspace, 'ecosystem.config.cjs');
  try {
    const src = fs.readFileSync(f, 'utf8');
    const re = /name:\s*"([^"]+)"[\s\S]*?script:\s*"([^"]+)"/g; const out = []; let m;
    while ((m = re.exec(src))) out.push({ name: clean(m[1]), script: clean(m[2], 80), exists: fs.existsSync(path.join(workspace, m[2])) });
    return out;
  } catch (_) { return []; }
}

const CAPABILITIES = [
  { name: 'Opportunity scanner', status: 'LIVE', detail: 'real quotes, all pool pairs, both borrow directions' },
  { name: 'One-block scans + batching', status: 'LIVE', detail: 'every quote in a scan at one block; Multicall3 batches' },
  { name: '24/7 engine + phone alerts', status: 'LIVE', detail: 'PM2 service, boot start, wake lock, Termux:API / webhook, pinned money status with Scan now / Pause' },
  { name: 'Realized profit check', status: 'LIVE', detail: 'receipts of your contract only, net of gas paid' },
  { name: 'Autopilot', status: 'LIVE', detail: 'chronos autopilot: every step that does not need you' },
  { name: 'Size optimiser', status: 'LIVE', detail: 'tunes size inside your ladder; never loosens a guardrail' },
  { name: 'Guardrails + policies', status: 'LIVE', detail: 'P0 G1 T1 S0, gas gate, floor, impact cap' },
  { name: 'Measurement + GO/NO-GO', status: 'LIVE', detail: 'episodes across scans, thresholds from .env' },
  { name: 'Registry audit', status: 'LIVE', detail: 'checks src/registry.ts pools on-chain' },
  { name: 'Node health', status: 'LIVE', detail: 'every RPC in .env: chain id + latency' },
  { name: 'Gas calibration', status: 'CLI', detail: 'chronos gas 0xTX… from your real receipts' },
  { name: 'Contract test suite', status: 'SEPARATE', detail: 'chronos-flash-arb-tests (35 tests, mutation checked)' },
  { name: 'Shadow test (eth_call each block)', status: 'NOT BUILT', detail: 'next step after a GO' },
  { name: 'Code integrity seal', status: 'LIVE', detail: 'SHA-256 of every code file + ethers, checked at start' },
  { name: 'Executor (sends transactions)', status: 'ABSENT', detail: 'deliberately not in this console' },
];

module.exports = { probeNodes, pm2List, ecosystemApps, CAPABILITIES, NODE_KEYS };
