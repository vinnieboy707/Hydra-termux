'use strict';
// The VP's standing team: seven agents, triggers on real state, allowlisted skills, a report each cycle, the VP's
// feedback (effective / back off / take over). Real counterpart: every skill is an action of the engine's incident
// resolver, run for real by the daemon (doAction refuses anything else), proven by test/resolver.test.cjs.
const test = require('node:test');
const assert = require('node:assert');
const { Team, AGENTS, lines } = require('../lib/team.cjs');
const { assess } = require('../lib/company.cjs');

const fresh = (o = {}) => ({ now: 0, lastScanAt: 0, interval: 20, res: null, today: { sent: 0, reverted: 0 }, policyFails: [], sync: { pending: 0 }, research: { at: new Date(0).toISOString() }, ...o });

test('eight standing agents, one per angle, every trigger with an allowlisted skill', () => {
  assert.deepStrictEqual(AGENTS.map((a) => a.id), ['sre', 'data', 'risk', 'trading', 'research', 'security', 'gas', 'treasury']);
  const ACTIONS = ['scan-now', 'failover-node', 'restart-feed', 'shadow-only', 'reduce-load', 'clear-market-cache'];
  for (const a of AGENTS) for (const t of a.triggers) assert.ok(t.skill === 'escalate' || ['verify-real', 'flush-sync', 'research'].includes(t.skill) || ACTIONS.includes(t.skill.slice(4)), `${a.id}:${t.id} → ${t.skill}`);
});

test('an agent acts on its trigger, reports, and the VP scores it: effective when cleared; backs off, then is taken over when not', async () => {
  let t = 1e9; const st = {}; const team = new Team(st, () => t); const acts = []; const told = [];
  const d = { act: async (n) => { acts.push(n); return 'done ' + n; }, task: async (n) => { acts.push(n); return 'done ' + n; }, tell: (a, b) => told.push(a) };
  const stale = (now) => fresh({ now, lastScanAt: now - 10 * 60000, research: { at: new Date(now).toISOString() } });
  let r = await team.run(stale(t), assess(stale(t)), d);
  assert.deepStrictEqual(acts, ['scan-now']); assert.strictEqual(r.reports[0].fired[0].trigger, 'scans-stale');
  // cleared by the next cycle → effective
  t += 3 * 60000; const ok = fresh({ now: t, lastScanAt: t - 5000, research: { at: new Date(t).toISOString() } });
  r = await team.run(ok, assess(ok), d); assert.strictEqual(st.team['sre:scans-stale'].effective, 1); assert.strictEqual(r.reports[0].score.rate, 100);
  // never cleared: each retry waits twice as long (2, 4, 8 min) and the third ineffective run hands it to the VP
  acts.length = 0; let takeover = null;
  for (let i = 0; i < 40 && !takeover; i++) { t += 60000; r = await team.run(stale(t), assess(stale(t)), d); if (r.takeovers.length) takeover = r.takeovers[0]; }
  assert.deepStrictEqual([takeover.agent, takeover.trigger], ['sre', 'scans-stale']);
  assert.ok(acts.length <= 4, `backed off instead of hammering (${acts.length} runs)`); assert.ok(st.team['sre:scans-stale'].back >= 8);
});

test('risk stops sending at once on reverts in LIVE and tells you; nothing Chronos may not do is ever done', async () => {
  const st = {}; const team = new Team(st, () => 1e9); const acts = []; const told = [];
  const x = fresh({ now: 1e9, lastScanAt: 1e9, mode: 'LIVE', today: { sent: 3, reverted: 2 }, research: { at: new Date(1e9).toISOString() } });
  const r = await team.run(x, assess(x), { act: async (n) => { acts.push(n); return 'ok'; }, task: async () => 'ok', tell: (a) => told.push(a) });
  assert.deepStrictEqual(acts, ['shadow-only']); assert.ok(told.some((x2) => /Risk: reverts/.test(x2)));
  assert.match(lines(r).join('\n'), /Risk: .*acted: reverts → shadow-only/);
});
