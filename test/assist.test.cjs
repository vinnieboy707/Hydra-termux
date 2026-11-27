'use strict';
// The help agent and the pre-coded resolutions: every problem the agent can find has a guide entry and a remedy; crash
// loops put the engine in safe mode and it leaves safe mode after running cleanly; repeated scan failures re-initialise,
// back off and alert in that order; questions are answered from the guide only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AS = require('../lib/assist.cjs');
const RM = require('../lib/remedy.cjs');

const A = '0x' + '1'.repeat(40);
const envOf = (o) => (k) => o[k];
const allSet = { CHRONOS_FLASH_ARB_ADDRESS: A, CHRONOS_EXECUTOR_ADDRESS: A, CHRONOS_EXECUTOR_KMS_KEY: 'projects/p/locations/l/keyRings/r/cryptoKeys/k', TAX_RESERVE_VAULT: A, PAYOUT_WALLET_ADDRESS: A, ARBITRUM_WSS_URL: 'wss://x/y' };
const healthy = { settingsProblems: [], nodes: [{ ok: true }], device: { status: 'approved' }, integrity: { ok: true, foreign: [] }, engine: { alive: true, state: { heartbeat: Date.now(), lastScanAt: Date.now(), interval: 20, res: { approved: 1 } } }, env: envOf(allSet) };

test('every problem the agent can report has a guide entry and a pre-coded resolution', () => {
  const rows = AS.guide();
  for (const [id, symptom] of Object.entries(AS.ROW)) {
    assert.ok(rows.find((r) => r.symptom === symptom), `guide row for ${id}: "${symptom}"`);
    assert.ok(RM.REMEDIES[id], `remedy for ${id}`);
    assert.ok(RM.REMEDIES[id].auto || RM.REMEDIES[id].you, `${id} says what happens`);
  }
  assert.deepStrictEqual(Object.keys(RM.REMEDIES).sort(), Object.keys(AS.ROW).sort(), 'no remedy without a finding, no finding without a remedy');
});

test('a healthy, fully set-up device has nothing to report', () => {
  assert.deepStrictEqual(AS.diagnose(healthy), []);
});

test('each kind of problem is found, explained, and says whether it is automatic or needs you', () => {
  const f = AS.explain(AS.diagnose({
    settingsProblems: ['MIN_NET_PROFIT_USD missing'], nodes: [{ ok: false }], device: { status: 'pending', code: 'ABCD-EFGH' }, integrity: { ok: false, foreign: ['scripts/x.js'] },
    engine: { alive: true, state: { heartbeat: Date.now(), error: 'quote timeout', lastScanAt: Date.now() - 10 * 60000, interval: 20, res: { approved: 0, indicators: { blockedBy: [{ filter: 'profit floor', routes: 9, onlyThis: 4, bestNetIfOnlyThis: 0.12 }] } } } },
    env: envOf({}), crash: { safeUntil: Date.now() + 60000, lastCrash: { msg: 'TypeError: boom' } },
  }));
  const ids = f.map((x) => x.id);
  for (const id of ['crash-loop', 'settings-missing', 'nodes-down', 'device-pending', 'integrity', 'foreign-files', 'scan-error', 'scans-stale', 'nothing-approved', 'no-wss', 'no-contract', 'no-executor', 'no-wallets']) assert.ok(ids.includes(id), id);
  for (const x of f) { assert.ok(x.cause && x.fix && x.doc.startsWith('docs/OPERATIONS.md#'), x.id); assert.ok(x.auto || x.you, x.id); }
  assert.match(f.find((x) => x.id === 'nothing-approved').detail, /profit floor .* would net \+\$0\.120/);
  assert.match(f.find((x) => x.id === 'crash-loop').detail, /TypeError: boom/);
  assert.ok(AS.diagnose({ ...healthy, engine: null }).some((x) => x.id === 'engine-down'));
});

test('crash loop: repeated unclean starts → safe mode; clean runs do not count; safe mode ends after the hold', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-'));
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 4; i++) { const r = RM.onStart(dir, t0 + i * 1000); RM.onCleanExit(dir); assert.strictEqual(r.safeMode, false, 'clean exits are not crashes'); }
  RM.onCrash(dir, new Error('TypeError: x is undefined at scan'), t0 + 5000);
  let r;
  for (let i = 0; i < RM.CRASH.starts + 1; i++) r = RM.onStart(dir, t0 + 10000 + i * 1000); // crashes: no clean exit between starts
  assert.strictEqual(r.safeMode, true);
  assert.match(r.cause.msg, /TypeError/);
  assert.strictEqual(RM.onStart(dir, t0 + 10000 + RM.CRASH.holdMs + RM.CRASH.windowMs + 60000).safeMode, false, 'leaves safe mode after running long enough');
  const sc = RM.safeConfig({ DISCOVER_TOKENS: 40, HOT_SCAN_MS: 3000 });
  assert.deepStrictEqual([sc.DISCOVER_TOKENS, sc.HOT_SCAN_MS, sc.SAFE_MODE], [0, 0, true]);
});

test('scan failures: re-initialise, then back off (capped), then alert; never a tight loop', () => {
  const s = (n) => RM.scanFailure(n, 20);
  assert.deepStrictEqual([s(1).reinit, s(2).reinit, s(3).reinit], [false, false, true]);
  assert.strictEqual(s(5).interval, 20);
  assert.ok(s(6).interval > 20 && s(7).interval > s(6).interval);
  assert.strictEqual(s(50).interval, RM.SCAN.MAX_INTERVAL_S);
  assert.strictEqual(s(10).alert, true); assert.strictEqual(s(11).alert, false);
  assert.strictEqual(s(6).reinit, true, 'keeps re-initialising every 3 failures');
});

test('questions are answered from the guide, and the agent screen shows the automatic and the manual part', async () => {
  const hits = AS.answer('the engine stops when my phone screen is off');
  assert.match(hits[0].symptom, /phone screen is off/);
  assert.deepStrictEqual(AS.answer('zzz qqq'), []);
  const out = [];
  const code = await require('../tui/assist.cjs').runAssist({ question: 'why no trades', facts: { ...healthy, env: envOf({}) }, diagnoser: null, log: (m) => out.push(m) });
  const txt = out.join('\n');
  assert.match(txt, /Contract not deployed/); assert.match(txt, /automatic {4}stays in shadow/); assert.match(txt, /you can {2}chronos deploy/);
  assert.match(txt, /No routes approved for hours/, 'the question is matched to the guide');
  assert.strictEqual(code, 0, 'every finding here has an automatic part');
  const ai = []; await require('../tui/assist.cjs').runAssist({ facts: { ...healthy, env: envOf({}) }, diagnoser: async () => ({ model: 'm/x', confidence: 'low', cause: 'c', fix: 'f' }), log: (m) => ai.push(m) });
  assert.match(ai.join('\n'), /AI diagnosis \(m\/x, low confidence; advice only/);
});
