'use strict';
// The company: departments report from real state; the VP runs experiments toward profit one at a time, verifies each
// and reverts what hurt, never repeats one, respects its authority (full until the first profit, then limits only) and
// risk's veto; you get only three kinds of immediate alert (database down, money lost, money made) and one daily report.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Company, allowed, assess, experiments } = require('../lib/company.cjs');

const H = 3600000;
function rig({ reportAt = '07:30', start = Date.parse('2026-11-24T20:00:00Z') } = {}) {
  let t = start; const env = { MIN_NET_PROFIT_USD: '0.35' }; const applied = []; const alerts = []; const journal = []; const delegated = [];
  const c = new Company({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'co-')), now: () => t, reportAt, verifyMs: 2 * H, minGapMs: 2 * H,
    applyEnv: (k, v) => { env[k] = String(v); applied.push([k, String(v)]); return 'applied'; },
    delegate: async (task) => { delegated.push(task); return 'done ' + task; },
    alert: (level, title) => alerts.push({ level, title }), report: (kind, e) => journal.push({ kind, ...e }) });
  return { c, env, applied, alerts, journal, delegated, adv: (ms) => { t += ms; }, now: () => t };
}
const blockedByFloor = (best) => ({ approved: 0, indicators: { cycles: { checked: 1000, pricesAllow: 10, approved: 0 }, best: { netUsd: best }, raw: { grossPositive: 4 }, blockedBy: [{ filter: 'profit floor', routes: 3, onlyThis: 2, bestNetIfOnlyThis: best }], breakEven: { gasGwei: 0.01 } } });
const base = (o = {}) => ({ res: blockedByFloor(0.12), lastScanAt: Date.now(), interval: 20, mode: 'SHADOW', policyFails: [], today: { day: 'd', sent: 0, reverted: 0, gasUsd: 0, lossGasUsd: 0 }, realized: { executions: [], totalNetUsd: 0, totalGasUsd: 0 }, sync: { pending: 0, failures: 0, lastOk: Date.now() }, integrity: { ok: true, foreign: [] }, shadowWins: 0, ...o });

test('VP authority: full control covers trading settings in their safe range; limits only after profit; never funds or keys', () => {
  assert.strictEqual(allowed('MIN_NET_PROFIT_USD', 0.1, 'full'), null);
  assert.match(allowed('MIN_NET_PROFIT_USD', 0.001, 'full'), /safe range/);
  assert.match(allowed('MIN_NET_PROFIT_USD', 0.1, 'limits'), /needs your approval/);
  assert.strictEqual(allowed('PROMOTE_MIN_WINS', 1, 'limits'), null, 'execution limits stay within the VP\'s authority');
  for (const k of ['PAYOUT_WALLET_ADDRESS', 'TAX_RESERVE_VAULT', 'PRIVATE_KEY', 'CHRONOS_EXECUTOR_KMS_KEY', 'CHRONOS_FLASH_ARB_ADDRESS']) assert.match(allowed(k, 'x', 'full'), /outside the VP/);
});

test('the VP unblocks profit: one experiment, verified after the window, kept when progress holds, never repeated', async () => {
  const r = rig();
  const o = await r.c.tick(base());
  assert.deepStrictEqual(r.applied, [['MIN_NET_PROFIT_USD', '0.1']], 'floor lowered toward the best blocked route (90%)');
  assert.match(o.decided.why, /blocked only by the profit floor/);
  await r.c.tick(base()); assert.strictEqual(r.applied.length, 1, 'nothing else while the change is being verified');
  r.adv(2 * H + 1);
  const v = await r.c.tick(base({ res: { approved: 2, indicators: { ...blockedByFloor(0.12).indicators, cycles: { checked: 1000, pricesAllow: 10, approved: 2 }, blockedBy: [] } } }));
  assert.deepStrictEqual(v.verified, { key: 'MIN_NET_PROFIT_USD', kept: true });
  assert.ok(r.journal.some((j) => j.kind === 'verification' && j.outcome === 'kept'));
  r.adv(3 * H); await r.c.tick(base());
  assert.ok(!r.applied.slice(1).some(([k, v]) => k === 'MIN_NET_PROFIT_USD' && v === '0.1'), 'never the same change twice');
});

test('a change that hurts is reverted; risk vetoes changes while it is red', async () => {
  const r = rig();
  await r.c.tick(base({ shadowWins: 0 }));
  r.adv(2 * H + 1);
  await r.c.tick(base({ policyFails: [{ id: 'G1', detail: 'stale quotes' }], res: blockedByFloor(0.12) }));
  assert.deepStrictEqual(r.applied.at(-1), ['MIN_NET_PROFIT_USD', '0.35'], 'reverted to where it was');
  assert.ok(r.journal.some((j) => j.kind === 'verification' && j.outcome === 'reverted' && /risk turned red/.test(j.why)));
  const s = rig(); await s.c.tick(base({ policyFails: [{ id: 'G1', detail: 'x' }] }));
  assert.deepStrictEqual(s.applied, []); assert.ok(s.journal.some((j) => j.outcome === 'vetoed'));
});

test('immediate alerts: money made, money lost, the database down, and the road to cash; first profit ends full control', async () => {
  const r = rig();
  await r.c.tick(base());
  const road = (a) => /^(✓ Step \d|✗ Step \d|Step \d needs you)/.test(a.title);
  assert.deepStrictEqual(r.alerts.filter((a) => a.level !== 'report' && !road(a)), [], 'a normal day: the daily report and road-to-cash notices only');
  const won = { executions: [{ txHash: '0x' + 'a'.repeat(64), netUsd: 0.42 }], totalNetUsd: 0.42, totalGasUsd: 0.01 };
  await r.c.tick(base({ realized: won }));
  assert.ok(r.alerts.some((a) => a.level === 'money' && /Made \$0\.42/.test(a.title)));
  assert.ok(r.alerts.some((a) => /First verified profit/.test(a.title)));
  assert.strictEqual(r.c.status().authority, 'limits');
  await r.c.tick(base({ realized: won })); assert.strictEqual(r.alerts.filter((a) => /Made/.test(a.title)).length, 1, 'each trade alerts once');
  await r.c.tick(base({ realized: won, today: { day: 'd', sent: 2, reverted: 1, gasUsd: 0.02, lossGasUsd: 0.02 } }));
  assert.ok(r.alerts.some((a) => a.level === 'critical' && /Lost/.test(a.title)));
  await r.c.tick(base({ realized: won, sync: { pending: 10, failures: 6, lastOk: r.now() - 20 * 60000 } }));
  assert.ok(r.alerts.some((a) => a.level === 'critical' && /database unreachable/.test(a.title)));
});

test('daily report once a day at the report time, with cash flow, decisions and what needs you', async () => {
  const r = rig({ reportAt: '12:00', start: Date.parse('2026-11-24T19:00:00Z') }); // 11:00 Pacific
  await r.c.tick(base()); assert.ok(!r.journal.some((j) => j.kind === 'daily-report'));
  r.adv(H + 60000); const o = await r.c.tick(base());
  assert.ok(o.daily && /CASH FLOW/.test(o.daily.text) && /VP DECISIONS/.test(o.daily.text) && /NEEDS YOU/.test(o.daily.text));
  assert.ok(r.alerts.some((a) => a.level === 'report'));
  r.adv(H); await r.c.tick(base()); assert.strictEqual(r.journal.filter((j) => j.kind === 'daily-report').length, 1);
});

test('the VP keeps delegating until profit: research, sync, build requests, real checks', async () => {
  const r = rig();
  await r.c.tick(base({ sync: { pending: 300, failures: 0, lastOk: Date.now() } }));
  assert.deepStrictEqual(r.delegated.sort(), ['audit', 'build-request', 'flush-sync', 'research', 'verify-real'], 'and one audit after those tasks');
  await r.c.tick(base()); assert.strictEqual(r.delegated.length, 5, 'each at most once per its interval');
  r.adv(13 * H); await r.c.tick(base()); assert.ok(r.delegated.filter((x) => x === 'build-request').length === 2);
});

test('departments report from real state', () => {
  const R = assess({ ...base({ scanError: 'timeout' }), now: Date.now(), lastScanAt: Date.now() - 10 * 60000 });
  assert.strictEqual(R.trading.status, 'red'); assert.match(R.trading.notes.join(), /stale|failed/);
  assert.strictEqual(experiments(base(), assess({ ...base(), now: Date.now() }), () => undefined)[0].key, 'MIN_NET_PROFIT_USD');
});

test('the charter is hard-coded and drives the cadence and the daily report', async () => {
  const { VP_CHARTER } = require('../lib/company.cjs');
  assert.ok(Object.isFrozen(VP_CHARTER) && Object.isFrozen(VP_CHARTER.objectives) && Object.isFrozen(VP_CHARTER.cadence));
  assert.throws(() => { 'use strict'; VP_CHARTER.mission = 'stop'; }, TypeError);
  const r = rig();
  const o = await r.c.tick(base());
  assert.match(o.daily.text, /VP mission: Continuously improve Chronos/);
  assert.match(o.daily.text, /Working on objective 2 of 7: Get the contract deployed/);
});

test('an ongoing problem alerts once, not on every cycle', async () => {
  const r = rig();
  const down = { sync: { pending: 10, failures: 6, lastOk: r.now() - 20 * 60000 } };
  await r.c.tick(base(down)); r.adv(30000); await r.c.tick(base(down)); r.adv(30000); await r.c.tick(base(down));
  assert.strictEqual(r.alerts.filter((a) => /database unreachable/.test(a.title)).length, 1);
});

test('SRE runs the real checks once a day; a failed real check is in the report and keeps SRE amber', async () => {
  const r = rig();
  await r.c.tick(base());
  assert.strictEqual(r.delegated.filter((t) => t === 'verify-real').length, 1, 'first run: no real check yet → run it');
  r.adv(H); await r.c.tick(base({ realcheck: null }));
  assert.strictEqual(r.delegated.filter((t) => t === 'verify-real').length, 1, 'not again within a day');
  const fresh = { at: new Date(r.now()).toISOString(), results: [{ id: 'rpc-is-arbitrum', status: 'pass' }, { id: 'contract-v2-probe', status: 'fail', detail: '11/12' }, { id: 'kms-signer', status: 'not run' }] };
  const R = assess({ ...base({ realcheck: fresh }), now: r.now() });
  assert.strictEqual(R.sre.status, 'amber');
  assert.deepStrictEqual(R.sre.kpis.realChecks, { pass: 1, fail: 1, notRun: 1, failed: ['contract-v2-probe'], ageHours: 0 });
  assert.ok(R.sre.notes.some((n) => /real check failed: contract-v2-probe: 11\/12/.test(n)));
  const ok = assess({ ...base({ realcheck: { ...fresh, results: fresh.results.filter((x) => x.status !== 'fail') } }), now: r.now() });
  assert.strictEqual(ok.sre.status, 'green', 'not run is not a failure');
  r.adv(25 * H); await r.c.tick(base({ realcheck: fresh }));
  assert.strictEqual(r.delegated.filter((t) => t === 'verify-real').length, 2, 'a day later: run again');
  assert.ok(r.journal.some((j) => j.kind === 'delegation' && j.task === 'verify-real' && j.to === 'sre'));
  const daily = r.journal.filter((j) => j.kind === 'daily-report').pop();
  assert.ok(daily && /REAL CHECKS: 1 pass · 1 fail · 1 not run · 25 h old · failed: contract-v2-probe/.test(daily.text), 'in the daily report');
});


test('after every completed task the VP audits (your checks + Blockscout) and reassesses the next step; never skipped, at most one per 30 min', async () => {
  const r = rig(); const calls = [];
  r.c.delegate = async (task, extra) => { r.delegated.push(task); if (task !== 'audit') return 'done ' + task;
    calls.push(extra.after); return { checks: [{ id: 'chain-head', status: 'pass', detail: 'ok' }, { id: 'profits-confirmed', status: calls.length === 1 ? 'fail' : 'pass', detail: 'x' }], pass: 1, fail: calls.length === 1 ? 1 : 0, line: 'Audit after … NEXT step 2 (yours): Contract v2 deployed' }; };
  const o = await r.c.tick(base());
  assert.strictEqual(calls.length, 1, 'the delegations of this cycle queued one audit');
  assert.ok(calls[0].includes('verify-real') && calls[0].includes('research'), 'it names what it audits after');
  assert.ok(o.audit && o.audit.fail === 1);
  assert.ok(r.alerts.some((a) => a.level === 'critical' && /Audit: 1 problem/.test(a.title)), 'a failing audit reaches the phone at once');
  assert.ok(r.journal.some((e) => e.kind === 'verification' && e.outcome === 'needs attention'), 'journaled');
  // a VP change 10 min later: queued, not lost; audited once the 30 min gap has passed (state survives a restart)
  r.adv(10 * 60000); await r.c.tick(base({ sync: { pending: 300, failures: 0, lastOk: Date.now() } }));
  r.adv(2 * H); r.c.st.lastDecisionAt = 0;
  await r.c.tick(base()); // the floor experiment's verification window etc.
  assert.strictEqual(calls.length, 2, 'the queued work was audited after the gap');
  assert.ok(r.alerts.some((a) => a.level === 'audit' && a.title === 'Audit: clean'));
  // nothing done → no audit
  const before = calls.length; r.adv(H); r.c.st.auditQueue = []; r.c.st.delegations = Object.fromEntries(Object.keys(r.c.st.delegations).map((k) => [k, Date.now() + 10 * H]));
  const quiet = await r.c.tick(base()); if (!quiet.decided && !quiet.verified && !quiet.delegated.length) assert.strictEqual(calls.length, before, 'no task, no audit');
});

test('work finished inside the audit gap is kept and audited once the gap ends, even if nothing else happens', async () => {
  const r = rig(); const calls = [];
  r.c.delegate = async (task, extra) => { if (task === 'audit') { calls.push(extra.after); return { checks: [], pass: 0, fail: 0, line: 'ok' }; } return 'done ' + task; };
  r.c.st.lastAuditAt = r.now(); r.c.st.lastDecisionAt = r.now(); // an audit just ran; no VP change due
  await r.c.tick(base()); // research, build request, real checks: done inside the gap
  assert.strictEqual(calls.length, 0, 'not audited inside the gap');
  const queued = r.c.st.auditQueue.slice(); assert.ok(queued.includes('research'));
  r.adv(31 * 60000); await r.c.tick(base()); // nothing new is due now
  assert.strictEqual(calls.length, 1); assert.deepStrictEqual(calls[0], queued, 'the earlier work is what gets audited');
});


test('after a failing audit the VP opens a fix cell; the cell works, self-checks, submits; the next audit decides acceptance by effectiveness', async () => {
  const { Mind } = require('../lib/mind.cjs');
  let t = Date.parse('2026-11-24T20:00:00Z'); const mind = new Mind({ now: () => t }); let fail = true; const asked = [];
  const c = new Company({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'co-')), now: () => t, mind, applyEnv: () => 'applied', alert: () => {}, report: () => {},
    delegate: async (task, extra) => {
      if (task === 'audit') return { checks: [{ id: 'multicall3', status: fail ? 'fail' : 'pass', detail: 'node refused' }], pass: fail ? 0 : 1, fail: fail ? 1 : 0, line: 'audit', next: { step: fail ? 0 : 2, owner: fail ? 'chronos' : 'you', title: 'x', todo: 'y' } };
      if (task === 'analyse') { asked.push(extra.question); return { answer: { cause: 'The node caps eth_call gas below the batch', evidence: ['multicall3 fail: node refused'], next: [{ step: `lower QUOTE_BATCH_MAX to ${200 - 50 * asked.length}`, owner: 'chronos', profitEffect: 'quotes work again' }], confidence: 'medium' }, used: ['run_check'], via: 'K' }; } // a new fix each attempt
      return 'done';
    } });
  const o1 = await c.tick(base());
  assert.deepStrictEqual(o1.cells.opened, ['fix:multicall3']); assert.deepStrictEqual(o1.cells.submitted, ['fix:multicall3'], 'worked, passed its own check, submitted');
  assert.match(asked[0], /Your task \(cell fix:multicall3\)/);
  assert.strictEqual(mind.cell('fix:multicall3').state, 'submitted', 'waits for the next audit to prove it works');
  // next audit: still failing → rejected, back to work (with the reason in its next question)
  t += 61 * 60000; c.st.auditQueue = ['research'];
  const o2 = await c.tick(base());
  assert.deepStrictEqual(o2.cells.rejected.slice(0, 1), ['fix:multicall3']); assert.match(asked[1] || '', /rejected by the VP: not effective: multicall3 still failing/);
  // fixed: the next audit passes → accepted → collapsed
  fail = false; t += 61 * 60000; c.st.auditQueue = ['research'];
  const o3 = await c.tick(base());
  assert.deepStrictEqual(o3.cells.accepted, ['fix:multicall3']); assert.strictEqual(mind.cell('fix:multicall3'), null);
  // a cell that repeats a rejected answer is rejected on quality at once
  const m2 = new Mind({ now: () => t }); m2.openCell('fix:a', 'Fix a'); m2.submit('fix:a', 'same', { passed: true }); m2.review('fix:a', { accept: false, why: 'x' });
  assert.strictEqual(m2.cell('fix:a').rejections[0].work, 'same');
});
