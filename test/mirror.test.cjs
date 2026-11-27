'use strict';
// Every failure mirrored: a failed route's opposite direction (quoted in the same scan) is paired with it; a mirror
// that cleared every rule is a success (told once per 6 h, success webhook fired), a profitable mirror below the floor
// is a lead, and when both directions lose the fee wall (how much wider the gap must be) is measured. Real counterpart:
// the scan's own quotes of both directions against the live pools (real-quote, venues-real in chronos verify-real).
const test = require('node:test');
const assert = require('node:assert');
const M = require('../lib/mirror.cjs');
const c = (key, o) => ({ key, path: ['USDC', 'WETH', 'USDC'], loopPath: ['USDC', 'WETH', 'USDC'], approved: false, ...o });
const scan = (fwd, rev, block = 7) => ({ blockNumber: block, candidates: [c('F', fwd), c('R', { flip: 'reverse', flipOf: 'F', path: ['USDC', 'DAI', 'USDC'], loopPath: ['USDC', 'DAI', 'USDC'], ...rev })] });

test('each failed route is paired with its quoted mirror; kinds are success, lead or fee wall', () => {
  assert.deepStrictEqual(M.pairs({ candidates: [c('F', {}), c('X', { flip: 'reverse', flipOf: 'nope' })] }), [], 'no quoted partner: no pair');
  let ms = M.mirrors(scan({ netUsd: -2 }, { netUsd: 1.5, approved: true }), 1);
  assert.strictEqual(ms.length, 1); assert.strictEqual(ms[0].kind, 'success'); assert.strictEqual(ms[0].gainUsd, 3.5);
  ms = M.mirrors(scan({ netUsd: -2 }, { netUsd: 0.4 }), 1);
  assert.deepStrictEqual(ms.map((m) => m.kind), ['lead', 'fee-wall']); assert.strictEqual(ms[0].wallUsd, 0.6);
  ms = M.mirrors(scan({ netUsd: -2 }, { netUsd: -0.7 }), 1);
  assert.ok(ms.every((m) => m.kind === 'fee-wall')); assert.ok(Math.abs(ms[0].wallUsd - 1.7) < 1e-9, 'gap must widen by $1.70 for the better side to clear $1');
  assert.deepStrictEqual(M.mirrors(scan({ netUsd: NaN }, { netUsd: 3, approved: true }), 1), [], 'unquoted: nothing claimed');
});

test('a mirror that pays fires the success webhook and a notification, once per route every 6 hours', async () => {
  const st = {}; const told = []; const hooks = [];
  const webhook = async (kind, p) => { hooks.push([kind, p]); };
  const run = (now) => M.capitalize(st, scan({ netUsd: -2.25 }, { netUsd: 1.5, approved: true }), 1, { now, notify: (l, t, x) => told.push([l, t, x]), webhook });
  let r = run(1e12);
  assert.deepStrictEqual(r.fired, ['R']);
  assert.deepStrictEqual(told[0].slice(0, 2), ['success', "★ A failure's mirror pays"]);
  assert.match(told[0][2], /USDC>WETH>USDC failed \(-\$2\.25\); its mirror USDC>DAI>USDC nets \$1\.50 at block 7 and cleared every rule/);
  assert.strictEqual(hooks[0][0], 'mirror'); assert.strictEqual(hooks[0][1].level, 'success'); assert.strictEqual(hooks[0][1].mirror.netUsd, 1.5);
  r = run(1e12 + 3600000); assert.deepStrictEqual(r.fired, [], 'not again within 6 h');
  r = run(1e12 + 7 * 3600000); assert.deepStrictEqual(r.fired, ['R']);
  assert.match(M.lines(st)[0], /1 failures mirrored · 1 mirror\(s\) paid · 0 profitable below your floor/);
});

test('report lines name the closest mirror and the fee wall; before any scan they say so', () => {
  assert.deepStrictEqual(M.lines(null), ['MIRRORS: no scan mirrored yet']);
  const st = {}; M.capitalize(st, scan({ netUsd: -2 }, { netUsd: -0.7 }), 1, { now: 1 });
  assert.match(M.lines(st)[1], /closest mirror: USDC>DAI>USDC -\$0\.70 \(its failed side -\$2\.00\); a price gap \$1\.70 wider would clear your floor/);
});
