'use strict';
// chronos phone: a stopped engine is started, the restart-on-open hook is written once (and updated, never
// duplicated, everything else in ~/.bashrc untouched), boot start set up when Termux:Boot exists, and "reaching your
// portal" judged from the engine's own record of accepted sends.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const PH = require('../lib/phone.cjs');

function rig({ online = false, boot = false, bootApp = true, onPath = ['termux-wake-lock', 'termux-notification', 'pm2'], state = null, rc = 'alias ll="ls -l"\n', now = 1e12 } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
  if (rc !== null) fs.writeFileSync(path.join(home, '.bashrc'), rc);
  let st = { pm2: onPath.includes('pm2'), status: online ? 'online' : 'stopped', uptimeMs: 600000, boot, bootAppReady: bootApp };
  const calls = [];
  const d = {
    home, now, log: () => {}, ask: async () => true, openBattery: () => true, state: () => state,
    onPath: (b) => (onPath.includes(b) ? '/bin/' + b : null), run: (c) => { calls.push(c); return 0; },
    service: { status: () => st, install: () => { calls.push('install'); st = { ...st, status: 'online', boot: bootApp }; return { steps: [] }; } },
  };
  return { d, home, calls };
}
const by = (cs, n) => cs.find((c) => c.name.startsWith(n));

test('a stopped engine is started; boot start set up; the reaching-the-portal check reads the engine\'s own record', async () => {
  const now = 1e12;
  const r = rig({ state: { heartbeat: now - 5000, sync: { lastOk: now - 30000, rejected: 2 } }, now });
  const cs = await PH.checkPhone(r.d);
  assert.ok(r.calls.includes('install'));
  assert.deepStrictEqual([by(cs, 'engine running').ok, by(cs, 'engine running').fixed], [true, 'it was stopped; started it now']);
  assert.ok(by(cs, 'starts when the phone boots').ok);
  assert.match(by(cs, 'engine reaching your portal').fixed, /30 s ago · 2 row\(s\) refused/);
  const stale = await PH.checkPhone(rig({ online: true, state: { heartbeat: now - 5000, sync: { lastOk: now - 3600000, lastErr: 'HTTP 403 device pending' } }, now }).d);
  assert.deepStrictEqual([by(stale, 'engine reaching').ok, /60 min ago: HTTP 403/.test(by(stale, 'engine reaching').todo)], [false, true]);
  const none = await PH.checkPhone(rig({ online: true, state: null }).d);
  assert.strictEqual(by(none, 'engine reaching').ok, false);
});

test('the Termux hook: written once, updated in place, the rest of ~/.bashrc kept, and valid shell', async () => {
  const r = rig({ online: true });
  await PH.checkPhone(r.d); await PH.checkPhone(r.d);
  const text = fs.readFileSync(path.join(r.home, '.bashrc'), 'utf8');
  assert.strictEqual(text.split(PH.HOOK_START).length - 1, 1, 'exactly one hook');
  assert.ok(text.startsWith('alias ll="ls -l"\n'), 'your own lines untouched');
  const old = `x=1\n${PH.HOOK_START}\nold stuff\n${PH.HOOK_END}\ny=2\n`;
  assert.strictEqual(PH.withHook(old), 'x=1\ny=2\n' + PH.withHook('').trimStart());
  execFileSync('sh', ['-n', path.join(r.home, '.bashrc')]);
  const fresh = rig({ online: true, rc: null }); await PH.checkPhone(fresh.d);
  assert.ok(fs.readFileSync(path.join(fresh.home, '.bashrc'), 'utf8').includes('pm2 resurrect'));
});

test('without PM2 or Termux:Boot it says exactly what to install; it never claims a fix it did not make', async () => {
  const cs = await PH.checkPhone(rig({ onPath: [], bootApp: false }).d);
  assert.match(by(cs, 'engine supervisor').todo, /npm install -g pm2/);
  assert.match(by(cs, 'starts when the phone boots').todo, /Termux:Boot from F-Droid/);
  assert.match(by(cs, 'phone notifications').todo, /Termux:API/);
  assert.strictEqual(by(cs, 'battery').ok, false);
  const opened = await PH.checkPhone(rig({ online: true }).d);
  assert.match(by(opened, 'battery').fixed, /only you can switch it/);
});
