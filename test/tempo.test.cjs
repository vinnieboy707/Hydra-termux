'use strict';
// Tempo: up when a scan measures something to win, down after quiet scans, inside every limit. Real counterpart: the
// scan results it reads are the engine's own real scans (test/cycles.test.cjs, chronos verify-real real-quote).
const test = require('node:test');
const assert = require('node:assert');
const { Tempo, MIN_INTERVAL_S, MAX_QUOTES } = require('../lib/tempo.cjs');

const scan = (approved, best) => ({ approved, indicators: { best: best === null ? null : { netUsd: best } } });

test('amps up on real opportunity, eases off when quiet, never past its limits', () => {
  const t = new Tempo();
  assert.deepStrictEqual([t.interval(20), t.quotes(400)], [20, 400]);
  assert.match(t.observe(scan(0, 0.02)).why, /best route nets \$0\.0200/); assert.strictEqual(t.level, 1);
  t.observe(scan(2, 1.5)); assert.strictEqual(t.level, 3, 'two approved routes: up two');
  assert.deepStrictEqual([t.interval(20), t.quotes(400)], [6.6, 1000]);
  t.observe(scan(5, 9)); assert.strictEqual(t.level, 3, 'capped at 3');
  t.observe(scan(0, -0.3)); t.observe(scan(0, -0.3)); assert.strictEqual(t.level, 3, 'two quiet scans: hold');
  assert.match(t.observe(scan(0, -0.3)).why, /3 quiet scans/); assert.strictEqual(t.level, 2);
  for (let i = 0; i < 9; i++) t.observe(scan(0, null)); assert.strictEqual(t.level, 0, 'back to base');
  assert.strictEqual(t.interval(2), MIN_INTERVAL_S); const hi = new Tempo(); hi.level = 3; assert.strictEqual(hi.quotes(5000), MAX_QUOTES);
  const capped = new Tempo({ max: 1 }); capped.observe(scan(4, 3)); assert.strictEqual(capped.level, 1, 'CHRONOS_TEMPO_MAX holds');
  const off = new Tempo({ max: 0 }); off.observe(scan(4, 3)); assert.strictEqual(off.level, 0);
});
