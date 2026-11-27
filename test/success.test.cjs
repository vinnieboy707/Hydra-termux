'use strict';
// Building on success: real wins are noticed and told (first route above the floor, closest-ever route, shadow wins,
// profit from receipts), the playbook keeps the route patterns that worked, and every profit policy is reported with
// whether it holds. Only measured numbers; the first observation is a baseline, never announced as a win. Real
// counterparts: the scan, shadow runs and receipts of the running engine (contract-v2-probe, real-quote, realized).
const test = require('node:test');
const assert = require('node:assert');
const S = require('../lib/success.cjs');
const H = 3600000;
const R = (p = 0) => ({ treasury: { kpis: { realizedNetUsdAllTime: p, netUsdLast24h: p, taxReserveUsd: Math.ceil(p * 30) / 100 } } });
const cand = (o) => ({ path: ['USDC', 'WETH', 'USDC'], legsCount: 2, flash: { provider: 'balancer_v2' }, amountUsd: 5000, ...o });
const x = (o = {}) => ({ now: 1e12, res: { blockNumber: 1, approved: 0, candidates: [], indicators: { best: { netUsd: -3 } } }, shadowWins: 0, cfg: { MIN_NET_PROFIT_USD: 1, PROMOTE_MIN_WINS: 5 }, policies: [], env: () => undefined, ...o });

test('the first look is a baseline; real improvements are told with the numbers', () => {
  const st = {}; const got = []; const notify = (l, t, s) => got.push([l, t, s]);
  S.track(st, x(), R(), { notify }); assert.deepStrictEqual(got, [], 'baseline: nothing announced');
  S.track(st, x({ now: 1e12 + H, res: { blockNumber: 2, approved: 0, candidates: [], indicators: { best: { netUsd: -2.8 } } } }), R(), { notify });
  assert.deepStrictEqual(got, [], 'a $0.20 improvement is not news');
  S.track(st, x({ now: 1e12 + 2 * H, res: { blockNumber: 3, approved: 0, candidates: [], indicators: { best: { netUsd: -1.1 } } } }), R(), { notify });
  assert.strictEqual(got[0][0], 'success'); assert.strictEqual(got[0][1], '★ New closest route'); assert.match(got[0][2], /best net -\$1\.10 \(was -\$2\.80, 1 h ago\); your floor is \$1\.00, \$2\.10 to go/);
  S.track(st, x({ now: 1e12 + 3 * H, res: { blockNumber: 4, approved: 0, candidates: [], indicators: { best: { netUsd: 0.2 } } } }), R(), { notify });
  assert.strictEqual(got[1][1], '★ A route crossed break-even');
});

test('the first approved route, every shadow win and every profit are wins; the playbook keeps what worked', () => {
  const st = {}; const got = []; const notify = (l, t, s) => got.push([t, s]);
  S.track(st, x(), R(), { notify });
  const ok = x({ now: 1e12 + H, res: { blockNumber: 9, approved: 1, candidates: [cand({ approved: true, netUsd: 1.4 }), cand({ approved: false, netUsd: 3, path: ['DAI', 'USDC', 'DAI'] })], indicators: { best: { netUsd: 1.4 } } } });
  S.track(st, ok, R(), { notify });
  assert.ok(got.some(([t, s]) => t === '★ First route above your floor' && /USDC>WETH>USDC via balancer_v2 nets \$1\.40 after gas and fees at block 9/.test(s)));
  S.track(st, { ...ok, now: 1e12 + 2 * H, shadowWins: 2 }, R(), { notify });
  assert.ok(got.some(([t, s]) => t === '★ Shadow win #2' && /3 more before promotion to LIVE/.test(s)));
  S.track(st, { ...ok, now: 1e12 + 3 * H, shadowWins: 2 }, R(0.75), { notify });
  assert.ok(got.some(([t, s]) => t === '★ Profit up to $0.75' && /\+\$0\.75 verified from receipts/.test(s)));
  assert.strictEqual(got.filter(([t]) => t === '★ First route above your floor').length, 1, 'told once');
  const pb = Object.values(st.playbook); assert.strictEqual(pb.length, 1, 'only routes that cleared every rule'); assert.strictEqual(pb[0].approved, 3); assert.strictEqual(pb[0].bestNetUsd, 1.4);
  const L = S.lines(st, ok, R(0.75)).join('\n');
  assert.match(L, /USDC>WETH>USDC via balancer_v2 \(2 legs\): approved 3×, best \$1\.40, last size \$5000\.00 — repeat it/);
});

test('every profit and success policy is in one place, with whether it holds', () => {
  const pol = [{ id: 'PROFIT', name: 'Profit floor', rule: 'net ≥ floor', status: 'ENFORCED' }, { id: 'T1', name: 'Tax reserve', rule: '30%', status: 'CHECK', detail: 'vault not set' }, { id: 'S0', name: 'Secrets shield', rule: 'x', status: 'ENFORCED' }];
  const L = S.policyLines(x({ policies: pol, env: (k) => ({ PAYOUT_WALLET_ADDRESS: '0x' + '2'.repeat(40) })[k] }));
  assert.match(L[0], /^ {2}✓ Profit floor/); assert.match(L[1], /^ {2}! Tax reserve: 30% — CHECK \(vault not set\)/);
  assert.ok(!L.some((l) => /Secrets shield/.test(l)), 'only the profit and success policies');
  assert.ok(L.some((l) => /verified from transaction receipts/.test(l))); assert.ok(L.some((l) => /✓ Payouts to your wallet 0x2222…/.test(l)));
  assert.ok(S.policyLines(x()).some((l) => /! Payouts to your wallet not set/.test(l)));
});

test('two successes for every failure: real events only, and a success push when short', async () => {
  const st = {}; const tasks = [];
  const delegate = async (k) => { tasks.push(k); return 'ok'; };
  const at = (h, o = {}) => x({ now: 1e12 + h * H, day: 'd1', ...o });
  S.balance(st, at(0, { incidents: { open: [{ problem: 'rpc slow' }] }, realcheck: { results: [{ id: 'a', status: 'pass' }] } }), { delegate });
  assert.deepStrictEqual([st.ledger.dayFailures, st.ledger.daySuccesses], [0, 0], 'what is already there when first seen is a baseline');
  let L = S.balance(st, at(1, { incidents: { open: [{ problem: 'rpc slow' }, { problem: 'feed down' }] }, realcheck: { results: [{ id: 'a', status: 'fail' }] }, today: { day: 'd1', reverted: 0 } }), { delegate });
  assert.deepStrictEqual([L.dayFailures, L.daySuccesses, L.short], [2, 0, 4]);
  assert.deepStrictEqual(tasks, ['research', 'scan-now', 'verify-real'], 'short of target: the success push runs (real checks rerun: one is failing)');
  L = S.balance(st, at(1.5, { incidents: { open: [{ problem: 'rpc slow' }, { problem: 'feed down' }] }, realcheck: { results: [{ id: 'a', status: 'fail' }] } }), { delegate });
  assert.strictEqual(tasks.length, 3, 'at most one push every 2 hours');
  L = S.balance(st, at(2, { incidents: { open: [] }, realcheck: { results: [{ id: 'a', status: 'pass' }] } }), { delegate, wins: ['★ New closest route'], road: ['✓ Step 2 verified: Contract v2'] });
  assert.deepStrictEqual([L.dayFailures, L.daySuccesses, L.short], [2, 5, -1], 'two incidents resolved, a check passing again, a win, a step verified');
  assert.match(S.ledgerLine(L), /today 5 successes for 2 failures · on target · in total 5 for 2/);
  L = S.balance(st, at(3, { incidents: { open: [] }, realcheck: { results: [{ id: 'a', status: 'pass' }] }, today: { day: 'd1', reverted: 2 } }), { delegate });
  assert.strictEqual(L.dayFailures, 4, 'two sends reverted since the last look: two failures');
  L = S.balance(st, at(4, { incidents: { open: [] }, realcheck: { results: [{ id: 'a', status: 'pass' }] }, today: { day: 'd1', reverted: 3 } }), { delegate, road: ['✗ Step 2 no longer holds'] });
  assert.deepStrictEqual([L.dayFailures, L.short], [6, 7]); assert.match(S.ledgerLine(L), /7 short: the VP is on a success push/);
  L = S.balance(st, at(30, { day: 'd2' }), { delegate }); assert.deepStrictEqual([L.dayFailures, L.daySuccesses, L.failures, L.successes], [0, 0, 6, 5], 'a new day starts fresh; totals are kept');
});
