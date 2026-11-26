'use strict';
// The synced workspace: a .env changed on another device is applied once, after it settles; identical rewrites and
// broken files are not applied. And the profit floor: your minimum, or FLOOR_GAS_MULT × the route's own gas.
// Real counterpart: real files on disk (no stand-ins); Syncthing itself is set up by sync/workspace-sync.sh.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsWatch } = require('../lib/settingswatch.cjs');
const E = require('../lib/engine.cjs');

test('settings watch: applies a real change once after it settles; ignores rewrites; refuses a broken file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-')); const f = path.join(dir, '.env');
  fs.writeFileSync(f, '# mine\nMIN_NET_PROFIT_USD=0.35\nSIZE_LADDER_USD=100,500\n');
  let t = 0, restarts = 0; const told = [];
  const w = new SettingsWatch({ file: f, onChange: () => restarts++, tell: (a, b) => told.push(a + ': ' + b), now: () => t, settleMs: 15000 });
  assert.strictEqual(w.check(), 'none');
  fs.writeFileSync(f, 'MIN_NET_PROFIT_USD=0.35\n\nSIZE_LADDER_USD=100,500\n# comment moved\n'); assert.strictEqual(w.check(), 'none', 'same values: no restart');
  fs.writeFileSync(f, 'MIN_NET_PROFIT_USD=0.05\nSIZE_LADDER_USD=100,500\n');
  assert.strictEqual(w.check(), 'waiting'); t += 5000; assert.strictEqual(w.check(), 'waiting');
  t += 11000; assert.strictEqual(w.check(), 'applied'); assert.strictEqual(restarts, 1);
  t += 20000; assert.strictEqual(w.check(), 'none'); assert.strictEqual(restarts, 1, 'applied once');
  fs.writeFileSync(f, 'MIN_NET_PROFIT_USD=0.05\n'); assert.strictEqual(w.check(), 'refused');
  assert.match(told[0], /missing SIZE_LADDER_USD/); assert.strictEqual(w.check(), 'refused'); assert.strictEqual(told.length, 1, 'told once');
  fs.writeFileSync(f, 'this is not a setting\n'); assert.strictEqual(w.check(), 'refused');
  assert.strictEqual(restarts, 1, 'a broken file is never applied');
  assert.strictEqual(new SettingsWatch({ file: null, onChange: () => {} }).check(), 'none');
});

test('profit floor: the larger of your minimum and 2× the route\'s gas; 0 keeps the fixed floor', () => {
  assert.strictEqual(E.floorUsd({ MIN_NET_PROFIT_USD: 0.05 }, 0.0154), 0.05, 'a $0.015-gas route needs $0.05');
  assert.ok(Math.abs(E.floorUsd({ MIN_NET_PROFIT_USD: 0.05 }, 0.1) - 0.2) < 1e-12, 'a $0.10-gas route needs $0.20');
  assert.strictEqual(E.floorUsd({ MIN_NET_PROFIT_USD: 0.05, FLOOR_GAS_MULT: 0 }, 0.5), 0.05);
  assert.strictEqual(E.floorUsd({ MIN_NET_PROFIT_USD: 0.35, FLOOR_GAS_MULT: 3 }, 0.1), 0.35);
  assert.strictEqual(E.floorUsd({ MIN_NET_PROFIT_USD: 0.05 }, null), 0.05, 'no gas measured: your minimum');
  // decide() uses the route's floor
  const base = { cfg: { MIN_NET_PROFIT_USD: 0.05, GAS_CEILING_GWEI: 1, MAX_SLIPPAGE_BPS: 35 }, gasGwei: 0.02, route: { markets: [{ executable: true }, { executable: true }] }, availableLiquidity: null, flashEnabled: true };
  const d = (netUsd, gasUsd) => E.decide({ ...base, cand: { netUsd, gasUsd, amount: 1n, impacts: [1, 1] } });
  assert.strictEqual(d(0.06, 0.02).approved, true, '$0.06 net on $0.02 gas: taken (a fixed $0.35 floor skipped it)');
  assert.strictEqual(d(0.06, 0.04).approved, false); assert.match(d(0.06, 0.04).reasons.join(), /below floor \$0\.0800/);
});
