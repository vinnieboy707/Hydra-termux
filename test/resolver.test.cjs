'use strict';
// Incident resolver: researched resolutions in order, each verified, never repeated; the AI agent may only pick
// allowlisted, untried actions; exhausted or recurring problems escalate to you; error log lines open incidents; the
// webhook is signed and redacted; websocket swap events reach the engine; assist --fix verifies each terminal step.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const R = require('../lib/resolver.cjs');
const AS = require('../lib/assist.cjs');

function rig({ agent = null } = {}) {
  let t = 1_700_000_000_000; const acts = []; const reports = [];
  const r = new R.Resolver({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'res-')), act: async (a) => { acts.push(a); return 'did ' + a; }, agent, report: (k, p) => reports.push({ k, ...p }), now: () => t, verifyMs: 1000 });
  return { r, acts, reports, adv: (ms) => { t += ms; } };
}
const scanErr = [{ id: 'scan', msg: 'last scan failed: timeout' }];

test('every problem the resolver handles has a guide entry; every ladder step is an allowlisted action', () => {
  const rows = AS.guide();
  for (const [k, p] of Object.entries(R.PROBLEMS)) {
    assert.ok(rows.find((x) => x.symptom === p.symptom), `guide row for ${k}`);
    for (const a of p.ladder) assert.ok(R.ACTIONS[a], `${k}: ${a} is allowlisted`);
    assert.ok(p.you, `${k} says what you can do`);
  }
});

test('researched resolutions run in order, one at a time, each verified; never the same one twice; then escalation', async () => {
  const { r, acts, reports, adv } = rig();
  const ladder = R.PROBLEMS['scan-error'].ladder;
  for (let i = 0; i < ladder.length; i++) {
    const s = await r.tick(scanErr); assert.deepStrictEqual([s.started, s.action], ['scan-error', ladder[i]]);
    assert.deepStrictEqual(await r.tick(scanErr), { waiting: 'scan-error', action: ladder[i] }, 'waits for verification before anything else');
    adv(1001);
  }
  await r.tick(scanErr);
  assert.deepStrictEqual(acts, ladder, 'each once, in order');
  assert.strictEqual(reports.filter((x) => x.k === 'attempt' && x.outcome === 'failed').length, ladder.length, 'each verified as not working');
  const esc = reports.find((x) => x.k === 'escalated');
  assert.ok(esc && /every researched resolution was tried/.test(esc.why) && esc.you);
  await r.tick(scanErr); adv(5000); await r.tick(scanErr);
  assert.strictEqual(acts.length, ladder.length, 'nothing repeated after escalation');
});

test('a resolution that works is verified and recorded; the incident closes', async () => {
  const { r, reports, adv } = rig();
  await r.tick(scanErr); adv(1001);
  await r.tick([]); // problem gone after the first resolution
  const ok = reports.find((x) => x.k === 'resolved');
  assert.ok(ok && ok.how === R.PROBLEMS['scan-error'].ladder[0]);
  assert.ok(reports.some((x) => x.k === 'attempt' && x.outcome === 'resolved' && /did reinit/.test(x.evidence)));
  assert.deepStrictEqual(r.summary().open, []);
});

test('a problem that keeps coming back is escalated instead of looping', async () => {
  const { r, acts, reports, adv } = rig();
  for (let i = 0; i < 3; i++) { await r.tick(scanErr); adv(1001); await r.tick([]); adv(1001); }
  const before = acts.length;
  await r.tick(scanErr);
  assert.ok(reports.some((x) => x.k === 'escalated' && /came back 3 times/.test(x.why)));
  assert.strictEqual(acts.length, before, 'no new attempt for a recurring problem');
});

test('AI agent: only allowlisted, untried actions are accepted; anything else escalates', async () => {
  const calls = [];
  const agent = async (q) => { calls.push(q); return calls.length === 1 ? { action: 'prune-logs', reason: 'disk pressure in evidence' } : { action: 'rm -rf /', reason: 'x' }; };
  const { r, acts, reports, adv } = rig({ agent });
  const p = [{ id: 'venues', msg: 'no executable venue passed its on-chain check' }];
  for (let i = 0; i < 10; i++) { await r.tick(p); adv(1001); }
  const ladder = R.PROBLEMS.venues.ladder;
  assert.deepStrictEqual(acts, [...ladder, 'prune-logs'], 'guide first, then the agent\'s allowlisted pick');
  assert.ok(calls[0].allowed.every((a) => R.ACTIONS[a.action] && !ladder.includes(a.action)), 'the agent only sees untried allowlisted actions');
  assert.ok(reports.some((x) => x.k === 'attempt' && /^AI agent: disk pressure/.test(x.by || '')));
  assert.ok(reports.some((x) => x.k === 'escalated'), 'a non-allowlisted pick is refused and escalates');
});

test('error log lines open incidents (and ordinary lines do not)', async () => {
  assert.strictEqual(R.classify('scan error request timeout after 30000 ms'), 'rpc-unreachable');
  assert.strictEqual(R.classify('quote failed: 429 Too Many Requests'), 'rpc-rate-limit');
  assert.strictEqual(R.classify('send failed: insufficient funds for gas'), 'executor-gas');
  assert.strictEqual(R.classify('block feed 1 down (connection closed); retry in 1 s'), 'feed-down');
  assert.strictEqual(R.classify('scan 12 · 800 pools · 2100 ms'), null);
  const { r, acts, reports } = rig();
  r.trip('scan error ECONNRESET https://secret.example/key-abc');
  await r.tick([]);
  assert.strictEqual(acts[0], R.PROBLEMS['rpc-unreachable'].ladder[0]);
  assert.ok(!JSON.stringify(reports).includes('secret.example/key-abc'), 'urls are redacted');
  // gated problems go straight to you
  const g = rig(); g.r.trip('send failed: insufficient funds'); await g.r.tick([]);
  assert.ok(g.reports.some((x) => x.k === 'escalated' && /only you/.test(x.why)) && !g.acts.length);
});

test('webhook: https only, signed over timestamp.body, redacted, no duplicates within a minute', async () => {
  const { createWebhook } = require('../lib/webhook.cjs');
  assert.strictEqual(createWebhook({ url: 'http://insecure.example/x' }), null);
  const sent = []; let t = 1_700_000_000_000;
  const w = createWebhook({ url: 'https://hooks.example/x', secret: 's'.repeat(32), now: () => t, fetchImpl: async (u, o) => { sent.push(o); return { status: 200 }; } });
  await w('escalated', { problem: 'nodes-down', why: 'wss://rpc.example/v2/abcdefSECRET123 failed' });
  await w('escalated', { problem: 'nodes-down', why: 'wss://rpc.example/v2/abcdefSECRET123 failed' });
  assert.strictEqual(sent.length, 1, 'duplicate suppressed');
  const [ts, sig] = sent[0].headers['x-chronos-signature'].match(/t=(\d+),v1=([0-9a-f]+)/).slice(1);
  assert.strictEqual(sig, crypto.createHmac('sha256', 's'.repeat(32)).update(`${ts}.${sent[0].body}`).digest('hex'));
  assert.ok(!sent[0].body.includes('SECRET123'));
  t += 61000; await w('escalated', { problem: 'nodes-down', why: 'again' }); assert.strictEqual(sent.length, 2);
});

test('websocket swap events of watched pools reach the engine', async () => {
  const ganache = require('ganache'); const { ethers } = require('ethers');
  const { BlockFeed, SWAP_TOPICS } = require('../lib/blockfeed.cjs');
  const s = ganache.server({ logging: { quiet: true }, chain: { chainId: 42161 }, wallet: { deterministic: true, totalAccounts: 1 } });
  await new Promise((r) => s.listen(18581, r));
  // a tiny contract whose fallback emits a V2-style Swap event (test only)
  const topic = SWAP_TOPICS[2].slice(2);
  const runtime = '7f' + topic + '60006000a1' + '00';
  const init = '60' + (runtime.length / 2).toString(16).padStart(2, '0') + '80600b6000396000f3' + runtime;
  const w = new ethers.Wallet('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', new ethers.JsonRpcProvider('http://127.0.0.1:18581', 42161, { staticNetwork: true }));
  const pool = (await (await w.sendTransaction({ data: '0x' + init })).wait()).contractAddress.toLowerCase();
  const swaps = [];
  const f = new BlockFeed({ urls: ['ws://127.0.0.1:18581'], onBlock: () => {}, onSwap: (a) => swaps.push(a), pools: [pool] }).start();
  try {
    for (let i = 0; i < 50 && !f.status().up; i++) await new Promise((r) => setTimeout(r, 100));
    await (await w.sendTransaction({ to: pool, data: '0x' })).wait();
    for (let i = 0; i < 40 && !swaps.length; i++) await new Promise((r) => setTimeout(r, 100));
    assert.deepStrictEqual(swaps, [pool]);
    assert.strictEqual(f.status().watchingPools, 1); assert.strictEqual(f.status().swaps, 1);
    assert.match(f.restart(), /1 feed\(s\) reconnecting/);
    for (let i = 0; i < 50 && !f.status().up; i++) await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(f.status().up, 1, 'reconnected once, cleanly');
  } finally { f.stop(); await new Promise((r) => setTimeout(r, 200)); await Promise.race([s.close(), new Promise((r) => setTimeout(r, 2000))]); }
});

test('assist --fix: allowlisted terminal steps, in order, each verified, stopping at the first that works', async () => {
  const { fix } = require('../tui/assist.cjs');
  const ran = []; let fixedAfter = 2;
  const steps = { 'engine-down': [
    { name: 'a', when: () => true, run: () => { ran.push('a'); fixedAfter--; return 'ran a'; } },
    { name: 'skip', when: () => false, run: () => { ran.push('skip'); } },
    { name: 'b', when: () => true, run: () => { ran.push('b'); fixedAfter--; return 'ran b'; } },
    { name: 'c', when: () => true, run: () => { ran.push('c'); } },
  ] };
  const out = []; const res = await fix([{ id: 'engine-down' }, { id: 'no-wss' }], { log: (m) => out.push(m), steps, settleMs: 0, recheck: async () => (fixedAfter > 0 ? [{ id: 'engine-down' }] : []) });
  assert.deepStrictEqual(ran, ['a', 'b']);
  assert.deepStrictEqual(res.map((x) => x.resolved), [false, true]);
  assert.match(out.join('\n'), /✗ a · ran a · verified: problem still there[\s\S]*✓ b · ran b · verified: resolved/);
});
