'use strict';
// chronos setup — guided, interactive setup in the terminal.
// Paste API keys (masked, tested before saving), fill settings, set policy values and wallet addresses,
// and work through the checklist of actions only you can do. Every save backs up your .env first and
// keeps it at permissions 600. Secret values are never shown: only the last 4 characters.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const A = require('./ansi.cjs');
const { T, paint } = A;
const P = require('./prompt.cjs');
const E = require('../lib/envfile.cjs');
const C = require('../lib/catalog.cjs');
const ACT = require('../lib/actions.cjs');
const live = require('../lib/live.cjs');
const { readRecord } = require('../lib/record.cjs');
const { redact } = require('../lib/safety.cjs');
const IMP = require('../lib/importer.cjs');
const CAP = require('../lib/capabilities.cjs');
const { loadConfig } = require('../lib/config.cjs');

const out = process.stdout;
const label = (s) => paint(s, { fg: T.dim });
const ok = (s) => paint('✓ ' + s, { fg: T.green });
const bad = (s) => paint('✗ ' + s, { fg: T.red });
const warn = (s) => paint('! ' + s, { fg: T.amber });
const verifiedThisSession = new Map();

function screen(crumb, lines = []) {
  P.release();
  out.write('\x1b[2J\x1b[H');
  out.write(paint(' ◆ CHRONOS', { fg: T.gold, bold: true }) + paint('  setup', { fg: T.dim }) + (crumb ? paint('  ›  ' + crumb, { fg: T.text }) : '') + '\n');
  out.write(paint('─'.repeat(Math.min(out.columns || 80, 100)), { fg: T.line }) + '\n');
  const w = Math.max(40, (out.columns || 80) - 1);
  for (const l of lines) out.write(A.truncate(l, w) + '\n');
  if (lines.length) out.write('\n');
}

function chooseEnvFile() {
  const found = live.findEnvFile();
  if (found) return found;
  const ws = path.join(os.homedir(), 'workspaces', 'chronos-master-workspace');
  return fs.existsSync(ws) ? path.join(ws, '.env') : path.join(live.ROOT, '..', '.env');
}

function saveWith(doc, key, value, note) {
  E.set(doc, key, value);
  const { backup } = E.save(doc);
  out.write(ok(`saved ${key}${note ? ' · ' + note : ''}`) + '\n' + label(`  .env is 600 · ${backup ? 'previous version kept as ' + path.basename(backup) : 'new file created'}`) + '\n');
}

// ------------------------------------------------------------------ keys
async function keyScreen(ctx, item) {
  for (;;) {
    const doc = E.load(ctx.envFile);
    const cur = E.get(doc, item.key);
    const ver = verifiedThisSession.get(item.key);
    screen(`API keys › ${item.key}`, [
      paint(item.key, { fg: T.ink, bold: true }) + label(`   ${item.group}`),
      label(item.what),
      '',
      cur ? ok(`set ${item.secret ? E.mask(cur) : cur}`) + (ver ? label(`   ${ver}`) : '') : warn('not set'),
      item.secret ? label('Secret: what you paste shows as dots and is never displayed, logged or sent anywhere except the test below.') : label('Not secret: shown as typed.'),
    ]);
    const choice = await P.select('What do you want to do?', [
      { label: cur ? 'Replace it' : (item.secret ? 'Paste it' : 'Enter it'), value: 'set' },
      ...(cur ? [{ label: 'Test the saved value', value: 'test' }, { label: 'Remove it from .env', value: 'rm', color: T.red }] : []),
      { label: 'Back', value: null },
    ]);
    if (!choice) return;
    if (choice === 'rm') {
      if (await P.confirm(`Remove ${item.key} from .env? A backup is kept.`)) { E.unset(doc, item.key); const { backup } = E.save(doc); out.write(ok('removed') + label(`  backup ${backup ? path.basename(backup) : '—'}`) + '\n'); await P.pause(); }
      continue;
    }
    let value = cur;
    if (choice === 'set') {
      value = item.secret ? await P.secret(`Paste ${item.key}`, 'tip: long-press in Termux → Paste') : await P.input(`Enter ${item.key}`, { def: cur || '', check: (v) => E.checkValue(v) });
      if (!value) continue;
      const shape = E.checkValue(value);
      if (shape) { out.write(bad(shape) + '\n'); await P.pause(); continue; }
      out.write(label(`  received ${[...value].length} characters${item.secret ? ', ending …' + value.slice(-4) : ''}`) + '\n');
    }
    out.write(paint('  testing…', { fg: T.gold }) + '\n');
    let res;
    try { res = await item.test(value); } catch (e) { res = { ok: false, msg: redact(e.message) }; }
    out.write((res.ok ? (res.level === 'verified' ? ok(res.msg) : warn(res.msg)) : bad(res.msg)) + '\n');
    if (res.ok) verifiedThisSession.set(item.key, res.level === 'verified' ? 'verified ' + new Date().toLocaleTimeString('en-US', { hour12: false }) : 'format checked');
    if (choice === 'set') {
      const go = res.ok ? true : await P.confirm('The check failed. Save it anyway?', false);
      if (go) saveWith(doc, item.key, res.normalized || value, res.ok ? res.level : 'saved despite failed check');
      else out.write(label('  not saved') + '\n');
    }
    await P.pause();
  }
}

async function keysMenu(ctx) {
  let idx = 0;
  for (;;) {
    const doc = E.load(ctx.envFile);
    const items = C.SECRETS.filter((s) => !s.group.startsWith('Wallet')).map((s) => {
      const v = E.get(doc, s.key); const ver = verifiedThisSession.get(s.key);
      return { label: s.key, value: s, hint: v ? `✓ ${s.secret ? E.mask(v) : A.truncate(v, 18)}${ver ? '  ' + ver : ''}` : '· not set', hintColor: v ? T.green : T.faint };
    });
    items.push({ label: 'Signing keys (never handled here)', value: 'signing', color: T.dim });
    items.push({ label: 'Back', value: null });
    screen('API keys');
    const pick = await P.select('API keys and connections', items, { index: idx, subtitle: 'Choose a key to paste, test or remove. Only the last 4 characters of a secret are ever shown.' });
    if (!pick) return;
    idx = items.findIndex((x) => x.value === pick);
    if (pick === 'signing') {
      screen('API keys › signing keys', [
        paint('Wallet private keys', { fg: T.ink, bold: true }),
        label('Setup never asks for or shows a signing key. Trades are signed by your Google Cloud HSM key; chronos deploy asks for your owner key once, hidden, and never stores it.'),
        '',
        ...C.SIGNING_KEYS.map((k) => (E.get(doc, k) ? warn(`${k} is present in .env`) : label(`· ${k} not present`))),
        '',
        label('Advice: keep signing keys in as few places as possible. Never paste them into a chat, a shared file or a Drive backup.'),
        label('If one was ever in "_.ENV SECRETS .txt" or an uploaded backup, see the checklist item "Rotate keys".'),
      ]);
      await P.pause();
      continue;
    }
    await keyScreen(ctx, pick);
  }
}

// ------------------------------------------------------------------ capabilities
function capState(ctx) {
  const doc = E.load(ctx.envFile);
  const complete = fs.existsSync(ctx.envFile) && loadConfig(ctx.envFile).problems.length === 0;
  return CAP.evaluate((k) => E.get(doc, k), complete);
}
const awakeSet = (ctx) => new Set(capState(ctx).filter((c) => c.awake).map((c) => c.name));

async function showAwoken(ctx, before, heading) {
  const now = capState(ctx);
  const fresh = now.filter((c) => c.awake && !before.has(c.name));
  const lines = [];
  if (fresh.length) {
    lines.push(paint(`${fresh.length} capabilit${fresh.length === 1 ? 'y' : 'ies'} just came online`, { fg: T.green, bold: true }), '');
    for (const c of fresh) {
      const lv = (c.all || c.any || []).map((k) => verifiedThisSession.get(k)).filter(Boolean);
      lines.push(paint('◆ ' + c.name, { fg: T.ink, bold: true }) + (c.built ? paint('   live in this console', { fg: T.green }) : paint(`   ready for ${c.where}`, { fg: T.blue })) + (lv.length ? label(`   (${lv.some((x) => /verified/.test(x)) ? 'key verified live' : 'key format checked'})`) : ''));
      lines.push('   ' + label(c.unlocks));
      if (c.next) lines.push('   ' + paint('next: ' + c.next, { fg: T.gold }));
    }
  } else lines.push(label('No new capabilities from this step.'));
  const asleep = now.filter((c) => !c.awake);
  if (asleep.length) {
    lines.push('', paint('Still offline', { fg: T.ink, bold: true }));
    for (const c of asleep.slice(0, 10)) lines.push(`   ${A.padEnd(paint(c.name, { fg: T.text }), 40)} ${label('needs ' + c.missing.join(', '))}`);
    if (asleep.length > 10) lines.push(label(`   …and ${asleep.length - 10} more (Review shows all)`));
  }
  lines.push('', label('"live in this console" = usable right now here. "ready for" = the key is in place for your own service; that service is not run by this console.'));
  screen(heading || 'Capabilities', lines);
  await P.pause();
  for (const c of fresh) ctx.awokenThisSession.add(c.name);
}

// ------------------------------------------------------------------ import + ask for missing
const tilde = (p) => p.replace(os.homedir(), '~');
async function importKeys(ctx) {
  const before = awakeSet(ctx);
  screen('Import keys', [paint('Looking for keys in env files on this phone…', { fg: T.gold })]);
  const wanted = C.SECRETS.map((s) => s.key);
  const { files, result } = IMP.scan(wanted, { exclude: [ctx.envFile], extra: [path.join(ctx.workspace, 'gdrive_sync')] });
  const doc = E.load(ctx.envFile);
  const rows = []; const plan = []; const conflicts = [];
  for (const item of C.SECRETS) {
    const found = result[item.key]; if (!found) continue;
    const cur = E.get(doc, item.key);
    const distinct = found.filter((f) => f.value !== cur);
    if (!distinct.length) { rows.push(`  ${ok(A.padEnd(item.key, 26))} ${label('already in your .env (same value)')}`); continue; }
    if (cur) { rows.push(`  ${warn(A.padEnd(item.key, 26))} ${label(`your .env has a different value; found ${distinct.length} other`)}`); conflicts.push({ item, found: distinct, cur }); continue; }
    if (distinct.length === 1) { plan.push({ item, cand: distinct[0] }); rows.push(`  ${paint('+ ' + A.padEnd(item.key, 26), { fg: T.gold })} ${label('in ' + distinct[0].sources.map(tilde).slice(0, 2).join(', '))}${distinct[0].fromDrive && item.secret ? paint('  Drive copy', { fg: T.amber }) : ''}`); }
    else { conflicts.push({ item, found: distinct, cur }); rows.push(`  ${warn(A.padEnd(item.key, 26))} ${label(`${distinct.length} different values found`)}`); }
  }
  screen('Import keys', [
    paint(`Searched ${files.length} env-style file${files.length === 1 ? '' : 's'} on this phone`, { fg: T.ink, bold: true }),
    ...files.slice(0, 8).map((f) => label('  ' + tilde(f))), ...(files.length > 8 ? [label(`  …and ${files.length - 8} more`)] : []),
    '', ...(rows.length ? rows : [label('  no known keys found in those files')]),
    '', label('Values are not shown. Each key is tested before it is saved; anything that fails is left out and you are asked about it.'),
  ]);
  if (!plan.length && !conflicts.length) { await P.pause(); return; }
  if (plan.length && await P.confirm(`Test and import ${plan.length} key${plan.length === 1 ? '' : 's'} now?`, true)) {
    for (const { item, cand } of plan) {
      out.write(paint(`  ${A.padEnd(item.key, 26)} `, { fg: T.text }));
      let r; try { r = await item.test(cand.value); } catch (e) { r = { ok: false, msg: redact(e.message) }; }
      if (r.ok && !E.checkValue(cand.value)) {
        const d = E.load(ctx.envFile); E.set(d, item.key, r.normalized || cand.value); E.save(d);
        verifiedThisSession.set(item.key, r.level === 'verified' ? 'verified' : 'format checked');
        out.write((r.level === 'verified' ? ok('imported · verified') : warn('imported · format only')) + (cand.fromDrive && item.secret ? paint('  · came from a Drive copy: rotate it (checklist)', { fg: T.amber }) : '') + '\n');
      } else out.write(bad('not imported · ' + (r.msg || 'invalid characters')) + '\n');
    }
    out.write(label(`  .env saved at 600 with a backup of the previous version`) + '\n');
    await P.pause();
  }
  for (const c of conflicts) {
    screen('Import keys › choose', [paint(c.item.key, { fg: T.ink, bold: true }), label(c.item.what), label('Several values exist. Pick one by where it came from (only the last 4 characters are shown).')]);
    const pick = await P.select(`Which ${c.item.key} should be used?`, [
      ...(c.cur ? [{ label: `keep the one in your .env  ${E.mask(c.cur)}`, value: 'keep' }] : []),
      ...c.found.map((f, i) => ({ label: `${E.mask(f.value)}  from ${tilde(f.sources[0])}${f.sources.length > 1 ? ` (+${f.sources.length - 1})` : ''}`, value: i, hint: f.fromDrive ? 'Drive copy' : '' })),
      { label: 'skip', value: null },
    ]);
    if (pick === null || pick === 'keep') continue;
    const f = c.found[pick];
    let r; try { r = await c.item.test(f.value); } catch (e) { r = { ok: false, msg: redact(e.message) }; }
    out.write((r.ok ? ok(r.msg) : bad(r.msg)) + '\n');
    if (r.ok || await P.confirm('The check failed. Save it anyway?', false)) { saveWith(E.load(ctx.envFile), c.item.key, r.normalized || f.value, r.ok ? r.level : 'unverified'); if (r.ok) verifiedThisSession.set(c.item.key, r.level); }
    await P.pause();
  }
  await showAwoken(ctx, before, 'Import keys › what came online');
}

async function askMissing(ctx) {
  const before = awakeSet(ctx);
  const doc = E.load(ctx.envFile);
  const missing = C.SECRETS.filter((s) => !E.get(doc, s.key));
  if (!missing.length) { screen('Missing keys', [ok('Every known key is already set.')]); await P.pause(); return; }
  screen('Missing keys', [paint(`${missing.length} key${missing.length === 1 ? '' : 's'} still missing`, { fg: T.ink, bold: true }), label('You will be asked for each one. Press esc to skip any you do not use. Each value is tested before saving.'), '', ...missing.map((m) => '  · ' + paint(m.key, { fg: T.text }) + label('  ' + m.what))]);
  if (!(await P.confirm('Start?', true))) return;
  let n = 0;
  for (const item of missing) {
    screen(`Missing keys › ${++n} of ${missing.length}`, [paint(item.key, { fg: T.ink, bold: true }) + label('   ' + item.group), label(item.what)]);
    const v = item.secret ? await P.secret(`Paste ${item.key}`, 'esc skips this one') : await P.input(`Enter ${item.key}`, { hint: 'esc skips this one', check: (x) => E.checkValue(x) });
    if (!v) { out.write(label('  skipped') + '\n'); continue; }
    const shape = E.checkValue(v); if (shape) { out.write(bad(shape) + '\n'); await P.pause(); continue; }
    out.write(paint('  testing…', { fg: T.gold }) + '\n');
    let r; try { r = await item.test(v); } catch (e) { r = { ok: false, msg: redact(e.message) }; }
    out.write((r.ok ? (r.level === 'verified' ? ok(r.msg) : warn(r.msg)) : bad(r.msg)) + '\n');
    if (r.ok || await P.confirm('The check failed. Save it anyway?', false)) { saveWith(E.load(ctx.envFile), item.key, r.normalized || v, r.ok ? r.level : 'unverified'); if (r.ok) verifiedThisSession.set(item.key, r.level === 'verified' ? 'verified' : 'format checked'); }
    await P.pause('enter for the next key');
  }
  await showAwoken(ctx, before, 'Missing keys › what came online');
}

async function capabilitiesView(ctx) {
  const now = capState(ctx);
  const lines = [];
  for (const c of now) lines.push((c.awake ? ok('') : paint('○ ', { fg: T.faint })) + A.padEnd(paint(c.name, { fg: c.awake ? T.ink : T.dim }), 42) + (c.awake ? (c.built ? paint('live here', { fg: T.green }) : paint('ready · ' + c.where, { fg: T.blue })) : label('needs ' + c.missing.join(', '))));
  screen('Capabilities', [paint(`${now.filter((c) => c.awake).length} of ${now.length} online`, { fg: T.ink, bold: true }), '', ...lines]);
  await P.pause();
}

// ------------------------------------------------------------------ settings
async function settingsMenu(ctx, groups, crumb) {
  let idx = 0;
  for (;;) {
    const doc = E.load(ctx.envFile);
    const list = C.SETTINGS.filter((s) => groups.includes(s.group));
    const missing = list.filter((s) => E.get(doc, s.key) === undefined || C.checkSetting(s, E.get(doc, s.key)));
    const items = [];
    if (missing.length) items.push({ label: `Fill ${missing.length} missing setting${missing.length === 1 ? '' : 's'} with the suggested values`, value: 'fill', color: T.gold });
    for (const s of list) {
      const v = E.get(doc, s.key); const err = v !== undefined ? C.checkSetting(s, v) : 'missing';
      items.push({ label: s.key, value: s, hint: err ? (v === undefined ? '· missing' : `✗ ${err}`) : `✓ ${v}`, hintColor: err ? T.red : T.green });
    }
    items.push({ label: 'Back', value: null });
    screen(crumb);
    const pick = await P.select(crumb, items, { index: idx, subtitle: 'Every number the scanner uses comes from here. Suggested values are starting points, not advice.' });
    if (!pick) return;
    idx = items.findIndex((x) => x.value === pick);
    if (pick === 'fill') {
      screen(`${crumb} › fill missing`, missing.map((s) => `  ${A.padEnd(paint(s.key, { fg: T.ink }), 26)} ${paint(s.suggest, { fg: T.gold })}  ${label(s.what)}`));
      if (await P.confirm(`Write these ${missing.length} values to .env?`, true)) {
        for (const s of missing) E.set(doc, s.key, s.suggest);
        const { backup } = E.save(doc);
        out.write(ok(`saved ${missing.length} settings`) + label(`  backup ${backup ? path.basename(backup) : 'new file'}`) + '\n');
      }
      await P.pause();
      continue;
    }
    const cur = E.get(doc, pick.key);
    screen(`${crumb} › ${pick.key}`, [paint(pick.key, { fg: T.ink, bold: true }), label(pick.what), label(`allowed: ${pick.list ? 'comma list of ' : ''}${pick.int ? 'whole ' : ''}numbers from ${pick.min} to ${pick.max} · suggested ${pick.suggest}`)]);
    const v = await P.input(`New value for ${pick.key}`, { def: cur !== undefined ? cur : pick.suggest, check: (x) => C.checkSetting(pick, x) || E.checkValue(x) });
    if (v === null) continue;
    saveWith(doc, pick.key, pick.list ? v.split(',').map((x) => x.trim()).join(',') : v);
    await P.pause();
  }
}

async function walletsMenu(ctx) {
  let idx = 0;
  for (;;) {
    const doc = E.load(ctx.envFile);
    const list = C.SECRETS.filter((s) => s.group.startsWith('Wallet'));
    const items = list.map((s) => { const v = E.get(doc, s.key); return { label: s.key, value: s, hint: v ? `✓ ${v.slice(0, 6)}…${v.slice(-4)}` : '· not set', hintColor: v ? T.green : T.faint }; });
    items.push({ label: 'Back', value: null });
    screen('Wallet addresses');
    const pick = await P.select('Wallet addresses (public, checksum-verified)', items, { index: idx });
    if (!pick) return;
    idx = items.findIndex((x) => x.value === pick);
    await keyScreen(ctx, pick);
  }
}

// ------------------------------------------------------------------ actions
function runChronos(cmd, args) {
  out.write('\x1b[2J\x1b[H' + paint(`◆ chronos ${cmd}`, { fg: T.gold, bold: true }) + label('   (read-only)') + '\n\n');
  const r = spawnSync(process.execPath, [path.join(live.ROOT, 'bin', 'chronos.cjs'), cmd, ...args], { stdio: 'inherit', env: { ...process.env, ENV_FILE: process.env.ENV_FILE || '' } });
  return r.status;
}

async function actionScreen(ctx, id) {
  for (;;) {
    const a = ACT.list(ctx).find((x) => x.id === id);
    const icon = a.state === 'done' ? ok('done') : a.state === 'todo' ? warn('to do') : label('? unknown');
    const lines = [paint(a.title, { fg: T.ink, bold: true }), icon + label('   ' + a.detail), '', paint('Steps', { fg: T.gold, bold: true })];
    a.steps.forEach((s, i) => A.wrap(s, Math.min((out.columns || 80) - 8, 96)).forEach((l, k) => lines.push((k ? '     ' : `  ${i + 1}.  `) + paint(l, { fg: /^(chmod|mkdir|nano|chronos)/.test(s) ? T.blue : T.text }))));
    screen(`Checklist › ${a.title}`, lines);
    const opts = [];
    if (a.fix && a.state !== 'done') opts.push({ label: 'Fix it for me', value: 'fix', color: T.gold });
    if (a.run) opts.push({ label: 'Run it now', value: 'run', color: T.gold });
    if (!a.fix && !a.run && a.state !== 'done' && /only you|marked/.test(a.detail)) opts.push({ label: 'Mark as done', value: 'mark' });
    if (a.run && a.state !== 'done' && /only you|marked/.test(a.detail)) opts.push({ label: 'Mark as done', value: 'mark' });
    if (a.state === 'done' && /marked/.test(a.detail)) opts.push({ label: 'Mark as not done', value: 'unmark' });
    opts.push({ label: 'Check again', value: 'again' }, { label: 'Back', value: null });
    const c = await P.select('Choose', opts);
    if (!c) return;
    if (c === 'fix') { try { out.write(ok(a.fix()) + '\n'); } catch (e) { out.write(bad(redact(e.message)) + '\n'); } await P.pause(); }
    if (c === 'run') { const r = a.run(); if (r.cmd === 'gas' && !r.args.length) { out.write(bad('no confirmed transaction hashes found in verified_mainnet_actions.json') + '\n'); await P.pause(); } else { runChronos(r.cmd, r.args); await P.pause(); } }
    if (c === 'mark') ACT.mark(id, true);
    if (c === 'unmark') ACT.mark(id, false);
  }
}

async function actionsMenu(ctx) {
  let idx = 0;
  for (;;) {
    const L = ACT.list(ctx);
    const items = L.map((a) => ({ label: (a.state === 'done' ? '✓ ' : a.state === 'todo' ? '○ ' : '? ') + a.title, value: a.id, color: a.state === 'done' ? T.green : a.state === 'todo' ? T.ink : T.dim, hint: A.truncate(a.detail, 40) }));
    items.push({ label: 'Back', value: null });
    const done = L.filter((a) => a.state === 'done').length;
    screen('Checklist');
    const pick = await P.select(`Your action checklist · ${done} of ${L.length} done`, items, { index: idx, subtitle: 'Each item shows exact steps. Green items were checked automatically or marked done by you.' });
    if (!pick) return;
    idx = items.findIndex((x) => x.value === pick);
    await actionScreen(ctx, pick);
  }
}

// ------------------------------------------------------------------ review
async function review(ctx) {
  const doc = E.load(ctx.envFile);
  const lines = [paint('Where everything is stored', { fg: T.ink, bold: true })];
  let mode = null; try { mode = fs.statSync(ctx.envFile).mode & 0o777; } catch (_) { /* none */ }
  lines.push(`  .env        ${ctx.envFile}  ${mode === null ? warn('not created yet') : (mode & 0o077) ? bad('permissions ' + mode.toString(8)) : ok('permissions 600')}`);
  const dir = path.dirname(ctx.envFile); const base = path.basename(ctx.envFile) + '.bak-';
  let baks = []; try { baks = fs.readdirSync(dir).filter((f) => f.startsWith(base)).sort(); } catch (_) { /* none */ }
  lines.push(`  backups     ${baks.length ? baks.length + ' kept (newest ' + baks[baks.length - 1] + ')' : 'none yet'}`);
  lines.push(`  checklist   ${path.join(live.DATA, 'actions.json')}`, '');
  const groups = {};
  for (const s of C.SECRETS) { groups[s.group] = groups[s.group] || [0, 0]; groups[s.group][1]++; if (E.get(doc, s.key)) groups[s.group][0]++; }
  lines.push(paint('Keys set', { fg: T.ink, bold: true }));
  for (const [g, [n, t]] of Object.entries(groups)) lines.push(`  ${A.padEnd(g, 28)} ${n} of ${t}`);
  const miss = C.SETTINGS.filter((s) => E.get(doc, s.key) === undefined).length;
  lines.push('', `  ${A.padEnd('settings', 28)} ${C.SETTINGS.length - miss} of ${C.SETTINGS.length}`);
  lines.push('', label('Secret values are never displayed, logged, or sent anywhere except the one test call that checks them.'), label('To undo a change: copy a .env.bak-… file back over .env.'));
  screen('Review', lines);
  await P.pause();
}

// ------------------------------------------------------------------ main
async function runSetup() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) { console.error('chronos setup needs an interactive terminal'); process.exit(2); }
  const ctx = { envFile: chooseEnvFile(), awokenThisSession: new Set() };
  ctx.workspace = live.workspaceDir(ctx.envFile);
  ctx.record = readRecord(ctx.workspace);
  const startAwake = awakeSet(ctx);
  { // first visit with keys missing: look for them on the phone before asking
    const d0 = E.load(ctx.envFile);
    if (C.SECRETS.some((s) => !E.get(d0, s.key)) && !process.env.CHRONOS_NO_AUTO_IMPORT) {
      await importKeys(ctx);
      const d1 = E.load(ctx.envFile);
      const left = C.SECRETS.filter((s) => !E.get(d1, s.key)).length;
      if (left) { screen('', [label(`${left} key${left === 1 ? '' : 's'} still missing after the import.`)]); if (await P.confirm('Enter the missing ones now? (any can be skipped)', true)) await askMissing(ctx); }
    }
  }
  let idx = 0;
  for (;;) {
    const doc = E.load(ctx.envFile);
    const keysSet = C.SECRETS.filter((s) => !s.group.startsWith('Wallet') && E.get(doc, s.key)).length;
    const keysAll = C.SECRETS.filter((s) => !s.group.startsWith('Wallet')).length;
    const sMiss = (g) => C.SETTINGS.filter((s) => g.includes(s.group) && (E.get(doc, s.key) === undefined || C.checkSetting(s, E.get(doc, s.key)))).length;
    const L = ACT.list(ctx); const done = L.filter((a) => a.state === 'done').length;
    const rpc = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'].find((k) => E.get(doc, k));
    const caps = capState(ctx);
    const items = [
      { label: '0  Import keys found on this phone', value: 'import', hint: 'workspace, Drive-synced folders, Downloads' },
      { label: '◆  Ask me only for the missing keys', value: 'missing', hint: `${keysAll - keysSet} missing`, hintColor: keysAll - keysSet ? T.amber : T.green },
      { label: '1  Connection and API keys', value: 'keys', hint: `${keysSet} of ${keysAll} set${rpc ? '' : ' · no Arbitrum RPC yet'}`, hintColor: rpc ? T.dim : T.amber },
      { label: '2  Scanner and measurement settings', value: 'settings', hint: sMiss(['Scanner', 'Measurement']) ? `${sMiss(['Scanner', 'Measurement'])} missing` : 'complete', hintColor: sMiss(['Scanner', 'Measurement']) ? T.amber : T.green },
      { label: '3  Policies (T1 tax reserve, drawdown)', value: 'policies', hint: sMiss(['Policies']) ? `${sMiss(['Policies'])} missing` : 'complete', hintColor: sMiss(['Policies']) ? T.amber : T.green },
      { label: '4  Wallet addresses', value: 'wallets', hint: `${C.SECRETS.filter((s) => s.group.startsWith('Wallet') && E.get(doc, s.key)).length} of 4 set` },
      { label: '5  Your action checklist', value: 'actions', hint: `${done} of ${L.length} done`, hintColor: done === L.length ? T.green : T.amber },
      { label: '6  Review: where things are stored', value: 'review' },
      { label: '7  Capabilities online', value: 'caps', hint: `${caps.filter((c) => c.awake).length} of ${caps.length}` },
      { label: 'Finish', value: null },
    ];
    screen('', [label(`.env: ${ctx.envFile}${fs.existsSync(ctx.envFile) ? '' : '  (will be created, permissions 600)'}`)]);
    const pick = await P.select('Setup and actions', items, { index: idx, subtitle: 'Work top to bottom. Nothing here sends a transaction.', footer: '↑↓ move · enter choose · 1-6 jump · esc finish' });
    if (!pick) break;
    idx = items.findIndex((x) => x.value === pick);
    if (pick === 'import') await importKeys(ctx);
    if (pick === 'missing') await askMissing(ctx);
    if (pick === 'caps') await capabilitiesView(ctx);
    if (pick === 'keys') { const b = awakeSet(ctx); await keysMenu(ctx); if (awakeSet(ctx).size !== b.size) await showAwoken(ctx, b, 'What came online'); }
    if (pick === 'settings') { const b = awakeSet(ctx); await settingsMenu(ctx, ['Scanner', 'Measurement'], 'Scanner and measurement settings'); if (awakeSet(ctx).size !== b.size) await showAwoken(ctx, b, 'What came online'); }
    if (pick === 'policies') await settingsMenu(ctx, ['Policies'], 'Policies');
    if (pick === 'wallets') { const b = awakeSet(ctx); await walletsMenu(ctx); if (awakeSet(ctx).size !== b.size) await showAwoken(ctx, b, 'What came online'); }
    if (pick === 'actions') await actionsMenu(ctx);
    if (pick === 'review') await review(ctx);
  }
  const endAwake = awakeSet(ctx);
  ctx.summary = [...endAwake].filter((n) => !startAwake.has(n));
  out.write('\x1b[2J\x1b[H');
  try { process.stdin.setRawMode(false); } catch (_) { /* */ }
  return ctx;
}

module.exports = { runSetup };
if (require.main === module) runSetup().then((ctx) => {
  if (ctx.summary.length) { console.log('◆ Came online during this setup:'); for (const n of ctx.summary) console.log('  ✓ ' + n); }
  console.log('Setup closed. Open the dashboard with: chronos');
  process.exit(0);
});
