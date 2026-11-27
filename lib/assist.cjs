'use strict';
// chronos assist: a help agent you can run at any time. It checks this device and its engine, maps what it finds to
// the troubleshooting guide (docs/OPERATIONS.md is the single source of every fix), answers questions from the same
// guide, and, if you configured an AI model, adds a plain-language diagnosis. Read-only: it never changes anything.
const fs = require('fs');
const path = require('path');
const { redact } = require('./safety.cjs');

const ROOT = path.join(__dirname, '..');
const GUIDE = 'docs/OPERATIONS.md';
const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v || '');

/** the troubleshooting and incident tables, parsed: [{ symptom, cause, fix, section }] */
function guide(text = fs.readFileSync(path.join(ROOT, GUIDE), 'utf8')) {
  const rows = [];
  for (const [section, anchor] of [['## Troubleshooting', 'troubleshooting'], ['## Incident response', 'incident-response']]) {
    const i = text.indexOf(section); if (i < 0) continue;
    const body = text.slice(i).split('\n## ')[0];
    for (const l of body.split('\n')) {
      const c = l.split(/(?<!\\)\|/).map((x) => x.trim()).filter((_, k, a) => k > 0 && k < a.length - 1);
      if (c.length !== 3 || /^-+$/.test(c[0]) || /^(Symptom|Incident)$/.test(c[0])) continue;
      rows.push({ symptom: c[0], cause: c[1], fix: c[2], section: anchor });
    }
  }
  return rows;
}

// what each finding means, by the guide row (symptom text) that explains it
const ROW = {
  'settings-missing': 'Settings missing',
  'nodes-down': 'No RPC node answers as Arbitrum One',
  'device-unenrolled': '`this device is not enrolled yet`',
  'device-pending': 'Device not approved yet',
  'integrity': '`Code integrity check failed`',
  'foreign-files': 'Foreign files reported by `chronos doctor`',
  'engine-down': 'Engine not running',
  'scans-stale': 'Stage 2 not met, 0 errors',
  'scan-error': 'Last scan failed',
  'no-wss': 'No websocket feed',
  'no-executor': 'No executor yet',
  'no-contract': 'Contract not deployed',
  'no-wallets': 'Profit wallets not set',
  'nothing-approved': 'No routes approved for hours',
  'broken-pools': 'Broken pools are taking the quotes',
  'crash-loop': 'Engine keeps crashing (safe mode)',
};

/**
 * Pure: facts about this device → findings, most important first. facts = { settingsProblems: [], nodes: [{ ok }],
 * device: { status } | null, integrity: { ok, foreign: [] }, engine: { state, alive } | null, env: (key) => value }
 */
function diagnose(facts) {
  const f = [];
  const add = (id, detail) => f.push({ id, detail: redact(String(detail)) });
  const env = facts.env || (() => undefined);
  if (facts.crash && facts.crash.safeUntil > (facts.now || Date.now())) add('crash-loop', facts.crash.lastCrash ? `last crash: ${facts.crash.lastCrash.msg}` : 'repeated unclean restarts');
  if (facts.settingsProblems && facts.settingsProblems.length) add('settings-missing', facts.settingsProblems.slice(0, 5).join('; '));
  if (facts.nodes && facts.nodes.length && !facts.nodes.some((n) => n.ok)) add('nodes-down', `${facts.nodes.length} node(s) configured, none answering as Arbitrum One`);
  if (facts.device) {
    if (facts.device.status === 'unenrolled') add('device-unenrolled', 'no device key on this device yet');
    else if (facts.device.status && facts.device.status !== 'approved') add('device-pending', `status ${facts.device.status}, pairing code ${facts.device.code || '—'}`);
  }
  if (facts.integrity && !facts.integrity.ok) add('integrity', 'the code differs from its seal');
  if (facts.integrity && facts.integrity.foreign && facts.integrity.foreign.length) add('foreign-files', facts.integrity.foreign.slice(0, 5).join(', '));
  const e = facts.engine;
  if (!e || !e.alive) add('engine-down', e && e.state ? `last heartbeat ${Math.round((Date.now() - e.state.heartbeat) / 1000)} s ago` : 'no engine state on this device');
  else {
    const s = e.state;
    if (s.error) add('scan-error', s.error);
    if (s.lastScanAt && s.interval && Date.now() - s.lastScanAt > Math.max(60000, s.interval * 3000)) add('scans-stale', `last completed scan ${Math.round((Date.now() - s.lastScanAt) / 1000)} s ago`);
    const I = s.res && s.res.indicators;
    if (s.res && !s.res.approved && I) {
      const b = (I.blockedBy || [])[0];
      // the best route losing (nearly) its whole size is a drained pool, not the market: say so, never "gaps closed"
      const best = I.best; const dust = best && best.amountUsd > 0 && best.netUsd <= -0.9 * best.amountUsd;
      if (dust) add('broken-pools', `best route ${(best.path || []).join('→')} loses ${Math.round((-best.netUsd / best.amountUsd) * 100)}% of its $${Math.round(best.amountUsd)}: a drained pool with a fake price is taking the scan's quotes${(I.brokenPools || []).length ? '' : ' (2.9.6 leaves such pools out: chronos update)'}`);
      add('nothing-approved', b ? `most routes are blocked by the ${b.filter} (${b.routes})${b.onlyThis ? `; best blocked by it alone would net ${b.bestNetIfOnlyThis >= 0 ? '+' : '−'}$${Math.abs(b.bestNetIfOnlyThis).toFixed(3)}` : ''}` : `${I.raw ? I.raw.grossPositive : 0} raw gaps at the screen size; none survived fees and gas`);
    }
  }
  if (!['ARBITRUM_WSS_URL', 'ARB_WSS_URL', 'ALCHEMY_WSS_URL', 'ARBITRUM_WSS_URL_2'].some((k) => /^wss:\/\//.test(env(k) || ''))) add('no-wss', 'no wss:// url in .env');
  if (!isAddr(env('CHRONOS_FLASH_ARB_ADDRESS'))) add('no-contract', 'CHRONOS_FLASH_ARB_ADDRESS not set');
  if (!isAddr(env('CHRONOS_EXECUTOR_ADDRESS')) || !env('CHRONOS_EXECUTOR_KMS_KEY')) add('no-executor', 'CHRONOS_EXECUTOR_ADDRESS / CHRONOS_EXECUTOR_KMS_KEY not set');
  if (!isAddr(env('TAX_RESERVE_VAULT')) || !isAddr(env('PAYOUT_WALLET_ADDRESS'))) add('no-wallets', [!isAddr(env('TAX_RESERVE_VAULT')) && 'TAX_RESERVE_VAULT', !isAddr(env('PAYOUT_WALLET_ADDRESS')) && 'PAYOUT_WALLET_ADDRESS'].filter(Boolean).join(', ') + ' not set');
  return f;
}

/** attach the guide row (cause, fix, doc link) to each finding */
function explain(findings, rows = guide()) {
  const { REMEDIES } = require('./remedy.cjs');
  return findings.map((x) => { const r = rows.find((y) => y.symptom === ROW[x.id]); const rm = REMEDIES[x.id] || {}; return { ...x, title: r ? r.symptom.replace(/`/g, '') : x.id, cause: r ? r.cause : null, fix: r ? r.fix : null, auto: rm.auto || null, you: rm.you || null, doc: `${GUIDE}#${r ? r.section : 'troubleshooting'}` }; });
}

/** a free-text question → the guide rows that best match it (word overlap; the guide is the only source) */
function answer(question, rows = guide()) {
  const words = (s) => new Set(String(s).toLowerCase().replace(/[`*]/g, '').split(/[^a-z0-9.]+/).filter((w) => w.length > 2 && !STOP.has(w)));
  const q = words(question); if (!q.size) return [];
  for (const w of [...q]) for (const x of SYN[w] || []) q.add(x); // everyday words → the guide's words
  return rows.map((r) => { const w = words(r.symptom + ' ' + r.cause + ' ' + r.fix); let n = 0; for (const x of q) if (w.has(x)) n++; return { r, n }; })
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3).map((x) => ({ ...x.r, doc: `${GUIDE}#${x.r.section}` }));
}
const SYN = {
  trade: ['routes', 'approved'], trades: ['routes', 'approved'], trading: ['routes', 'approved'], opportunities: ['routes', 'approved'], profit: ['routes', 'approved', 'profit'], money: ['profit', 'payout'],
  crash: ['crashing'], crashes: ['crashing'], crashed: ['crashing'], dead: ['running', 'stops'], stopped: ['stops', 'running'], offline: ['running', 'stops'],
  key: ['secret', 'keys'], leaked: ['exposed', 'secret'], hacked: ['compromised', 'exposed'], update: ['updating', 'release'], install: ['installer', 'device'],
  node: ['rpc', 'node'], rpc: ['node', 'rpc'], websocket: ['wss', 'websocket'], wss: ['websocket', 'wss'], portal: ['portal', 'device'], wallet: ['wallets', 'address'],
};
const STOP = new Set(['the', 'and', 'why', 'what', 'how', 'does', 'not', 'are', 'for', 'with', 'this', 'that', 'there', 'any', 'can', 'you', 'have', 'from', 'when', 'run', 'chronos']);

/** reads the facts from this device (no network except the device-status check and the node probe, both time-limited) */
async function gather() {
  const live = require('./live.cjs');
  const { loadConfig, parseEnvFile } = require('./config.cjs');
  const envFile = live.findEnvFile();
  const fileEnv = envFile ? parseEnvFile(envFile) : {};
  const env = (k) => (process.env[k] !== undefined ? process.env[k] : fileEnv[k]);
  const cfg = envFile ? loadConfig(envFile) : { problems: ['no .env found'] };
  const t = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  const [device, nodes] = await Promise.all([
    t(require('./device.cjs').status().catch(() => null), 6000),
    envFile ? t(require('./system.cjs').probeNodes(envFile).catch(() => []), 10000) : [],
  ]);
  const ls = require('./livestate.cjs');
  const r = ls.read(live.DATA);
  const engine = r.ok ? { state: r.state, alive: ls.alive(r.state, 90000) } : null;
  return { settingsProblems: cfg.problems || [], nodes: nodes || [], device, integrity: require('./integrity.cjs').verify(), engine, env, crash: require('./remedy.cjs').readStarts(live.DATA) };
}

module.exports = { guide, diagnose, explain, answer, gather, ROW, GUIDE };
