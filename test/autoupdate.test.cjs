'use strict';
// Automatic updates: installed on the phone when a newer release is published, never while a trade is in flight,
// never twice for the same version, never on the cloud engine, off when you say so; the installer runs from a private
// copy (the install overwrites go.sh) and detached, so it outlives the engine's restart.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('../lib/autoupdate.cjs');

test('decide: on by default on the phone; off, cloud engine, trade in flight and a repeat each only notify', () => {
  const base = { env: () => undefined, termux: true, busy: false, lastTried: null, version: '2.6.0' };
  assert.strictEqual(U.decide(base).install, true);
  assert.match(U.decide({ ...base, env: (k) => (k === 'CHRONOS_AUTO_UPDATE' ? 'off' : undefined) }).why, /off/);
  assert.match(U.decide({ ...base, termux: false }).why, /cloud engine/);
  assert.match(U.decide({ ...base, busy: true }).why, /in flight/);
  assert.match(U.decide({ ...base, lastTried: '2.6.0' }).why, /already ran/);
  for (const o of [{ env: () => 'off' }, { termux: false }, { busy: true }, { lastTried: '2.6.0' }]) assert.strictEqual(U.decide({ ...base, ...o }).install, false);
});

test('install: runs a private copy of go.sh, detached, output to data/update.log, no terminal attached', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'au-root-')); const data = fs.mkdtempSync(path.join(os.tmpdir(), 'au-data-'));
  fs.writeFileSync(path.join(root, 'go.sh'), 'echo hi\n');
  let call = null; let unref = false;
  U.install({ root, dataDir: data, spawnImpl: (cmd, args, opts) => { call = { cmd, args, opts }; return { unref: () => { unref = true; } }; } });
  assert.strictEqual(call.cmd, 'sh');
  assert.strictEqual(call.args[0], path.join(data, 'go-run.sh'), 'not the go.sh the install overwrites');
  assert.strictEqual(fs.readFileSync(call.args[0], 'utf8'), 'echo hi\n');
  assert.strictEqual(call.opts.detached, true); assert.ok(unref);
  assert.deepStrictEqual(call.opts.stdio[0], 'ignore', 'no terminal attached');
  assert.ok(fs.existsSync(path.join(data, 'update.log')));
});

test('a newer archive in Downloads is found (newest wins; older, same, unreadable and other files ignored); never installed without a tap', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'au-home-')); const dl = path.join(home, 'storage', 'downloads');
  fs.mkdirSync(dl, { recursive: true });
  const v = { 'chronos-console-2.6.0.tgz': '2.6.0', 'chronos-console-2.7.0.tgz': '2.7.0', 'chronos-console (1).tgz': '2.6.5', 'chronos-console-bad.tgz': null, 'notes.txt': '9.9.9' };
  for (const f of Object.keys(v)) fs.writeFileSync(path.join(dl, f), 'x');
  const DV = require('../lib/device.cjs');
  const versionOf = (p) => { const x = v[path.basename(p)]; if (!x) throw new Error('not an archive'); return x; };
  assert.deepStrictEqual(U.newerDownload({ home, current: '2.6.0', cmp: DV.cmp, versionOf }), { file: path.join(dl, 'chronos-console-2.7.0.tgz'), version: '2.7.0' });
  assert.strictEqual(U.newerDownload({ home, current: '2.7.0', cmp: DV.cmp, versionOf }), null);
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'daemon.cjs'), 'utf8');
  assert.ok(/newerDownload[\s\S]{0,600}buttons: \[\{ label: 'Install', action: 'chronos update' \}\]/.test(src), 'only offered with an Install button');
  assert.ok(!/newerDownload[\s\S]{0,600}autoupdate\.cjs'\)\.install\(/.test(src), 'a file in Downloads is never installed by itself');
});
