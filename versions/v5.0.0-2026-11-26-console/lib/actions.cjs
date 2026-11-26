'use strict';
// Things only you can do, with exact steps. Where the console can see the result itself it checks automatically;
// otherwise you mark the step done and the date is recorded in data/actions.json.
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config.cjs');

const DATA = process.env.CHRONOS_DATA_DIR || path.join(__dirname, '..', 'data');
const MARKS = path.join(DATA, 'actions.json');
const readMarks = () => { try { return JSON.parse(fs.readFileSync(MARKS, 'utf8')); } catch (_) { return {}; } };
function mark(id, done) { const m = readMarks(); if (done) m[id] = new Date().toISOString(); else delete m[id]; fs.mkdirSync(path.dirname(MARKS), { recursive: true }); fs.writeFileSync(MARKS, JSON.stringify(m, null, 2)); }

function scriptsUploadingEnv(workspace) {
  const dir = path.join(workspace, 'scripts'); const hits = [];
  let files = []; try { files = fs.readdirSync(dir); } catch (_) { return null; }
  for (const f of files.filter((x) => /\.(c|m)?js$/.test(x))) {
    let src = ''; try { src = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { continue; }
    if (!/files\.create|drive\.files|googleapis/.test(src)) continue;
    src.split('\n').forEach((l, i) => { if (/["'`]\.env["'`]/.test(l) && !/^\s*\/\//.test(l)) hits.push(`scripts/${f}:${i + 1}`); });
  }
  return hits;
}
const SUSPECT = ['master-arbitrage-engine.js', 'execute_gasless_flash_arb.py'];
function findSuspects(workspace) {
  const out = [];
  const walk = (d, depth) => { if (depth > 3) return; let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of es) { if (['node_modules', '.git', '_quarantine', 'chronos-console'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, depth + 1); else if (SUSPECT.includes(e.name)) out.push(path.relative(workspace, p)); } };
  walk(workspace, 0); return out;
}

function list(ctx) {
  const m = readMarks();
  const manual = (id) => (m[id] ? { state: 'done', detail: `marked done ${m[id].slice(0, 10)}` } : { state: 'todo', detail: 'only you can do this; mark it done when finished' });
  const A = [];
  const add = (a) => A.push(a);

  add({ id: 'env-perms', title: 'Lock your .env to your user (Policy S0)',
    check: () => { if (!ctx.envFile) return { state: 'todo', detail: 'no .env yet: set a key in Setup to create one' }; const mode = fs.statSync(ctx.envFile).mode & 0o777; return (mode & 0o077) ? { state: 'todo', detail: `permissions ${mode.toString(8)}` } : { state: 'done', detail: 'permissions 600' }; },
    steps: ['Choose "Fix it for me" below, or run:', `chmod 600 ${ctx.envFile || '<your .env>'}`],
    fix: () => { fs.chmodSync(ctx.envFile, 0o600); return 'set to 600'; } });

  add({ id: 'settings', title: 'Fill in every required scanner setting',
    check: () => { const c = loadConfig(ctx.envFile); return c.problems.length ? { state: 'todo', detail: `${c.problems.length} missing: ${c.problems.map((p) => p.split(' ')[0]).slice(0, 3).join(', ')}${c.problems.length > 3 ? '…' : ''}` } : { state: 'done', detail: 'all present' }; },
    steps: ['Open "Scanner settings" in this setup.', 'Choose "Fill every missing setting with the suggested value", or set each one yourself.'] });

  add({ id: 'drive-share', title: 'Restrict the 4 link-shared items in Google Drive',
    check: () => manual('drive-share'),
    steps: ['On drive.google.com search for each: "_.ENV SECRETS .txt", "Passwords.docx", "Computer Environment.docx", and the folder "CoinbaseWalletBackups" (sharing a folder shares everything inside it).', 'Right-click → Share → under "General access" choose Restricted → Done.', 'Repeat for all four. Anyone who had a link loses access immediately.', 'This step cannot be automated: the Drive tools available can add sharing but not remove it.'] });

  add({ id: 'rotate', title: 'Rotate keys that were in shared or uploaded files',
    check: () => manual('rotate'),
    steps: ['Treat every key that was in "_.ENV SECRETS .txt" or in a Drive backup containing .env as exposed.',
      'Alchemy: dashboard.alchemy.com → your app → API key → create a new key (or new app), then delete the old one.',
      'OpenRouter: openrouter.ai/keys → create a key → delete the old one.',
      'Supabase: project settings → API → rotate the service-role key (this signs out existing service clients).',
      'Other services (Veryfi, IDScan, RapidAPI, data.gov, CarsXE, HeritageDeed): create a new key in each dashboard and delete the old one.',
      'Wallet private keys cannot be rotated: create a new wallet and move funds to it if the old key was ever in those files.',
      'Paste each new key into "API keys" in this setup; each one is tested before it is saved.'] });

  add({ id: 'drive-env', title: 'Stop backup scripts from uploading .env to Drive',
    check: () => { const h = scriptsUploadingEnv(ctx.workspace); if (h === null) return { state: 'unknown', detail: 'no scripts/ folder found next to your .env' }; return h.length ? { state: 'todo', detail: 'uploads .env: ' + h.join(', ') } : { state: 'done', detail: 'no upload script includes .env' }; },
    steps: ['Open each file listed above at the line shown (for example: nano +26 scripts/upload-to-drive.mjs).', 'Delete the line that adds ".env" to the archive or file list.', 'Save. Run the step again here: it turns green when no upload script mentions .env.', 'Then delete the old backups that contain .env from Drive (chronos_workspace_backup_*.json.gz / *.tar.gz / chronos_backup_*.zip).'] });

  add({ id: 'quarantine', title: 'Quarantine scripts that report profit that is not real',
    check: () => { const s = findSuspects(ctx.workspace); return s.length ? { state: 'todo', detail: 'found: ' + s.join(', ') } : { state: 'done', detail: 'none found in your workspace' }; },
    steps: ['These scripts can print or record "profit" that never happened on-chain (see the earlier review).', 'Move them out of the way:', `mkdir -p ${path.join(ctx.workspace, '_quarantine')} && mv <file> ${path.join(ctx.workspace, '_quarantine')}/`, 'Nothing else in the console depends on them.'] });

  add({ id: 'gas', title: 'Calibrate gas from your real transactions',
    check: () => manual('gas'),
    steps: ['Choose "Run it now": the console reads your 3 confirmed swaps from verified_mainnet_actions.json and prints the real gas each one used.', 'A flash loan plus two swaps uses more gas than one swap, so keep GAS_UNITS_ASSUMED above the biggest number shown.', 'Mark this done when GAS_UNITS_ASSUMED reflects what you saw.'],
    run: () => ({ cmd: 'gas', args: (ctx.record && ctx.record.actions || []).filter((a) => a.isTx).map((a) => a.txHash) }) });

  add({ id: 'audit', title: 'Check src/registry.ts pools against the chain',
    check: () => manual('audit'),
    steps: ['Choose "Run it now" (or press a on the System tab of the dashboard).', 'Any MISMATCH means that pool is not what the registry says; fix or remove it in src/registry.ts.'],
    run: () => ({ cmd: 'audit', args: [] }) });

  add({ id: 'measure', title: 'First 60-minute measurement run',
    check: () => (fs.existsSync(path.join(DATA, 'measure_summary.json')) ? { state: 'done', detail: 'a measurement summary exists in data/' } : { state: 'todo', detail: 'not run yet' }),
    steps: ['Choose "Run it now" or run: chronos measure', 'Leave it running for the whole window (MEASURE_MINUTES). Ctrl-C ends early and still prints the summary.', 'NO-GO means nothing net-positive survived your guardrails. GO means a shadow test is worth building, not that profit is coming.'],
    run: () => ({ cmd: 'measure', args: [] }) });

  return A.map((a) => { let st; try { st = a.check(); } catch (e) { st = { state: 'unknown', detail: String(e.message).slice(0, 60) }; } return { ...a, ...st }; });
}
module.exports = { list, mark, scriptsUploadingEnv, findSuspects };
