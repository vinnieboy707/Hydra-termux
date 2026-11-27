'use strict';
// chronos autopilot: does every step that does not need you, in order, checks each one, and ends with a report
// of what came online and the short list of things only you can do. Safe to run again at any time.
// Read-only towards the chain: nothing here signs or sends a transaction.
const fs = require('fs');
const path = require('path');
const A = require('../tui/ansi.cjs');
const W = require('../tui/widgets.cjs');
const { T, paint } = A;
const live = require('./live.cjs');
const integrity = require('./integrity.cjs');
const E = require('./envfile.cjs');
const CAT = require('./catalog.cjs');
const IMP = require('./importer.cjs');
const CAP = require('./capabilities.cjs');
const DP = require('./drivepull.cjs');
const FIX = require('./fixers.cjs');
const ACT = require('./actions.cjs');
const sys = require('./system.cjs');
const SVC = require('./service.cjs');
const LS = require('./livestate.cjs');
const RZ = require('./realized.cjs');
const C = require('./chain.cjs');
const { loadConfig } = require('./config.cjs');
const { readRecord } = require('./record.cjs');
const { auditRegistry } = require('./audit.cjs');
const { runScan } = require('./scan.cjs');
const { redact } = require('./safety.cjs');
const { readThresholds } = require('./thresholds.cjs');

const DATA = live.DATA;
const DRIVE_SHARED = ['_.ENV SECRETS .txt', 'Passwords.docx', 'Computer Environment.docx', 'CoinbaseWalletBackups (folder: sharing a folder shares everything in it)'];
const timeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

async function runAutopilot({ service = true, drive = true, firstScan = true, out = process.stdout } = {}) {
  // the portal accepts data only from approved devices: say so if this one is not (5 s at most; offline is fine)
  let deviceTodo = null;
  const DV = require('./device.cjs');
  if (!fs.existsSync(DV.KEYFILE)) deviceTodo = 'Enroll this device for the portal: chronos device';
  else {
    try {
      const st = await Promise.race([DV.status(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000).unref())]);
      if (st.status !== 'approved') deviceTodo = `Approve this device in your portal → Devices (pairing code ${st.code}); until then the portal gets no data from it`;
    } catch (e) { deviceTodo = e.status === 403 && /unknown/.test(e.message) ? 'Enroll this device for the portal: chronos device' : 'Portal: device status unknown (offline?): chronos device'; }
  }
  const tty = !!out.isTTY;
  const say = (l = '') => out.write((tty ? l : A.strip(l)) + '\n');
  const steps = [];
  const icon = { ok: paint('✓', { fg: T.green, bold: true }), warn: paint('!', { fg: T.amber, bold: true }), fail: paint('✗', { fg: T.red, bold: true }), skip: paint('·', { fg: T.faint }) };
  const t0 = Date.now(); let tLast = t0;
  const rec = (name, status, detail = '') => {
    const now = Date.now(); const secs = ((now - tLast) / 1000).toFixed(1); tLast = now;
    steps.push({ name, status, detail: redact(detail), secs: Number(secs) });
    say(`  ${icon[status]} ${A.padEnd(paint(name, { fg: T.ink }), 30)} ${paint(redact(detail), { fg: status === 'fail' ? T.red : status === 'warn' ? T.amber : T.dim })}${paint(`  ${secs} s`, { fg: T.faint })}`);
  };
  const manual = [];
  let capsBefore = [], imp = null; // declared up front: the report at the end may run early
  say(''); say(paint('◆ CHRONOS autopilot', { fg: T.gold, bold: true }) + paint('   every step that does not need you · read-only towards the chain', { fg: T.dim })); say('');

  // 1. code integrity
  const iv = integrity.verify();
  if (!iv.ok) { rec('Code integrity', 'fail', iv.sealed ? `differs from the seal: ${[...iv.changed, ...iv.missing, ...iv.added].slice(0, 4).join(', ')}` : 'not sealed: run chronos seal'); return finish(); }
  rec('Code integrity', 'ok', `${iv.count} files${iv.depsSealed ? ` + ${iv.depsCount} libraries` : ''} match the seal`);
  if (iv.foreign && iv.foreign.length) rec('Folder contents', 'warn', `${iv.foreign.length} file(s) here are not part of this release: ${iv.foreign.slice(0, 3).join(', ')}${iv.foreign.length > 3 ? ' …' : ''} · chronos doctor shows how to move them out`);

  // 2. runtime
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) { rec('Node.js', 'fail', `version ${process.versions.node}; 18 or newer needed (pkg install nodejs-lts)`); return finish(); }
  rec('Node.js', 'ok', process.versions.node);

  // 3. .env
  const envFile = live.defaultEnvFile();
  const created = !fs.existsSync(envFile);
  if (created) E.save(E.load(envFile));
  const ws = live.workspaceDir(envFile);
  capsBefore = caps(envFile);
  rec('.env', 'ok', `${envFile}${created ? ' (created)' : ''}`);
  fs.chmodSync(envFile, 0o600);
  rec('.env permissions (S0)', 'ok', '600: readable by you only');

  // 4. pull env files from Drive (rclone) and 5. import keys found on this phone
  let pulled = null;
  if (drive) {
    say(paint('    pulling env files from Google Drive (only .env-style files, up to 4 minutes)…', { fg: T.faint }));
    try { pulled = await DP.pullEnvFiles({ folder: E.get(E.load(envFile), 'CHRONOS_DRIVE_ENV_FOLDER') }); } catch (e) { pulled = { ok: false, why: e.message, files: [] }; }
  } else rec('Drive env files', 'skip', 'skipped (--no-drive)');
  imp = await importKeys(envFile, ws, pulled && pulled.dir);
  // the Drive pull is only a source of keys: a problem with it is a warning only while a key is still missing
  if (pulled) {
    const needed = imp.failed.length > 0;
    if (pulled.skipped) rec('Drive env files', 'skip', pulled.why);
    else if (pulled.ok && !pulled.why) rec('Drive env files', 'ok', `${pulled.files.length} file(s) pulled to a private folder`);
    else rec('Drive env files', needed && !pulled.ok ? 'warn' : 'skip', `${pulled.files.length} file(s) pulled · ${pulled.why}${needed ? '' : ' · not needed now: every key Chronos uses is set'}`);
  }
  rec('Import keys', imp.imported.length || !imp.conflicts.length ? 'ok' : 'skip', `${imp.files} file(s) searched · ${imp.imported.length} imported${imp.kept.length ? ` · ${imp.kept.length} kept (your current value works; older copies ignored)` : ''}${imp.failed.length ? ` · ${imp.failed.length} not set and no working copy found (${imp.failed.join(', ')})` : ''}${imp.conflicts.length ? ` · ${imp.conflicts.length} with several working values: your choice` : ''}`);
  for (const x of imp.imported) say(paint(`      + ${x.key}  ${x.level}${x.exposed ? '  · was in a shared/Drive copy: rotate it' : ''}`, { fg: x.exposed ? T.amber : T.dim }));
  if (pulled && pulled.dir) { DP.cleanup(pulled.dir); rec('Drive copies removed', 'ok', 'the pulled files were deleted from this phone after import'); }

  // 6. settings
  const doc = E.load(envFile);
  const filled = [];
  for (const s of CAT.SETTINGS) { const v = E.get(doc, s.key); if (v === undefined || CAT.checkSetting(s, v)) { E.set(doc, s.key, s.suggest); filled.push(s.key); } }
  if (filled.length) {
    E.save(doc);
    let applied = {}; try { applied = JSON.parse(fs.readFileSync(path.join(DATA, 'defaults_applied.json'), 'utf8')); } catch (_) { /* first time */ }
    for (const k of filled) applied[k] = { value: CAT.SETTINGS.find((s) => s.key === k).suggest, at: new Date().toISOString() };
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(path.join(DATA, 'defaults_applied.json'), JSON.stringify(applied, null, 2));
  }
  rec('Settings', 'ok', filled.length ? `${filled.length} missing value(s) set to suggested starting values (review in chronos setup)` : 'all present');

  // 7. stop .env uploads to Drive  8. quarantine fake-profit scripts
  const fx = FIX.fixUploadScripts(ws);
  if (!fx.length) rec('Backup scripts', 'ok', 'no script uploads .env to Drive');
  for (const f of fx) rec('Backup scripts', f.ok ? 'ok' : 'warn', `${f.file}: ${f.msg}`);
  if (fx.some((f) => f.ok)) manual.push('Delete the old Drive backups that contain .env (chronos_workspace_backup_*.json.gz / *.tar.gz / chronos_backup_*.zip) once you have a fresh backup without it.');
  const q = FIX.quarantineSuspects(ws);
  rec('Fake-profit scripts', 'ok', q.length ? q.map((x) => `${x.file} → _quarantine`).join(', ') : 'none in your workspace');

  // 9. start the engine now, so it boots and runs its first scan while the checks below run
  const cfg = loadConfig(envFile);
  let svcOk = false;
  if (service) {
    try {
      const r = SVC.install({ envFile });
      if (!r.ok) rec('Background engine', 'warn', r.steps[0].msg);
      else { svcOk = true; for (const st of r.steps) rec('Background engine', st.ok ? 'ok' : 'warn', st.msg); }
    } catch (e) { rec('Background engine', 'fail', e.message.split('\n')[0]); }
  } else rec('Background engine', 'skip', 'skipped (--no-service)');

  // 10. node
  const nodes = await sys.probeNodes(envFile);
  const goodNode = nodes.find((n) => n.ok);
  if (!nodes.length) rec('Arbitrum node', 'fail', 'no RPC url in .env: run chronos setup and paste ARB_RPC_URL');
  else if (!goodNode) rec('Arbitrum node', 'fail', nodes.map((n) => `${n.key}: ${n.detail}`).join(' · '));
  else rec('Arbitrum node', 'ok', `${goodNode.key} · block ${goodNode.block} · ${goodNode.ms} ms${nodes.length > 1 ? ` · ${nodes.filter((n) => n.ok).length}/${nodes.length} nodes answer` : ''}`);
  if (cfg.problems.length) rec('Scanner settings', 'fail', cfg.problems.map((p) => p.split(' ')[0]).join(', '));

  let provider = null;
  if (goodNode && !cfg.problems.length) { try { provider = await C.connect(cfg); } catch (e) { rec('Connect', 'fail', e.shortMessage || e.message); } }

  // 11-13. registry audit, gas calibration and realized profit are independent: run them together
  const record = readRecord(ws);
  if (provider) {
    say(paint('    checking registry, gas and receipts in parallel…', { fg: T.faint }));
    const audit = async () => {
      const regFile = path.join(ws, 'src', 'registry.ts');
      if (!fs.existsSync(regFile)) return ['Registry audit', 'skip', 'no src/registry.ts next to your .env'];
      try {
        const venues = JSON.parse(fs.readFileSync(process.env.CHRONOS_VENUES_FILE || path.join(live.ROOT, 'venues.json'), 'utf8')).venues;
        const ar = await timeout(auditRegistry(provider, regFile, venues), 90000, 'registry audit');
        fs.writeFileSync(path.join(DATA, 'registry_audit.json'), JSON.stringify({ at: new Date().toISOString(), results: ar }, null, 2));
        const bad = ar.filter((x) => x.problems.length); const skipped = ar.filter((x) => x.skipped).length; const cased = ar.filter((x) => (x.notes || []).length).length;
        if (bad.length) manual.push(`Fix or remove the ${bad.length} mismatched pool(s) in src/registry.ts: chronos audit shows the right address for each it can look up, and chronos audit --fix writes src/registry.corrected.ts (your file is never changed).`);
        ACT.mark('audit', true);
        return ['Registry audit', bad.length ? 'warn' : 'ok', `${ar.length - skipped} pool(s) checked · ${bad.length} mismatch(es)${skipped ? ` · ${skipped} entr${skipped === 1 ? 'y' : 'ies'} with no literal address skipped` : ''}${cased ? ` · ${cased} with wrong checksum casing (read anyway; correct form in chronos audit)` : ''}${bad.length ? ': ' + bad.map((x) => `${x.claim.exchange} ${x.claim.pair}: ${x.problems[0]}${x.suggest && x.suggest.address ? ` → the right pool is ${x.suggest.address}` : ''}`).slice(0, 3).join(' | ') : ''}`];
      } catch (e) { return ['Registry audit', 'warn', e.shortMessage || e.message]; }
    };
    const gasCal = async () => {
      const hashes = (record.actions || []).filter((a) => a.isTx).map((a) => a.txHash);
      if (!hashes.length) return ['Gas calibration', 'skip', 'no confirmed transactions in verified_mainnet_actions.json yet'];
      const got = await Promise.all(hashes.map(async (h) => { try { const r = await provider.getTransactionReceipt(h); return r ? { tx: h.slice(0, 10), gasUsed: Number(r.gasUsed), gasPriceGwei: Number(r.gasPrice) / 1e9, status: r.status } : null; } catch (_) { return null; } }));
      const gas = got.filter(Boolean);
      fs.writeFileSync(path.join(DATA, 'gas_calibration.json'), JSON.stringify({ at: new Date().toISOString(), transactions: gas }, null, 2));
      if (!gas.length) return ['Gas calibration', 'skip', `none of the ${hashes.length} recorded transaction(s) were found on this chain`];
      const max = Math.max(0, ...gas.map((g) => g.gasUsed));
      const assumed = Number(E.get(E.load(envFile), 'GAS_UNITS_ASSUMED'));
      const floor = Math.ceil((2 * max) / 10000) * 10000; // a flash loan plus two swaps costs at least two swaps
      let detail = `${gas.length} real swap(s): biggest used ${max.toLocaleString('en-US')} gas`;
      let status = 'ok';
      if (max && assumed < floor) {
        let applied = {}; try { applied = JSON.parse(fs.readFileSync(path.join(DATA, 'defaults_applied.json'), 'utf8')); } catch (_) { /* none */ }
        if (applied.GAS_UNITS_ASSUMED) { const d = E.load(envFile); E.set(d, 'GAS_UNITS_ASSUMED', String(floor)); E.save(d); applied.GAS_UNITS_ASSUMED = { value: String(floor), at: new Date().toISOString(), why: 'raised to 2 × your biggest real swap' }; fs.writeFileSync(path.join(DATA, 'defaults_applied.json'), JSON.stringify(applied, null, 2)); detail += ` · GAS_UNITS_ASSUMED raised to ${floor}`; if (svcOk) SVC.restartIfRunning(); }
        else { status = 'warn'; detail += ` · your GAS_UNITS_ASSUMED (${assumed}) is below 2 × that (${floor}); consider raising it`; }
      } else if (max) detail += ` · GAS_UNITS_ASSUMED ${assumed} covers 2 ×`;
      ACT.mark('gas', true);
      return ['Gas calibration', status, detail];
    };
    const realized = async () => {
      const contract = RZ.contractFrom((k) => E.get(E.load(envFile), k));
      if (!contract) return ['Realized profit', 'skip', 'no Chronos contract yet (CHRONOS_FLASH_ARB_ADDRESS): chronos mainnet'];
      try {
        const aave = await timeout(C.readAave(provider, C.limiter(4), process.env.CHRONOS_AAVE_POOL || C.AAVE_POOL), 90000, 'price read');
        const rz = await RZ.verifyRealized({ provider, contract: contract.address, hashes: RZ.candidateHashes(record, DATA), assets: aave.assets, wethAddress: live.WETH, taxBps: readThresholds(envFile).taxBps });
        return ['Realized profit', rz.profiting ? 'ok' : 'skip', rz.executions.length ? `$${rz.totalNetUsd.toFixed(2)} net after gas · ${rz.executions.length} verified execution(s)` : `${rz.checked} transaction(s) checked on ${contract.key}: no Arbitrage events yet`];
      } catch (e) { return ['Realized profit', 'warn', e.message]; }
    };
    for (const r of await Promise.all([audit(), gasCal(), realized()])) rec(...r);
  }

  // 14. first scan
  if (firstScan && provider && !cfg.problems.length) {
    say(paint('    waiting for the first scan…', { fg: T.faint }));
    let res = null;
    if (svcOk) {
      const until = Date.now() + 180000;
      while (Date.now() < until && !res) { const s = LS.read(DATA); if (s.ok && s.state.res && s.state.lastScanAt > Date.now() - 300000) res = s.state.res; else await new Promise((r) => setTimeout(r, 2000)); }
      if (!res) { const s = LS.read(DATA); rec('First scan', 'warn', s.ok ? `engine is ${s.state.phase}${s.state.error ? ': ' + s.state.error : ''}` : 'no engine state yet; check: chronos service logs'); }
    } else {
      try { const st = await timeout(live.init(cfg), 180000, 'start-up'); res = await timeout(runScan(cfg, await live.snapshot(cfg, st)), 180000, 'scan'); } catch (e) { rec('First scan', 'warn', e.shortMessage || e.message); }
    }
    if (res) rec('First scan', 'ok', `block ${res.blockNumber} · ${res.marketsFound} pools · ${res.routesEnumerated} routes · ${res.approved} passed every guardrail · best net ${res.candidates[0] ? '$' + res.candidates[0].netUsd.toFixed(2) : '—'}${res.rpc ? ` · ${res.rpc.calls} calls in ${res.rpc.requests} requests` : ''}`);
  }
  return finish();

  function finish() {
    const ok = !steps.some((s) => s.status === 'fail');
    const after = fs.existsSync(path.join(DATA)) ? caps(live.defaultEnvFile()) : [];
    const before = new Set(capsBefore.filter((c) => c.awake).map((c) => c.name));
    const woke = after.filter((c) => c.awake && !before.has(c.name));
    say('');
    const svcNow = SVC.status();
    const where = (c) => (/^24\/7/.test(c.name) && !(svcNow.installed && svcNow.status === 'online') ? ['ready · start it with: chronos service install', T.amber] : c.built ? ['live in this console', T.green] : [`ready for ${c.where}`, T.blue]);
    if (woke.length) { say(paint(`◆ ${woke.length} capabilit${woke.length === 1 ? 'y' : 'ies'} came online`, { fg: T.green, bold: true })); for (const c of woke) { const [t, col] = where(c); say(`   ${A.padEnd(paint('✓ ' + c.name, { fg: T.ink }), 44)} ${paint(t, { fg: col })}`); } say(''); }
    // what only you can do
    const envNow = live.defaultEnvFile();
    const d = fs.existsSync(envNow) ? E.load(envNow) : { lines: [] };
    const missing = CAT.SECRETS.filter((s) => !E.get(d, s.key)).map((s) => s.key);
    const todo = [];
    todo.push(`Restrict link sharing on ${DRIVE_SHARED.length} Drive items (drive.google.com → search the name → Share → General access → Restricted): ${DRIVE_SHARED.join('; ')}. The connected Drive tools cannot remove sharing, only add it.`);
    if (imp && imp.exposed.length) todo.push(`Rotate these keys (they were in a shared file or a Drive copy): ${imp.exposed.join(', ')}. Then paste the new ones in chronos setup.`);
    else todo.push('Rotate any key that was in "_.ENV SECRETS .txt" (it was link-shared). Paste the new ones in chronos setup.');
    if (imp && imp.conflicts.length) todo.push(`Choose between several working values found for: ${imp.conflicts.join(', ')} (chronos setup → Import).`);
    if (!['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'].some((k) => E.get(d, k))) todo.unshift('Paste an Arbitrum RPC url (chronos setup → Ask me only for the missing keys): nothing can scan without one.');
    if (missing.length) todo.push(`${missing.length} optional key(s) not set (only needed for those services): chronos setup → "Ask me only for the missing keys".`);
    const s = SVC.status();
    if (service && !s.pm2) todo.push('Install PM2 for the background engine: npm install -g pm2   then: chronos service install');
    if (service && s.pm2 && !s.bootAppReady) todo.push('For start at phone boot: install Termux:Boot from F-Droid, open it once, then run: chronos service install');
    if (!require('./notify.cjs').onPath('termux-notification')) todo.push('For phone alerts: install the Termux:API app (F-Droid) and run: pkg install termux-api   (or set CHRONOS_WEBHOOK_URL)');
    // the path to profit, in order (README → Start here)
    const addr = (k) => /^0x[0-9a-fA-F]{40}$/.test(E.get(d, k) || '');
    if (!addr('CHRONOS_FLASH_ARB_ADDRESS')) todo.unshift('Deploy your contract and set it up: chronos deploy   (shows every cost first; nothing is sent until you type YES)');
    else if (!addr('CHRONOS_EXECUTOR_ADDRESS')) todo.unshift('Start the cloud engine: chronos cloud-pack, upload it with chronos-console.tgz to Google Cloud Shell, run gcp-setup.sh, then chronos set CHRONOS_EXECUTOR_ADDRESS 0x… and chronos deploy (README → Start here, steps 3–5)');
    if (deviceTodo) todo.push(deviceTodo);
    todo.push(...manual);
    say(paint('Only you can do these', { fg: T.gold, bold: true }));
    todo.forEach((t, i) => A.wrap(t, Math.min(100, (out.columns || 100) - 8)).forEach((l, k) => say((k ? '      ' : `  ${i + 1}.  `) + paint(l, { fg: T.text }))));
    say('');
    const total = ((Date.now() - t0) / 1000).toFixed(1);
    const counts = ['ok', 'warn', 'fail', 'skip'].map((k) => steps.filter((x) => x.status === k).length);
    say(W.meter(counts[0], steps.length, 30, { invert: true }) + paint(`  ${counts[0]} done · ${counts[1]} to review · ${counts[2]} failed · ${counts[3]} skipped · ${total} s`, { fg: T.text }));
    say(ok ? paint('Autopilot finished. Open the dashboard: chronos', { fg: T.green, bold: true }) : paint('Autopilot stopped on a ✗ above. Fix it, then run: chronos autopilot', { fg: T.red, bold: true }));
    try {
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(path.join(DATA, 'autopilot_report.txt'), [`chronos autopilot ${new Date().toISOString()}`, '', ...steps.map((x) => `${x.status.toUpperCase().padEnd(5)} ${x.name.padEnd(28)} ${x.detail}`), '', 'came online: ' + (woke.map((c) => c.name).join(', ') || 'nothing new'), '', 'only you can do these:', ...todo.map((t, i) => `${i + 1}. ${t}`)].join('\n') + '\n', { mode: 0o600 });
    } catch (_) { /* report file is optional */ }
    return { ok, steps, woke: woke.map((c) => c.name), todo };
  }
}

function caps(envFile) {
  const doc = fs.existsSync(envFile) ? E.load(envFile) : { lines: [] };
  const complete = fs.existsSync(envFile) && loadConfig(envFile).problems.length === 0;
  return CAP.evaluate((k) => E.get(doc, k), complete);
}

/** Import every key that has exactly one value on this phone and passes its test. Conflicts are left for you. */
async function importKeys(envFile, ws, extraDir) {
  const wanted = CAT.SECRETS.map((s) => s.key);
  const from = String(process.env.CHRONOS_IMPORT_FROM || '').split(',').map((s) => s.trim()).filter(Boolean); // your own folders or files, e.g. a workspace copied from elsewhere
  const { files, result } = IMP.scan(wanted, { exclude: [envFile], extra: [path.join(ws, 'gdrive_sync'), ...(extraDir ? [extraDir] : []), ...from] });
  const imported = [], failed = [], conflicts = [], kept = [], exposed = new Set();
  for (const item of CAT.SECRETS) {
    const found = result[item.key]; if (!found) continue;
    const doc = E.load(envFile);
    const cur = E.get(doc, item.key);
    const fromShared = found.some((f) => f.sources.some((s) => /ENV SECRETS|drive_pull_|gdrive|env_sources/i.test(s)));
    const distinct = found.filter((f) => f.value !== cur);
    const test = async (v) => { if (E.checkValue(v)) return { ok: false }; try { return await item.test(v); } catch (_) { return { ok: false }; } };
    if (cur) {
      if (item.secret && found.some((f) => f.value === cur && f.sources.some((s) => /ENV SECRETS|drive_pull_/i.test(s)))) exposed.add(item.key);
      // the value already in your .env wins while it passes its test: other copies are older and are ignored (not asked)
      if (!distinct.length || (await test(cur)).ok) { if (distinct.length) kept.push(item.key); continue; }
    }
    // no working value yet: test every copy found; exactly one that works is taken, several that work are yours to pick
    const works = []; for (const f of distinct) { const r = await test(f.value); if (r.ok) works.push({ f, r }); }
    if (!works.length) { failed.push(item.key); continue; }
    if (works.length > 1) { conflicts.push(item.key); continue; }
    const cand = works[0].f; const r = works[0].r;
    E.set(doc, item.key, r.normalized || cand.value); E.save(doc);
    const isExposed = item.secret && (fromShared || cand.fromDrive);
    if (isExposed) exposed.add(item.key);
    imported.push({ key: item.key, level: r.level === 'verified' ? 'verified live' : 'format checked', exposed: isExposed });
  }
  return { files: files.length, imported, failed, conflicts, kept, exposed: [...exposed] };
}

module.exports = { runAutopilot, importKeys, DRIVE_SHARED };
