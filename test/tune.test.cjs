'use strict';
// chronos tune small-trades (2.9.19): research change #1 as one approved decision: shown before → after, applied
// only on YES in capitals, undone with chronos tune undo (the earlier values kept in data/tune-backup.json).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const T = require('../tui/tune.cjs');

const world = (env) => { const e = { ...env }; const said = []; return { env: e, said, d: (sub, answer) => ({ sub, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tune-')), get: (k) => e[k], setEnv: (k, v) => { if (v === '') delete e[k]; else e[k] = v; }, log: (s) => said.push(s), P: { input: async () => answer } }) }; };

test('small trades: shown before → after, applied only on YES, every value back with undo', async () => {
  const w = world({ SIZE_LADDER_USD: '200,1000,5000', SCREEN_SIZE_USD: '1000', MIN_NET_PROFIT_USD: '0.35' });
  const d = w.d('small-trades', 'yes');
  assert.strictEqual(await T.run(d), 1); assert.match(w.said.at(-1), /type YES in capitals/); assert.strictEqual(w.env.MIN_NET_PROFIT_USD, '0.35', 'nothing changed');
  assert.ok(w.said.some((s) => /MIN_NET_PROFIT_USD\s+0\.35\s+→ 0\.05/.test(s)), 'before → after shown');
  const d2 = { ...d, P: { input: async () => 'YES' } };
  assert.strictEqual(await T.run(d2), 0);
  assert.deepStrictEqual([w.env.SIZE_LADDER_USD, w.env.SCREEN_SIZE_USD, w.env.MIN_NET_PROFIT_USD, w.env.FLOOR_GAS_MULT], ['25,50,100,200,500,1000,2500,5000', '100', '0.05', '1.5']);
  assert.strictEqual(await T.run({ ...d, sub: 'undo' }), 0);
  assert.deepStrictEqual([w.env.SIZE_LADDER_USD, w.env.SCREEN_SIZE_USD, w.env.MIN_NET_PROFIT_USD, w.env.FLOOR_GAS_MULT], ['200,1000,5000', '1000', '0.35', undefined], 'a setting that was unset is unset again');
  assert.ok(fs.readdirSync(d.dataDir).some((f) => f.startsWith('tune-backup.json.undone-')), 'the backup is kept, never deleted');
  assert.strictEqual(await T.run({ ...d, sub: 'undo' }), 1, 'nothing left to undo');
});

test('every value it sets is inside the limits chronos set enforces', () => {
  const C = require('../lib/catalog.cjs');
  for (const [k, v] of Object.entries(T.SMALL)) {
    const st = C.SETTINGS.find((x) => x.key === k); assert.ok(st, k);
    for (const n of String(v).split(',').map(Number)) assert.ok(n >= st.min && n <= st.max, `${k} ${n} within ${st.min}…${st.max}`);
  }
});
