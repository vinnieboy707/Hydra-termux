'use strict';
// The 24/7 engine end to end, against a local test chain (synthetic data, test only):
// sealed copy of the code → engine scans → signed state → phone + webhook alerts → scan-now / pause / stop →
// a tampered copy refuses to run → PM2 service install, status and uninstall.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync, execFileSync } = require('child_process');
const LS = require('../lib/livestate.cjs');
const history = require('../lib/history.cjs');
const { createNotifier, onPath } = require('../lib/notify.cjs');
const I = require('../lib/integrity.cjs');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, what) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out waiting for ' + what); await sleep(300); } };

function sealedCopy() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-copy-'));
  for (const f of I.codeFiles()) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), d); fs.chmodSync(d, 0o644); }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  const r = spawnSync(NODE, [path.join(tmp, 'bin', 'chronos.cjs'), 'seal', '--yes'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  return tmp;
}
async function devchain() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(NODE, [path.join(ROOT, 'test', 'devchain.cjs')], { cwd: ROOT, env: { ...process.env, DEVCHAIN_PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore'] });
  const line = await new Promise((res, rej) => {
    let buf = ''; const t = setTimeout(() => rej(new Error('devchain timeout')), 90000);
    p.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { clearTimeout(t); res(buf.slice(0, i)); } });
    p.on('exit', (c) => rej(new Error('devchain exited ' + c)));
  });
  return { proc: p, env: JSON.parse(line) };
}
function fakeNotifyBin(dir) {
  const bin = path.join(dir, 'fakebin'); fs.mkdirSync(bin, { recursive: true });
  // one notification per log line (multi-line content is joined with spaces)
  fs.writeFileSync(path.join(bin, 'termux-notification'), '#!/bin/sh\n{ printf "%s" "$*" | tr "\\n" " "; printf "\\n"; } >> "$FAKE_NOTIFY_LOG"\n', { mode: 0o755 });
  return bin;
}
function webhookServer() {
  const got = [];
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { got.push(JSON.parse(b)); } catch (_) { got.push({ bad: b }); } res.end('ok'); }); });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, got, url: `http://127.0.0.1:${srv.address().port}/hook` })));
}

test('notifier: phone + webhook, redacted, repeats suppressed, hourly cap', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-'));
  const bin = fakeNotifyBin(tmp); const logf = path.join(tmp, 'n.log');
  const oldPath = process.env.PATH; process.env.PATH = bin + path.delimiter + oldPath; process.env.FAKE_NOTIFY_LOG = logf;
  const hook = await webhookServer();
  try {
    const n = createNotifier({ webhook: hook.url, dataDir: tmp, perIdMs: 60000, perHour: 3 });
    assert.deepStrictEqual(n.channels, { termux: true, webhook: true });
    const r = await n.send({ id: 'x', title: 'Problem', text: 'node https://arb-mainnet.g.alchemy.com/v2/SECRETKEYabcdefghijklmnopqrstuv failed', level: 'error' });
    assert.deepStrictEqual(r.via.sort(), ['termux', 'webhook']);
    assert.strictEqual((await n.send({ id: 'x', title: 'Problem', text: 'again' })).skipped, 'repeat');
    await n.send({ id: 'y', title: 'a', text: 'b' }); await n.send({ id: 'z', title: 'a', text: 'b' });
    assert.strictEqual((await n.send({ id: 'w', title: 'a', text: 'b' })).skipped, 'hourly cap');
    const phone = fs.readFileSync(logf, 'utf8');
    assert.match(phone, /--title Problem/); assert.match(phone, /--priority high/);
    for (const s of [phone, JSON.stringify(hook.got), fs.readFileSync(path.join(tmp, 'notifications.log'), 'utf8')]) assert.doesNotMatch(s, /SECRETKEY|alchemy\.com/, 'alerts never carry node urls or keys');
    assert.strictEqual(createNotifier({ webhook: 'http://evil.example/hook', dataDir: tmp }).channels.webhook, false, 'plain-http webhooks to other hosts are refused');
    // pinned status: edited in place, silent after the first time, throttled, outside the alert cap, never to the webhook
    const hooksBefore = hook.got.length;
    assert.deepStrictEqual((await n.status({ title: 'Chronos · stage 4 of 7', text: 'time: about 10 min', buttons: [{ label: 'Scan now', action: "touch '/d/live/scan-now'" }] })).via, ['termux'], 'status is sent even though the alert cap is reached');
    assert.strictEqual((await n.status({ title: 'Chronos · stage 4 of 7', text: 'still' })).skipped, 'throttled');
    assert.deepStrictEqual((await n.status({ title: 'Chronos · stage 5 of 7', text: 'moved on' })).via, ['termux'], 'a new headline is shown at once');
    const lines = fs.readFileSync(logf, 'utf8').trim().split('\n').filter((l) => l.includes('--group chronos-status'));
    assert.strictEqual(lines.length, 2);
    for (const l of lines) { assert.match(l, /--id 424242 /); assert.match(l, /--alert-once/); assert.match(l, /--ongoing/); assert.match(l, /--priority low/); }
    assert.match(lines[0], /--button1 Scan now --button1-action touch '\/d\/live\/scan-now'/);
    assert.strictEqual(hook.got.length, hooksBefore, 'status never goes to the webhook');
  } finally { process.env.PATH = oldPath; hook.srv.close(); }
});

test('engine state is signed; edited state is rejected; staleness is detected', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-'));
  LS.write(tmp, { pid: process.pid, heartbeat: Date.now(), phase: 'running', res: { approved: 1 } });
  assert.ok(LS.read(tmp).ok);
  assert.ok(LS.alive(LS.read(tmp).state, 30000));
  const f = LS.fileFor(tmp); const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  raw.body = raw.body.replace('"approved":1', '"approved":99'); fs.writeFileSync(f, JSON.stringify(raw));
  assert.strictEqual(LS.read(tmp).reason, 'signature');
  LS.write(tmp, { pid: 999999, heartbeat: Date.now() - 120000, phase: 'running' });
  assert.ok(!LS.alive(LS.read(tmp).state, 30000), 'old heartbeat / dead pid = not alive');
});

test('engine end to end: scans, signs state, alerts, obeys scan-now / pause / stop; a tampered copy refuses to run', async () => {
  const copy = sealedCopy();
  const dc = await devchain();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-'));
  const dataDir = path.join(tmp, 'data'); const bin = fakeNotifyBin(tmp); const phoneLog = path.join(tmp, 'phone.log');
  const hook = await webhookServer();
  const env = { ...process.env, ...dc.env, CHRONOS_DATA_DIR: dataDir, PATH: bin + path.delimiter + process.env.PATH, FAKE_NOTIFY_LOG: phoneLog, CHRONOS_WEBHOOK_URL: hook.url, TUI_REFRESH_SEC: '300' };
  const eng = spawn(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'daemon'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; eng.stdout.on('data', (d) => { out += d; }); eng.stderr.on('data', (d) => { out += d; });
  try {
    const st1 = await until(() => { const s = LS.read(dataDir); return s.ok && s.state.res && s.state.profit ? s.state : null; }, 120000, 'first scan and its profit check'); // the profit check follows the scan in the same loop
    assert.strictEqual(st1.phase, 'running');
    assert.strictEqual(st1.res.quotesPinnedToBlock, st1.res.blockNumber, 'every quote of the scan is pinned to its block');
    assert.ok(st1.multicall, 'Multicall3 found on the test chain');
    assert.ok(st1.res.rpc.requests < st1.res.rpc.calls, `batched: ${st1.res.rpc.calls} calls in ${st1.res.rpc.requests} requests`);
    assert.ok(st1.res.approved > 0, 'the test chain has deliberate spreads');
    assert.ok(st1.profit && st1.profit.current && !st1.profit.profiting, 'quotes never count as profit');
    assert.strictEqual(st1.mode.mode, 'SHADOW', 'nothing is sent without a contract, an executor and proven shadow wins');
    assert.match(st1.exec.why, /no contract address set/);
    assert.strictEqual(history.load(dataDir).records.length, 1, 'one signed history line per scan');
    await until(() => fs.existsSync(phoneLog) && /Opportunity passed every guardrail/.test(fs.readFileSync(phoneLog, 'utf8')), 20000, 'opportunity alert');
    assert.match(fs.readFileSync(phoneLog, 'utf8'), /Chronos engine running/);
    const pinned = () => fs.readFileSync(phoneLog, 'utf8').trim().split('\n').filter((l) => l.includes('--group chronos-status'));
    await until(() => pinned().length > 0, 20000, 'pinned money status');
    assert.match(pinned()[0], /--title Chronos · not profiting yet · stage \d of 7 --content [━─]{12} \d\/7 · /);
    assert.match(pinned()[0], /best quote now \+?\$[\d.,]+ net · \d+ passed · block \d+/);
    assert.match(pinned()[0], /--ongoing --button1 Scan now --button1-action touch '[^']+\/live\/scan-now' --button2 Pause --button2-action touch '[^']+\/live\/paused'/);
    await until(() => hook.got.some((g) => /Opportunity/.test(g.text || '')), 20000, 'webhook alert');
    assert.doesNotMatch(fs.readFileSync(path.join(dataDir, 'notifications.log'), 'utf8'), /127\.0\.0\.1:\d+\/|ENV_FILE/);

    // scan now (interval is 300 s, so only the request can cause a second scan)
    LS.control.poke(dataDir);
    const st2 = await until(() => { const s = LS.read(dataDir); return s.ok && s.state.lastScanAt > st1.lastScanAt && !s.state.scanning ? s.state : null; }, 60000, 'requested scan');
    assert.ok(st2.session.summary.scans >= 2);
    // pause: requests are ignored while paused
    LS.control.setPaused(dataDir, true);
    await until(() => LS.read(dataDir).state.paused, 10000, 'pause');
    const pausedAt = LS.read(dataDir).state.lastScanAt;
    LS.control.poke(dataDir); await sleep(3000);
    assert.strictEqual(LS.read(dataDir).state.lastScanAt, pausedAt, 'no scan while paused');
    await until(() => pinned().some((l) => /engine PAUSED/.test(l) && /--button2 Resume --button2-action rm -f '[^']+\/live\/paused'/.test(l)), 10000, 'pinned status shows the pause and offers Resume');
    LS.control.setPaused(dataDir, false);
    // stop
    const code = await new Promise((r) => { eng.on('exit', r); eng.kill('SIGTERM'); });
    assert.strictEqual(code, 0, out);
    assert.strictEqual(LS.read(dataDir).state.phase, 'stopped');
    const lastPin = pinned().pop();
    assert.match(lastPin, /--title Chronos engine stopped/); assert.doesNotMatch(lastPin, /--ongoing/, 'a stopped engine leaves a dismissible notice, not a stale pinned status');

    // tampered copy: refuses to run, exits 78 (the service manager does not restart on 78), alerts you
    spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'unlock']);
    fs.appendFileSync(path.join(copy, 'lib', 'engine.cjs'), '\n// tampered\n');
    const r = spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'daemon'], { env, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(r.status, 78, r.stdout + r.stderr);
    assert.strictEqual(LS.read(dataDir).state.phase, 'blocked');
    assert.match(fs.readFileSync(phoneLog, 'utf8'), /Chronos engine stopped/);
  } finally { try { eng.kill('SIGKILL'); } catch (_) { /* gone */ } dc.proc.kill('SIGKILL'); hook.srv.close(); }
});

test('service: PM2 install starts the engine, sets boot start, reports status, uninstalls cleanly', { skip: onPath('pm2') ? false : 'PM2 not installed here' }, async () => {
  const copy = sealedCopy();
  const dc = await devchain();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-'));
  const home = path.join(tmp, 'home'); fs.mkdirSync(path.join(home, '.termux', 'boot'), { recursive: true });
  const dataDir = path.join(tmp, 'data');
  const env = { ...process.env, ...dc.env, HOME: home, PM2_HOME: path.join(tmp, 'pm2'), CHRONOS_DATA_DIR: dataDir, TUI_REFRESH_SEC: '300' };
  const chronos = (...a) => spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), ...a], { env, encoding: 'utf8', timeout: 120000 });
  try {
    const ins = chronos('service', 'install');
    assert.strictEqual(ins.status, 0, ins.stdout + ins.stderr);
    assert.match(ins.stdout, /PM2 runs chronos-engine/);
    assert.ok(fs.existsSync(path.join(home, '.termux', 'boot', 'chronos-engine')), 'boot script written');
    assert.match(fs.readFileSync(path.join(home, '.termux', 'boot', 'chronos-engine'), 'utf8'), /pm2 resurrect/);
    const st = await until(() => { const s = LS.read(dataDir); return s.ok && s.state.res ? s.state : null; }, 150000, 'engine under PM2');
    assert.strictEqual(st.phase, 'running');
    const status = chronos('service', 'status');
    assert.match(status.stdout, /service\s+online/); assert.match(status.stdout, /boot start\s+on/);
    const un = chronos('service', 'uninstall');
    assert.strictEqual(un.status, 0, un.stdout + un.stderr);
    assert.ok(!fs.existsSync(path.join(home, '.termux', 'boot', 'chronos-engine')), 'boot script removed');
    assert.match(chronos('service', 'status').stdout, /not installed/);
  } finally {
    try { execFileSync(onPath('pm2'), ['kill'], { env, timeout: 30000, stdio: 'ignore' }); } catch (_) { /* already gone */ }
    dc.proc.kill('SIGKILL');
  }
});
