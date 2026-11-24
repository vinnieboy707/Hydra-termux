'use strict';
// integrity-status.js - computes what is actually true about this node and prints it.
// Nothing here is asserted: every line comes from the files and settings on this machine.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SELF = path.basename(__filename);
const SEND_PATTERN = 'sendTransaction|sendRawTransaction|sendAndConfirm|\\.transfer\\(|payouts\\.create|transfers\\.create';
let shown = false;

function ledgerPath() {
  if (process.env.CHRONOS_LEDGER_PATH) return path.resolve(process.env.CHRONOS_LEDGER_PATH);
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch (_) { /* default name */ }
  return path.resolve(ROOT, cfg.unified_ledger || 'unified_financial_ledger.wal');
}

function verifyChain(file) {
  if (!fs.existsSync(file)) return { exists: false, rows: 0, valid: 0, evidence: 0, issues: [] };
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  let prev = '0'.repeat(64), valid = 0, evidence = 0;
  const issues = [];
  rows.forEach((line, i) => {
    let e;
    try { e = JSON.parse(line); } catch (_) { issues.push((i + 1) + ': unparseable'); return; }
    if (!e.hash) { issues.push((i + 1) + ': no hash'); return; }
    const { hash, ...body } = e;
    const calc = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    if (calc !== hash) issues.push((i + 1) + ': hash mismatch');
    else if (e.prevHash !== prev) issues.push((i + 1) + ': prevHash does not link');
    else valid++;
    if (/^0x[0-9a-fA-F]{64}$/.test(String(e.txHash || ''))) evidence++;
    prev = hash;
  });
  return { exists: rows.length > 0, rows: rows.length, valid, evidence, issues };
}

function sendMode() {
  const killFile = process.env.KILL_SWITCH_FILE || path.join(ROOT, 'KILL_SWITCH');
  if (process.env.KILL_SWITCH === '1' || fs.existsSync(killFile)) return { enabled: false, label: 'BLOCKED (kill switch active)' };
  if (process.env.CHRONOS_LIVE !== '1') return { enabled: false, label: 'BLOCKED (dry-run default; CHRONOS_LIVE is not 1)' };
  return { enabled: true, label: 'ENABLED (CHRONOS_LIVE=1)' };
}

function codeFiles() {
  const out = [];
  for (const dir of [path.join(ROOT, 'src'), ROOT]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js') || f === SELF || /^(test_|verify_)/.test(f)) continue;
      const p = path.join(dir, f);
      if (fs.statSync(p).isFile()) out.push(p);
    }
  }
  return out;
}

function sendSites() {
  const re = new RegExp(SEND_PATTERN, 'g');
  const sites = [];
  for (const p of codeFiles()) {
    const txt = fs.readFileSync(p, 'utf8');
    const sends = (txt.match(re) || []).length;
    if (!sends) continue;
    const guards = (txt.match(/assertLiveAllowed\(/g) || []).length;
    sites.push({ file: path.relative(ROOT, p), sends, guards, guarded: guards >= sends });
  }
  return sites;
}

function yieldRows() {
  try {
    const out = cp.execFileSync('sqlite3', ['-readonly', path.join(ROOT, 'data', 'chronos_production.db'),
      'select count(*) from verified_revenue_ledger;'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
    const n = parseInt(String(out).trim(), 10);
    return Number.isFinite(n) ? n : 'unavailable';
  } catch (_) { return 'unavailable'; }
}

function snapshot() {
  return { time: new Date().toISOString(), sends: sendMode(), ledger: verifyChain(ledgerPath()),
    yieldRows: yieldRows(), sendSites: sendSites() };
}

function bannerLines(s) {
  s = s || snapshot();
  const L = s.ledger;
  const ledgerLine = !L.exists ? 'no ledger rows (nothing booked)'
    : L.rows + ' row(s); hash chain valid for ' + L.valid + '/' + L.rows + '; rows carrying an on-chain tx hash: ' + L.evidence;
  const unguarded = s.sendSites.filter((x) => !x.guarded).map((x) => x.file);
  return [
    '--- CHRONOS STATUS (computed at startup, not asserted) ---',
    '[SENDS]      ' + s.sends.label,
    '[LEDGER]     ' + ledgerLine,
    '[YIELD DB]   ' + (typeof s.yieldRows === 'number' ? s.yieldRows + ' row(s)' : 'unavailable'),
    '[SEND PATHS] ' + s.sendSites.length + ' file(s) with send calls; unguarded: ' + (unguarded.length ? unguarded.join(', ') : 'none'),
    '[NOTE]       revenue counts as verified only with a confirmed on-chain receipt (checked when it is booked)',
    '---'
  ];
}

function printBanner() {
  if (shown) return;
  shown = true;
  try { bannerLines().forEach((l) => console.log(l)); }
  catch (e) { console.error('[status] banner unavailable: ' + e.message); }
}

function markdown() {
  const s = snapshot();
  const L = s.ledger;
  const rows = s.sendSites.map((x) => '| ' + x.file + ' | ' + x.sends + ' | ' + x.guards + ' | ' + (x.guarded ? 'yes' : '**NO**') + ' |');
  return [
    '# Chronos status',
    '',
    'Generated ' + s.time + ' by `node src/integrity-status.js --md`. Every value below was computed from the code and data on this machine at that moment; regenerate to refresh. Nothing here is a promise.',
    '',
    '## Send mode',
    s.sends.label,
    '',
    '## Ledger (' + path.relative(ROOT, ledgerPath()) + ')',
    L.exists ? '- rows: ' + L.rows + '\n- hash chain valid for: ' + L.valid + '/' + L.rows + '\n- rows carrying an on-chain tx hash: ' + L.evidence
      : '- no rows booked',
    L.issues.length ? '- chain issues: ' + L.issues.slice(0, 5).join('; ') : '',
    '',
    '## Yield database rows',
    typeof s.yieldRows === 'number' ? String(s.yieldRows) : 'unavailable',
    '',
    '## Files containing send or payout calls',
    '| file | send calls | guard calls | guarded |',
    '|---|---|---|---|',
    ...(rows.length ? rows : ['| none found | 0 | 0 | n/a |']),
    '',
    'A row is only counted verified revenue when it carries a transaction hash that a node confirms succeeded. Run `node ~/chronos_status_24h.js` for the on-chain check.',
    ''
  ].join('\n');
}

module.exports = { snapshot, bannerLines, printBanner, markdown, verifyChain, ledgerPath, sendMode, sendSites, codeFiles };

if (require.main === module) {
  if (process.argv.includes('--md')) process.stdout.write(markdown());
  else bannerLines().forEach((l) => console.log(l));
}
