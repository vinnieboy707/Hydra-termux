'use strict';
// Agents inside the engine: watchdog restarts, tuner proposals through approvals, and changes applied only within policy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Agents, validChange } = require('../lib/agents.cjs');
const { createDiagnoser } = require('../lib/agentllm.cjs');
const { readExecPolicy } = require('../lib/execpolicy.cjs');
const MODE = require('../lib/mode.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
function fakeSync(decisions = []) {
  const s = { enabled: true, rows: [], calls: [], enqueue(t, r) { s.rows.push([t, r]); },
    async call(name, payload) { s.calls.push([name, payload]); if (payload.op === 'list') return { ok: true, decisions: s.decisions }; return { ok: true }; }, decisions };
  return s;
}
function setup(envText = 'ARB_RPC_URL=https://node.example/key123\nEXEC_TIP_SHARE_BPS=5000\n') {
  const dir = tmp(); const envFile = path.join(dir, '.env'); fs.writeFileSync(envFile, envText, { mode: 0o600 });
  let t = Date.parse('2026-11-23T12:00:00Z');
  const sync = fakeSync(); const notes = [];
  const a = new Agents({ dataDir: dir, envFile, sync, notify: async (x) => notes.push(x), now: () => t });
  return { dir, envFile, sync, a, notes, tick: (ms) => { t += ms; }, now: () => t };
}
const today = (sent, reverted) => ({ day: MODE.utcDay(Date.now()), sent, reverted, netUsd: 0, gasUsd: 0, lossGasUsd: 0, consecutiveReverts: 0 });

test('agents may change only execution-policy settings, and only within their bounds', () => {
  for (const k of ['ARB_RPC_URL', 'CHRONOS_EXECUTOR_KMS_KEY', 'PAYOUT_WALLET_ADDRESS', 'MIN_NET_PROFIT_USD', 'OPENROUTER_API_KEY']) assert.ok(validChange(k, '1'), k);
  assert.ok(validChange('EXEC_TIP_SHARE_BPS', '9500'), 'above the max');
  assert.ok(validChange('MAX_DAILY_GAS_USD', '-1'));
  assert.strictEqual(validChange('EXEC_TIP_SHARE_BPS', '6000'), null);
});

test('tuner proposes only after ≥4 live sends with ≥50% reverted; the proposal waits for you and is not repeated', () => {
  const { a, sync, notes } = setup();
  const { policy } = readExecPolicy(() => undefined);
  assert.strictEqual(a.tune({ policy, today: today(3, 3) }), null, 'too few sends');
  assert.strictEqual(a.tune({ policy, today: today(10, 4) }), null, 'under half reverted');
  const ref = a.tune({ policy, today: today(6, 3) });
  assert.match(ref, /^[0-9a-f]{32}$/);
  const ap = sync.rows.find(([t]) => t === 'approvals')[1];
  assert.deepStrictEqual(Object.keys(ap).sort(), ['agent', 'detail', 'kind', 'ref', 'title']);
  assert.ok(!('status' in ap), 'the engine never sets a status');
  assert.match(ap.detail.change, /EXEC_TIP_SHARE_BPS: 5000 → 6000/);
  assert.strictEqual(a.tune({ policy, today: today(6, 3) }), null, 'same change not asked twice');
  assert.ok(notes.some((n) => /approval/.test(n.title)));
  assert.strictEqual(a.tune({ policy: { ...policy, EXEC_TIP_SHARE_BPS: 9000 }, today: today(6, 6) }), null, 'already at the bound');
});

test('decisions: approved → written to .env and engine restarts; denied → nothing; unknown refs are ignored', async () => {
  const { a, sync, envFile } = setup();
  const { policy } = readExecPolicy(() => undefined);
  const ref = a.tune({ policy, today: today(4, 2) });
  sync.decisions = [{ ref: 'f'.repeat(32), status: 'approved' }, { ref, status: 'approved' }];
  const done = await a.pollDecisions();
  assert.deepStrictEqual(done.map((d) => d.ref), [ref], 'a ref the engine did not create is never acted on');
  assert.match(fs.readFileSync(envFile, 'utf8'), /^EXEC_TIP_SHARE_BPS=6000$/m);
  assert.match(fs.readFileSync(envFile, 'utf8'), /^ARB_RPC_URL=https:\/\/node.example\/key123$/m, 'other lines untouched');
  assert.strictEqual(fs.statSync(envFile).mode & 0o777, 0o600);
  assert.strictEqual(a.wantRestart, 'setting changed');
  assert.ok(sync.calls.some(([, p]) => p.op === 'ack' && p.ref === ref && /^applied/.test(p.result)));
  assert.deepStrictEqual(await a.pollDecisions(), [], 'nothing pending: no second apply');

  const b = setup();
  const r2 = b.a.tune({ policy, today: today(4, 2) });
  b.sync.decisions = [{ ref: r2, status: 'denied' }];
  await b.a.pollDecisions();
  assert.match(fs.readFileSync(b.envFile, 'utf8'), /^EXEC_TIP_SHARE_BPS=5000$/m);
  assert.strictEqual(b.a.wantRestart, null);
});

test('decisions: a setting you changed meanwhile, or an expired proposal, is not applied', async () => {
  const { a, sync, envFile, tick } = setup();
  const { policy } = readExecPolicy(() => undefined);
  const ref = a.tune({ policy, today: today(4, 2) });
  fs.writeFileSync(envFile, 'EXEC_TIP_SHARE_BPS=7000\n', { mode: 0o600 });
  sync.decisions = [{ ref, status: 'approved' }];
  const [d] = await a.pollDecisions();
  assert.match(d.result, /not applied: EXEC_TIP_SHARE_BPS is now 7000/);
  assert.match(fs.readFileSync(envFile, 'utf8'), /=7000/);

  const b = setup();
  const r2 = b.a.tune({ policy, today: today(4, 2) });
  b.tick(25 * 3600000); b.sync.decisions = [{ ref: r2, status: 'approved' }];
  const [e] = await b.a.pollDecisions();
  assert.match(e.result, /expired/);
  assert.match(fs.readFileSync(b.envFile, 'utf8'), /=5000/);
});

test('watchdog restarts a stalled engine at most 3 times an hour, then escalates instead', () => {
  const { a, tick, now, notes } = setup();
  const S = () => ({ phase: 'running', paused: false, scanning: false, interval: 30, lastScanAt: now() - 11 * 60000 });
  assert.strictEqual(a.checkStall({ ...S(), lastScanAt: now() - 60000 }), null, 'recent scan');
  assert.strictEqual(a.checkStall({ ...S(), paused: true }), null, 'paused on purpose');
  for (let i = 0; i < 3; i++) { assert.strictEqual(a.checkStall(S()), 'restart'); tick(60000); }
  assert.strictEqual(a.checkStall(S()), null);
  assert.ok(notes.some((n) => /needs you/.test(n.title)));
  tick(3600000);
  assert.strictEqual(a.checkStall(S()), 'restart', 'budget refills after an hour');
});

test('watchdog records problems and resolutions; requirements are reported once a day with the owner fix', async () => {
  const { a, sync, tick } = setup();
  await a.observe({ fresh: [{ id: 'nodes-all', msg: 'no RPC node at https://node.example/key123' }], resolved: ['scan'] });
  const ev = sync.rows.filter(([t]) => t === 'agent_events').map(([, r]) => r);
  assert.strictEqual(ev[0].severity, 'critical');
  assert.ok(!ev[0].message.includes('key123'), 'node url redacted');
  assert.strictEqual(ev[1].outcome, 'fixed');
  const sh = { stage: 'preflight', failed: [{ name: 'executor is an operator', fix: 'owner: setOperator(0xabc, true)' }] };
  a.requirements(sh); a.requirements(sh);
  assert.strictEqual(sync.rows.filter(([, r]) => r.agent === 'requirements').length, 1);
  tick(25 * 3600000); a.requirements(sh);
  assert.strictEqual(sync.rows.filter(([, r]) => r.agent === 'requirements').length, 2);
});

test('AI diagnosis: off without a model; never sends node urls; result recorded, never executed', async () => {
  assert.strictEqual(createDiagnoser({ apiKey: 'k', model: '' }), null);
  assert.strictEqual(createDiagnoser({ apiKey: '', model: 'a/b' }), null);
  let sent;
  const fetchImpl = async (u, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '{"cause":"node rate-limited","fix":"add ARB_RPC_URL_2","confidence":"medium"}' } }] }) }; };
  const d = createDiagnoser({ apiKey: 'k', model: 'prov/model-1', fetchImpl, logTail: () => ['call to https://arb.example/SECRETKEY failed'] });
  const { a, sync } = setup();
  a.diagnose = d;
  await a.observe({ fresh: [{ id: 'scan-streak', msg: 'eth_call https://arb.example/SECRETKEY 429' }] });
  assert.ok(!JSON.stringify(sent).includes('SECRETKEY'));
  const diag = sync.rows.map(([, r]) => r).find((r) => r.agent === 'diagnosis');
  assert.strictEqual(diag.action, 'add ARB_RPC_URL_2');
  await a.observe({ fresh: [{ id: 'scan-streak', msg: 'again' }] });
  assert.strictEqual(sync.rows.filter(([, r]) => r.agent === 'diagnosis').length, 1, 'one diagnosis per problem per 6 h');
});

test('profit guard: after GUARD_MIN_SENDS live sends, a realized net ≤ $0 switches back to shadow for the day', () => {
  const { policy } = readExecPolicy(() => undefined);
  const base = { policy, goMinUsdPerDay: 5, maxDailyDrawdownUsd: 25, exec: { ready: true }, shadow: { runs: 10, sims: 8, wins: 6, winRate: 0.75, perDayUsd: 12, observedMin: 60 }, live: null };
  const live = MODE.evaluate(base); assert.strictEqual(live.mode, 'LIVE');
  const day = MODE.utcDay(Date.now());
  const mk = (sent, netUsd) => MODE.evaluate({ ...base, prev: live, live: { day, sent, netUsd, reverted: 0, gasUsd: 0, lossGasUsd: 0, consecutiveReverts: 0 } });
  assert.strictEqual(mk(4, -1).mode, 'LIVE', 'too few sends to judge');
  assert.strictEqual(mk(5, 0.5).mode, 'LIVE', 'making money');
  const m = mk(5, 0);
  assert.strictEqual(m.mode, 'SHADOW');
  assert.match(m.heldWhy, /profit guard/);
  assert.ok(new Date(m.heldUntil).toISOString().endsWith('T00:00:00.000Z'));
});
