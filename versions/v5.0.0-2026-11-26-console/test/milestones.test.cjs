'use strict';
// The road to cash: every milestone verified from its real source, the VP notifying you of each verified step (with
// evidence), of any step that stops holding, and of your own steps until they are done (every few hours, outside quiet
// hours). Real counterparts: the chain reads (contractinfo, executor readiness), receipts (realized) and your real checks
// (verify-real) that feed these inputs in the running engine; test/counterparts.json pairs them.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../lib/milestones.cjs');
const HOUR = 3600000;
const A = '0x' + '1'.repeat(40);

const base = (o = {}) => ({ now: 1e12, lastScanAt: 1e12 - 30000, res: { blockNumber: 527000000 }, contractInfo: null, realcheck: null, execInfo: null, shadowWins: 0, ...o, env: (k) => (o.env || {})[k] });
const R0 = (o = {}) => ({ data: { kpis: { databaseDown: false } }, trading: { kpis: { approved: 0, bestNetUsd: -1.2, topBlocker: 'gas' } }, risk: { kpis: { mode: 'SHADOW' } }, treasury: { kpis: { realizedNetUsdAllTime: 0 } }, ...o });

test('each milestone is verified from its real source, never from a flag', () => {
  let l = M.evaluate(base(), R0());
  assert.deepStrictEqual(l.map((m) => m.done), [true, false, false, false, false, false, false, false]);
  assert.match(l[0].evidence, /block 527000000/);
  l = M.evaluate(base({ env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 1 } }), R0());
  assert.strictEqual(l[1].done, false, 'a v1 contract is not v2');
  l = M.evaluate(base({ env: { CONTRACT_ADDRESS: A }, contractInfo: { kind: 2, vault: 'x', factoriesAllowed: 6 } }), R0());
  assert.strictEqual(l[1].done, false, 'only your own CHRONOS_FLASH_ARB_ADDRESS counts');
  l = M.evaluate(base({ env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, vault: 'x', factoriesAllowed: 6 }, realcheck: { at: 't', results: [{ id: 'contract-deployed', status: 'pass' }, { id: 'kms-signer', status: 'not run' }] }, execInfo: { ready: true, address: A, gasEth: 0.0123 } }), R0());
  assert.deepStrictEqual(l.slice(1, 4).map((m) => m.done), [true, true, true]);
  assert.match(l[3].evidence, /operator with 0\.0123 ETH/);
  l = M.evaluate(base({ realcheck: { results: [{ id: 'contract-deployed', status: 'fail' }] } }), R0());
  assert.match(l[2].todo, /failing: contract-deployed/);
  assert.strictEqual(M.evaluate(base({ lastScanAt: 1e12 - 11 * 60000 }), R0())[0].done, false, 'a stale engine is not running');
  assert.strictEqual(M.evaluate(base(), R0({ treasury: { kpis: { realizedNetUsdAllTime: 3.2 } } }))[7].done, true);
});

test('the VP notifies each verified step once, with evidence and the next step', async () => {
  const st = {}; const got = [];
  const notify = (level, title, text) => got.push({ level, title, text });
  await M.drive(st, base(), R0(), { notify, localHour: 12 });
  assert.match(got[0].title, /^✓ Step 1 verified: The engine runs/); assert.match(got[0].text, /Next, step 2: Contract v2 deployed and yours \(yours: In Termux: chronos mainnet/);
  assert.match(got[1].title, /^Step 2 needs you: Contract v2/); assert.match(got[1].text, /chronos mainnet {2}→ type YES/);
  got.length = 0; await M.drive(st, base(), R0(), { notify, localHour: 12 });
  assert.strictEqual(got.length, 0, 'nothing repeats inside the reminder interval');
});

test('your step is repeated every few hours, outside quiet hours, saying how long it has waited, until verified', async () => {
  const st = {}; const got = []; const notify = (level, title, text) => got.push({ level, title, text });
  const at = (h) => base({ now: 1e12 + h * HOUR, lastScanAt: 1e12 + h * HOUR - 1000 });
  await M.drive(st, at(0), R0(), { notify, localHour: 12, nudgeHours: 3 });
  got.length = 0;
  await M.drive(st, at(2), R0(), { notify, localHour: 14, nudgeHours: 3 }); assert.strictEqual(got.length, 0);
  await M.drive(st, at(3), R0(), { notify, localHour: 15, nudgeHours: 3 }); assert.match(got[0].text, /^Waiting 3 h \(reminder 2\)/);
  got.length = 0; await M.drive(st, at(9), R0(), { notify, localHour: 23, nudgeHours: 3 }); assert.strictEqual(got.length, 0, 'quiet at 23:00');
  await M.drive(st, at(10), R0(), { notify, localHour: 8, nudgeHours: 3 }); assert.strictEqual(got[0].level, 'critical', 'third reminder escalates'); assert.match(got[0].text, /Waiting 10 h \(reminder 3\)/);
  got.length = 0;
  const done = base({ now: 1e12 + 11 * HOUR, lastScanAt: 1e12 + 11 * HOUR, env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, vault: 'v', factoriesAllowed: 6 } });
  await M.drive(st, done, R0(), { notify, localHour: 9 });
  assert.match(got[0].title, /^✓ Step 2 verified: Contract v2/); assert.match(got[0].text, /read on chain: 0x1{40} is ChronosFlashArbV2/);
  assert.ok(!st.nudged['contract-v2'], 'reminders stop once verified');
});

test('a verified step that stops holding is reported at once and worked on again', async () => {
  const st = {}; const got = []; const notify = (level, title, text) => got.push({ level, title });
  await M.drive(st, base(), R0(), { notify, localHour: 12 });
  got.length = 0;
  await M.drive(st, base({ lastScanAt: 1e12 - 20 * 60000 }), R0(), { notify, localHour: 12 });
  assert.strictEqual(got[0].level, 'critical'); assert.match(got[0].title, /^✗ Step 1 no longer holds/);
});

test('Chronos pushes its own steps (real checks failing → verify-real is rerun) and money is a money alert', async () => {
  const tasks = []; const got = [];
  const x = base({ env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, factoriesAllowed: 6 }, realcheck: { results: [{ id: 'contract-deployed', status: 'fail' }] } });
  await M.drive({}, x, R0(), { notify: (l, t) => got.push(t), delegate: async (k) => tasks.push(k), localHour: 12 });
  assert.deepStrictEqual(tasks, ['verify-real']);
  assert.ok(!got.some((t) => /needs you/.test(t)), 'a step that is Chronos\'s own is not put on you');
  const lv = []; const all = base({ env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, factoriesAllowed: 6 }, realcheck: { at: 't', results: [{ id: 'contract-deployed', status: 'pass' }] }, execInfo: { ready: true, gasEth: 0.01 }, shadowWins: 2 });
  await M.drive({}, all, R0({ trading: { kpis: { approved: 1, bestNetUsd: 2 } }, risk: { kpis: { mode: 'LIVE' } }, treasury: { kpis: { realizedNetUsdAllTime: 4 } } }), { notify: (l, t) => lv.push([l, t]), localHour: 12 });
  assert.deepStrictEqual(lv.find(([, t]) => /Step 8/.test(t))[0], 'money');
});

test('quiet hours wrap midnight; the report lines mark verified, current and waiting steps', () => {
  assert.ok(M.quiet('21-08', 23)); assert.ok(M.quiet('21-08', 3)); assert.ok(!M.quiet('21-08', 8)); assert.ok(!M.quiet('21-08', 20)); assert.ok(M.quiet('1-5', 2)); assert.ok(!M.quiet('x', 2));
  const L = M.lines(M.evaluate(base(), R0()));
  assert.match(L[0], /^ROAD TO CASH: 1\/8 verified · now step 2 \(version 3\.0\): Contract v2 deployed and yours · YOURS: /);
  assert.match(L[1], /^ {2}✓ 1\./); assert.match(L[2], /^ {2}▶ 2\./); assert.match(L[3], /^ {2}· 3\./);
});

test('each verified step says how long it took, the next step\'s clock starts, and profit so far from receipts', async () => {
  const st = {}; const got = []; const notify = (level, title, text) => got.push({ title, text });
  await M.drive(st, base(), R0(), { notify, localHour: 12 });
  got.length = 0;
  const later = base({ now: 1e12 + 5 * HOUR, lastScanAt: 1e12 + 5 * HOUR, env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, vault: 'v', factoriesAllowed: 6 } });
  const R = R0({ treasury: { kpis: { realizedNetUsdAllTime: 1.5, netUsdLast24h: 0.5, tradesLast24h: 2, taxReserveUsd: 0.45 } } });
  const o = await M.drive(st, later, R, { notify, localHour: 12 });
  const v = got.find((g) => /^✓ Step 2/.test(g.title));
  assert.match(v.text, /3 of 8 verified\. Took 5 h\./); // step 8, profit from receipts, also holds in this rig
  assert.match(v.text, /Next, step 3: Every real check passes against Arbitrum One \(Chronos is on it\); its clock starts now\./);
  assert.match(v.text, /Profit verified from receipts: \$1\.50 all time · \$0\.50 in 24 h \(2 trades\) · \$0\.45 for your tax reserve\./);
  assert.strictEqual(o.list[1].tookMs, 5 * HOUR); assert.strictEqual(o.list[2].runningMs, 0);
  const o2 = await M.drive(st, base({ ...later, now: later.now + 2 * HOUR, lastScanAt: later.now + 2 * HOUR, env: { CHRONOS_FLASH_ARB_ADDRESS: A }, contractInfo: { kind: 2, factoriesAllowed: 6 } }), R, { notify, localHour: 12 });
  assert.strictEqual(o2.list[2].runningMs, 2 * HOUR);
  assert.match(M.lines(o2.list)[0], /now step 3 \(version 3\.0\) \(2 h so far\)/);
  assert.match(M.lines(o2.list)[2], /2\. Contract v2 deployed and yours \[v3\.0\] \(took 5 h\)/);
  assert.match(M.profit(R0()), /\$0\.00 all time · \$0\.00 in 24 h \(0 trades\)$/, 'no profit yet is shown as $0.00, never invented');
});
