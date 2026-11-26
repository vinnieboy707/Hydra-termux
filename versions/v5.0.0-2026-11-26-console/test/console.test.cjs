'use strict';
// Console rendering + policy checks. Synthetic state is used ONLY inside these tests.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('../tui/ansi.cjs');
const { renderFrame, createState } = require('../tui/app.cjs');
const { Session } = require('../lib/session.cjs');
const pol = require('../lib/policies.cjs');
const { loadConfig } = require('../lib/config.cjs');
const { parseRegistry } = require('../lib/audit.cjs');
const { readRecord } = require('../lib/record.cjs');

const cand = (i, net, approved) => ({ approved, reasons: approved ? [] : ['net $-0.7 below floor $0.35'], borrowSymbol: 'USDC', otherSymbol: 'WETH', buyOn: `uniswap_v3:500:0xabc${i}`, sellOn: 'sushi_v2:0xdef', amountUsd: 5000, grossUsd: 20, premiumUsd: 2.5, gasUsdAssumed: 0.018, netUsd: net, impact1: 0, impact2: 1, quote: {}, runParams: approved ? { asset: '0x' + '1'.repeat(40), amount: '5000000000', minProfit: '8750000', deadline: 1, legs: [] } : undefined });
function running() {
  const S = createState();
  S.phase = 'running';
  S.cfg = { GAS_CEILING_GWEI: 0.05, MIN_NET_PROFIT_USD: 0.35, MAX_SLIPPAGE_BPS: 35, GAS_UNITS_ASSUMED: 900000, problems: [], rpcEnvKey: 'ARB_RPC_URL' };
  S.thresholds = { GO_MIN_EPISODES: 5, GO_MIN_DISTINCT_BLOCKS: 5, GO_MIN_USD_PER_DAY: 5 };
  S.res = { blockNumber: 123, status: 'SCANNED', gasGwei: 0.01, approved: 1, optimised: 3, marketsFound: 5, routesEnumerated: 16, tookMs: 900, candidates: [cand(1, 17.48, true), cand(2, -0.72, false), cand(3, -1.4, false)] };
  S.session.add(S.res);
  S.history = Array.from({ length: 30 }, (_, i) => ({ t: Date.now() - i * 1000, block: 100 + i, gas: 0.01 + i / 1e4, best: i % 3, approved: i % 2, ms: 800, quotes: 400, fails: 0 }));
  S.nodes = [{ key: 'ARB_RPC_URL', ok: true, ms: 40, block: 123, detail: 'Arbitrum One' }];
  S.services = { source: 'pm2 not found', apps: [] };
  S.record = { found: true, payoutWallet: '0x' + 'b'.repeat(40), txCount: 3, flashExecutions: 0, actions: [{ key: 'swap', isTx: true, block: 1 }] };
  S.st = { venueReport: [{ id: 'uniswap_v3', ok: true, executable: true }, { id: 'camelot_v2', ok: false, why: 'router.factory() mismatch' }], assets: [{ symbol: 'USDC', flashEnabled: true }], aave: { premiumBps: 5 } };
  return S;
}

test('every screen fits exactly in the terminal at phone, laptop and wide sizes', () => {
  for (const [w, h] of [[40, 20], [48, 44], [80, 24], [120, 40], [180, 50]]) {
    for (let tab = 0; tab < 5; tab++) for (const detail of [false, true]) for (const help of [false, true]) {
      const S = running(); S.tab = tab; S.detail = detail; S.help = help;
      const lines = renderFrame(S, w, h);
      assert.strictEqual(lines.length, h, `height at ${w}x${h} tab ${tab}`);
      lines.forEach((l, i) => assert.strictEqual(A.vlen(l), w, `width at ${w}x${h} tab ${tab} line ${i}: ${A.strip(l)}`));
    }
  }
});

test('boot, blocked and error screens render and explain what to do', () => {
  const S = createState(); S.phase = 'blocked'; S.problems = ['GAS_UNITS_ASSUMED missing or not a number'];
  let txt = renderFrame(S, 80, 30).map(A.strip).join('\n');
  assert.match(txt, /Setup needed/); assert.match(txt, /GAS_UNITS_ASSUMED/); assert.match(txt, /press r/);
  S.phase = 'error'; S.error = 'RPC reports chain 1, not Arbitrum One';
  txt = renderFrame(S, 80, 30).map(A.strip).join('\n');
  assert.match(txt, /Could not start/); assert.match(txt, /Nothing was sent/);
});

test('before the first scan the console shows waiting states, never placeholder numbers', () => {
  const S = running(); S.res = null; S.history = []; S.session = new Session();
  const txt = renderFrame(S, 120, 40).map(A.strip).join('\n');
  assert.match(txt, /waiting for first scan/);
  assert.doesNotMatch(txt, /\$\d/, 'no dollar figure may appear before real data exists');
});

test('route details show every guardrail and the unsent contract call', () => {
  const S = running(); S.tab = 1; S.detail = true;
  const txt = renderFrame(S, 160, 60).map(A.strip).join('\n');
  for (const s of ['flash-loanable on Aave', 'gas ≤ 0.05 gwei', 'net ≥ $0.35', 'impact ≤ 35 bps', 'NOT sent', '"minProfit": "8750000"']) assert.ok(txt.includes(s), s);
});

test('per-day projection is withheld until 10 minutes of data exist; GO impossible before that', () => {
  const s = new Session();
  s.add({ blockNumber: 1, status: 'SCANNED', candidates: [cand(1, 100, true)] });
  const sm = s.summary({ GO_MIN_EPISODES: 1, GO_MIN_DISTINCT_BLOCKS: 1, GO_MIN_USD_PER_DAY: 1 });
  assert.strictEqual(sm.perDayUpperBound, null);
  assert.strictEqual(sm.verdict, 'MEASURING', 'no verdict either way from under 10 minutes of data');
  s.startedAt -= 11 * 60000;
  assert.strictEqual(s.summary({ GO_MIN_EPISODES: 1, GO_MIN_DISTINCT_BLOCKS: 1, GO_MIN_USD_PER_DAY: 1 }).verdict, 'GO TO SHADOW TEST');
});

test('episodes: a route that stays approved is counted once', () => {
  const s = new Session(); const r = (b, ok) => ({ blockNumber: b, status: 'SCANNED', candidates: [cand(1, 5, ok)] });
  s.add(r(1, true)); s.add(r(2, true)); s.add(r(3, false)); s.add(r(4, true));
  assert.strictEqual(s.episodes.length, 2);
});

test('policies: S0 flags a world-readable .env, T1 needs 3000 bps and a vault, G1 blocks on missing settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pol-'));
  const f = path.join(dir, '.env');
  fs.writeFileSync(f, 'POLICY_T1_TAX_BPS=2500\nMIN_NET_PROFIT_USD=0.35\n', { mode: 0o644 }); fs.chmodSync(f, 0o644);
  const cfg = loadConfig(f);
  const P = Object.fromEntries(pol.evaluatePolicies({ envFile: f, cfg, record: null, lastRes: null }).map((p) => [p.id, p]));
  assert.strictEqual(P.S0.status, 'FAIL'); assert.match(P.S0.detail, /chmod 600/);
  assert.strictEqual(P.T1.status, 'CHECK');
  assert.strictEqual(P.G1.status, 'BLOCKING');
  fs.chmodSync(f, 0o600);
  assert.strictEqual(Object.fromEntries(pol.evaluatePolicies({ envFile: f, cfg, record: null, lastRes: null }).map((p) => [p.id, p])).S0.status, 'PASS');
  const params = pol.listParameters({ envFile: f, cfg });
  assert.ok(params.find((p) => p.key === 'MIN_NET_PROFIT_USD').ok);
  assert.ok(!params.find((p) => p.key === 'GAS_UNITS_ASSUMED').ok);
});

test('registry parser reads your registry.ts format; record reader counts only real tx hashes', () => {
  const R = parseRegistry('export const P = [ { exchange: "UniswapV3", pair: "WETH/USDC.e", address: "0xC6962004f452bE9203591991D15f6b388e09E8D0", token0: "0x82", token1: "0xff", feeTier: 500 } ];');
  assert.deepStrictEqual([R.length, R[0].exchange, R[0].fee], [1, 'UniswapV3', 500]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-')); fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'data', 'verified_mainnet_actions.json'), JSON.stringify({ payoutWallet: '0xB2', actions: { a: { txHash: '0x' + 'be'.repeat(32) }, b: { txHash: 'N/A (read)' }, flash_x: { txHash: 'N/A' } } }));
  const rec = readRecord(dir);
  assert.deepStrictEqual([rec.txCount, rec.flashExecutions], [1, 0]);
});

const { redact, clean } = require('../lib/safety.cjs');
const history = require('../lib/history.cjs');

test('security: node urls, api keys and 32-byte hex never reach the screen', () => {
  const m = redact('request failed https://arb-mainnet.g.alchemy.com/v2/AbCdEfGhIjKlMnOpQrStUvWxYz012345 key 0x' + 'a'.repeat(64) + ' token sk_live_synthetic-placeholder-not-a-real-key-0000');
  assert.doesNotMatch(m, /alchemy|AbCdEf|aaaaaaaa|sk_live/);
  assert.match(m, /\[rpc-url\]/);
});

test('security: a token symbol cannot inject terminal escape codes', () => {
  const evil = 'USDC\x1b[2J\x1b]0;pwned\x07‮DSU';
  const c = clean(evil, 12);
  assert.doesNotMatch(c, /[\x00-\x1f‮]/);
  assert.ok([...c].length <= 12);
});

test('security: history lines not written by the console are ignored', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  history.append(dir, { t: 1, block: 10, gas: 0.01, best: 1.5, approved: 1, ms: 5, quotes: 9, fails: 0 });
  fs.appendFileSync(path.join(dir, 'console_history.jsonl'), JSON.stringify({ t: 2, block: 11, gas: 0.01, best: 9999, approved: 9, ms: 1, quotes: 1, fails: 0, mac: 'f'.repeat(64) }) + '\n');
  fs.appendFileSync(path.join(dir, 'console_history.jsonl'), 'not json\n');
  const h = history.load(dir);
  assert.strictEqual(h.records.length, 1); assert.strictEqual(h.records[0].best, 1.5); assert.strictEqual(h.rejected, 2);
  // editing a real line breaks its signature
  const f = path.join(dir, 'console_history.jsonl');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"best":1.5', '"best":150'));
  assert.strictEqual(history.load(dir).records.length, 0);
});

test('security: integrity seal detects an edited, deleted or added code file', () => {
  const I = require('../lib/integrity.cjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'int-'));
  // run against a copy so the real install is untouched
  const cp = (s, d) => { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); };
  for (const f of I.codeFiles()) cp(path.join(I.ROOT, f), path.join(tmp, f));
  const modPath = path.join(tmp, 'lib', 'integrity.cjs');
  const J = require(modPath);
  fs.chmodSync(path.join(tmp, 'lib'), 0o755);
  J.unlock(); J.seal();
  let v = J.verify(); assert.ok(v.ok);
  // a symbolic link slipped into the code is reported, never followed
  fs.symlinkSync('/etc/hostname', path.join(tmp, 'lib', 'link.cjs'));
  assert.deepStrictEqual(J.verify().added, ['lib/link.cjs']); J.lock(); J.unlock(); fs.unlinkSync(path.join(tmp, 'lib', 'link.cjs'));
  // runtime libraries (ethers and its dependencies, per the lockfile) are sealed; test-only packages are not
  const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); };
  put('node_modules/ethers/package.json', '{"name":"ethers"}'); put('node_modules/ethers/lib.commonjs/index.js', 'module.exports={}');
  put('node_modules/@noble/hashes/sha3.js', 'exports.k=1'); put('node_modules/ganache/index.js', 'dev only');
  J.seal(); v = J.verify(); assert.ok(v.ok && v.depsSealed && v.depsCount === 2, JSON.stringify(v));
  put('node_modules/ganache/index.js', 'changed dev tool'); assert.ok(J.verify().ok, 'dev-only packages are not part of the runtime seal');
  put('node_modules/@noble/hashes/sha3.js', 'exports.k=2'); v = J.verify();
  assert.ok(!v.ok && /node_modules/.test(v.deps), 'a changed dependency of ethers is caught');
  put('node_modules/@noble/hashes/sha3.js', 'exports.k=1'); assert.ok(J.verify().ok);
  // install over an older version: leftover files are moved out of the code folders, never deleted
  fs.writeFileSync(path.join(tmp, 'lib', 'old.cjs'), 'from an older version');
  const td = J.tidy(path.join(tmp, 'data'));
  assert.deepStrictEqual(td.moved, ['lib/old.cjs']); assert.ok(td.v.ok); assert.ok(fs.existsSync(path.join(td.dest, 'lib', 'old.cjs')));
  fs.appendFileSync(path.join(tmp, 'lib', 'engine.cjs'), '\n// tampered\n');
  fs.writeFileSync(path.join(tmp, 'lib', 'old2.cjs'), 'x');
  assert.deepStrictEqual(J.tidy(path.join(tmp, 'data')).moved, [], 'nothing is moved while a sealed file is changed');
  fs.unlinkSync(path.join(tmp, 'lib', 'old2.cjs'));
  v = J.verify(); assert.ok(!v.ok); assert.deepStrictEqual(v.changed, ['lib/engine.cjs']);
  fs.writeFileSync(path.join(tmp, 'lib', 'evil.cjs'), 'module.exports=1');
  v = J.verify(); assert.deepStrictEqual(v.added, ['lib/evil.cjs']);
  fs.unlinkSync(path.join(tmp, 'venues.json'));
  v = J.verify(); assert.deepStrictEqual(v.missing, ['venues.json']);
  J.lock();
  assert.strictEqual(fs.statSync(path.join(tmp, 'lib', 'scan.cjs')).mode & 0o777, 0o444, 'locked code is read-only');
  if (process.getuid && process.getuid() !== 0) { // root ignores permissions (this sandbox); your Termux user does not
    assert.throws(() => fs.writeFileSync(path.join(tmp, 'lib', 'scan.cjs'), 'x'), /EACCES|EPERM/, 'locked files cannot be overwritten by accident');
  }
  J.unlock();
});

test('edge metrics: scan speed in blocks and how fast opportunities vanish', () => {
  const s = new Session();
  const r = (b, keys, ms = 8000) => ({ blockNumber: b, status: 'SCANNED', tookMs: ms, candidates: keys.map((k) => ({ ...cand(k, 5, true), buyOn: 'v:' + k })) });
  s.add(r(1, ['a', 'b'])); s.add(r(40, ['a'])); s.add(r(80, [])); // b lived 1 scan, a lived 2
  const e = s.edge();
  assert.strictEqual(e.scanBlocks, 32);
  assert.strictEqual(e.closedEpisodes, 2);
  assert.strictEqual(e.vanishedWithinOneScan, 0.5);
});

test('fail loudly: problems produce a red banner on every tab until resolved, and are logged', () => {
  const HEALTH = require('../lib/health.cjs');
  const S = running();
  S.nodes = [{ key: 'ARB_RPC_URL', ok: false, detail: 'request to https://arb.example/v2/SECRETKEYabcdefghijklmnopqrstuvwxyz failed' }];
  S.lastQuotes = { n: 100, fail: 40 };
  for (let tab = 0; tab < 5; tab++) {
    S.tab = tab;
    const lines = renderFrame(S, 100, 30).map(A.strip);
    assert.match(lines[2], /✗ 3 PROBLEMS/, 'banner sits under the tabs on every tab');
    assert.doesNotMatch(lines.join('\n'), /SECRETKEY|arb\.example/, 'banner text is redacted');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-'));
  let r = HEALTH.logNew(dir, HEALTH.problems(S), new Set());
  assert.strictEqual(r.fresh.filter((x) => !x.profit).length, 3);
  S.nodes = [{ key: 'ARB_RPC_URL', ok: true }]; S.lastQuotes = { n: 100, fail: 0 };
  r = HEALTH.logNew(dir, HEALTH.problems(S), r.seen);
  assert.strictEqual(r.resolved.length, 3, 'the three faults resolve; the profit stage stays open');
  const log = fs.readFileSync(path.join(dir, 'errors.log'), 'utf8');
  assert.match(log, /PROBLEM node:ARB_RPC_URL/); assert.match(log, /RESOLVED quotes/);
  assert.doesNotMatch(log, /SECRETKEY/);
  assert.strictEqual(fs.statSync(path.join(dir, 'errors.log')).mode & 0o777, 0o600);
  const after = renderFrame(S, 100, 30).map(A.strip)[2];
  assert.ok(!after.includes('PROBLEM') && after.includes('NOT PROFITING'), 'faults clear; the banner stays red until there is profit');
});

test('profit gate: the banner stays red and names the blocking stage until verified on-chain profit exists', () => {
  const PROFIT = require('../lib/profit.cjs');
  const S = running(); S.lastScanAt = Date.now();
  let pr = PROFIT.evaluate(S);
  assert.strictEqual(pr.profiting, false);
  assert.strictEqual(pr.current.n, 4, 'settings ok, scanner live, one episode seen; GO not reached');
  const top = renderFrame(S, 120, 50).map(A.strip);
  assert.match(top[2], /NOT PROFITING/); assert.match(top.join('\n'), /MONEY/); assert.match(top.join('\n'), /Blocking now/);
  S.tab = 3; assert.match(renderFrame(S, 120, 80).map(A.strip).join('\n'), /PATH TO PROFIT/); S.tab = 0;
  S.session.startedAt -= 11 * 60000; S.thresholds = { GO_MIN_EPISODES: 1, GO_MIN_DISTINCT_BLOCKS: 1, GO_MIN_USD_PER_DAY: 0 };
  assert.strictEqual(PROFIT.evaluate(S).current.n, 5, 'GO reached; shadow test is the honest next blocker');
  S.record = { found: true, flashExecutions: 0, actions: [{ key: 'flash_arb_profit', isTx: true, txHash: '0x' + 'ab'.repeat(32), summary: 'profit 1000 USDC' }] };
  assert.ok(!PROFIT.evaluate(S).profiting, 'text in the record never counts as profit; only verified receipts do');
  S.realized = { contract: '0x' + '1'.repeat(40), profiting: true, totalNetUsd: 0 };
  assert.ok(!PROFIT.evaluate(S).profiting, 'profit that does not cover gas is not profit');
  S.realized = { contract: '0x' + '1'.repeat(40), profiting: true, totalNetUsd: 3.2 };
  assert.ok(PROFIT.evaluate(S).profiting);
});

test('one cycle is one opportunity: both borrow directions of the same cycle count once', () => {
  const s = new Session();
  const fwd = { ...cand(1, 5, true), borrowSymbol: 'USDC', otherSymbol: 'WETH', buyOn: 'A', sellOn: 'B' };
  const rev = { ...cand(1, 5, true), borrowSymbol: 'WETH', otherSymbol: 'USDC', buyOn: 'B', sellOn: 'A' };
  const other = { ...cand(1, 5, true), borrowSymbol: 'USDC', otherSymbol: 'WETH', buyOn: 'B', sellOn: 'A' };
  s.add({ blockNumber: 1, status: 'SCANNED', candidates: [fwd, rev] });
  assert.strictEqual(s.episodes.length, 1);
  s.add({ blockNumber: 2, status: 'SCANNED', candidates: [rev, other] });
  assert.strictEqual(s.episodes.length, 2, 'the opposite cycle (buy on B, sell on A) is a different opportunity');
});

test('money view: says exactly what blocks profit, the cost breakdown, a what-if from real numbers, and honest timing', () => {
  const MONEY = require('../lib/money.cjs');
  const S = running(); S.lastScanAt = Date.now();
  // stage 3: nothing clears the floor. Closest route: gross 1.80, flash fee 2.50, gas 0.02 → net −0.72
  S.res.candidates = [{ ...cand(1, -0.72, false), grossUsd: 1.80, premiumUsd: 2.50, gasUsdAssumed: 0.02, amountUsd: 5000 }];
  S.res.approved = 0; S.session = new Session(); S.session.add(S.res);
  let m = MONEY.view(S);
  assert.strictEqual(m.making, false);
  assert.strictEqual(m.blocker.n, 3);
  const why = m.blocker.why.join(' | '), fix = m.blocker.fix.join(' | ');
  assert.match(why, /gross \$1\.80 − flash fee \$2\.50 − gas \$0\.020 = −\$0\.72/);
  assert.match(why, /short by \$1\.07/);
  assert.match(fix, /without the Aave flash fee this route would be \$1\.78/);
  assert.match(m.blocker.eta, /cannot be estimated: depends on the market/);
  // stage 4: rate-based estimate (3 episodes in 30 min, need 5 → about 20 more min; blocks likewise)
  const s4 = running(); s4.lastScanAt = Date.now();
  s4.thresholds = { GO_MIN_EPISODES: 5, GO_MIN_DISTINCT_BLOCKS: 5, GO_MIN_USD_PER_DAY: 0 };
  s4.session = new Session(); s4.session.startedAt = Date.now() - 30 * 60000;
  for (let b = 0; b < 3; b++) s4.session.add({ blockNumber: 10 + b, status: 'SCANNED', candidates: [{ ...cand(b, 5, true), buyOn: 'v' + b }] });
  m = MONEY.view(s4);
  assert.strictEqual(m.blocker.n, 4);
  assert.match(m.blocker.eta, /about 2[01] min at the current rate/, 'rounded up: 20 min, or 21 if the clock ticked past 30 min during the test');
  // no repeats yet → no estimate rather than a guess
  const s5 = running(); s5.lastScanAt = Date.now(); s5.thresholds = { GO_MIN_EPISODES: 5, GO_MIN_DISTINCT_BLOCKS: 5, GO_MIN_USD_PER_DAY: 0 };
  s5.session = new Session(); s5.session.startedAt = Date.now() - 30 * 60000; s5.session.add({ blockNumber: 1, status: 'SCANNED', candidates: [{ ...cand(1, 5, true) }] });
  s5.session.add({ blockNumber: 2, status: 'SCANNED', candidates: [] });
  s5.res = { ...s5.res, approved: 1 };
  assert.ok(MONEY.view(s5).blocker.n >= 3);
  // stage 2 while scanning shows the live progress
  const s2 = running(); s2.res = null; s2.lastScanAt = 0; s2.scanning = true; s2.progress = { phase: 'screen', done: 30, total: 120 };
  m = MONEY.view(s2);
  assert.strictEqual(m.blocker.n, 2); assert.match(m.blocker.eta, /scan 25% \(checking every route\)/);
  // the panel is the first thing on the overview and names the blocker
  const txt = renderFrame(S, 120, 60).map(A.strip);
  const moneyLine = txt.findIndex((l) => /MONEY/.test(l));
  assert.ok(moneyLine >= 0 && moneyLine <= 5, 'money panel sits at the top');
  assert.match(txt.join('\n'), /Blocking now\s+3 · Routes net-positive after flash fee and gas/);
  // at phone width nothing important is cut off: long lines wrap inside the panel
  const narrow = renderFrame(S, 48, 70).map(A.strip).join('\n').replace(/[│╭╮╰╯]/g, ' ').replace(/\s+/g, ' ');
  for (const re of [/short by \$1\.07\)/, /Blocking now 3 · Routes net-positive after flash fee and gas/, /without the Aave flash fee this route would be \$1\.78/, /cannot be estimated: depends on the market/]) assert.match(narrow, re);
  // receipts prove profit → YES, no blocker, 7/7, and unmet checklist items are not claimed as done
  const sy = running(); sy.lastScanAt = Date.now();
  sy.realized = { contract: '0x000000000000000000000000000000000000c0de', executions: [{ hash: '0x1', netUsd: 12.5 }], totalNetUsd: 12.5, taxReserveUsd: 3.75, profiting: true };
  m = MONEY.view(sy);
  assert.strictEqual(m.making, true); assert.strictEqual(m.blocker, null); assert.strictEqual(m.progress, 1);
  const yes = renderFrame(sy, 120, 60).map(A.strip).join('\n');
  assert.match(yes, /Making money\?\s+YES\s+\+\$12\.50 net after gas · 1 verified execution\b/);
  assert.match(yes, /7\/7 done/); assert.doesNotMatch(yes, /Blocking now/);
  // executions that lost money are named as such, not as profit
  const sl = running(); sl.lastScanAt = Date.now();
  sl.realized = { contract: '0x000000000000000000000000000000000000c0de', executions: [{ hash: '0x1', netUsd: -0.4 }, { hash: '0x2', netUsd: -0.2 }], totalNetUsd: -0.6, taxReserveUsd: 0, profiting: false };
  assert.match(renderFrame(sl, 120, 60).map(A.strip).join('\n'), /NO\s+2 verified executions, net after gas −\$0\.60: losing money/);
});

test('dashboard following an engine that has not finished its first scan: no crash on any tab or width, says so, claims nothing', () => {
  const { applyState } = require('../tui/app.cjs');
  const MODE = require('../lib/mode.cjs');
  const MONEY = require('../lib/money.cjs');
  const PROFIT = require('../lib/profit.cjs');
  const S = createState();
  S.view = 'follow'; S.phase = 'running';
  // exactly what the engine publishes between start and its first scan: no result yet, the starting mode record
  const { Session } = require('../lib/session.cjs'); const { readThresholds } = require('../lib/thresholds.cjs');
  const th = readThresholds(null); const ses = new Session();
  S.thresholds = th;
  applyState(S, { phase: 'running', pid: 1, heartbeat: Date.now(), startedAt: Date.now(), interval: 30, mode: MODE.starting(), shadow: null, shadowRuns: [], exec: null, balances: null,
    session: { startedAt: ses.startedAt, episodes: [], summary: ses.summary(th), edge: ses.edge() } });
  assert.strictEqual(S.view, 'follow', 'engine data never overwrites the dashboard view');
  for (const [w, h] of [[40, 30], [80, 30], [160, 60]]) for (let t = 0; t < 5; t++) {
    S.tab = t;
    const txt = renderFrame(S, w, h).map(A.strip).join('\n');
    if (t === 0 && w >= 80) assert.match(txt, /engine is starting/);
  }
  assert.match(MODE.summary(S.mode), /engine starting/);
  assert.ok(!/all met/.test(MODE.summary(S.mode)), 'an empty rule list is never reported as met');
  const ev = PROFIT.evaluate(S);
  assert.strictEqual(ev.stages.find((x) => x.n === 5).met, false, 'shadow test is not claimed as passing while the engine starts');
  const e6 = MONEY.explain({ n: 6 }, S, { episodes: 0 }, {}); assert.match(e6.why.join(' '), /starting/);
});

test('a mode record without a rule list (or with an empty one) neither crashes the dashboard nor counts as shadow passing', () => {
  const { applyState } = require('../tui/app.cjs');
  const PROFIT = require('../lib/profit.cjs');
  for (const promote of [undefined, []]) {
    const S = createState(); S.view = 'follow'; S.phase = 'running';
    const mode = { mode: 'SHADOW' }; if (promote) mode.promote = promote;
    const { Session } = require('../lib/session.cjs'); const { readThresholds } = require('../lib/thresholds.cjs');
    const th = readThresholds(null); const ses = new Session(); S.thresholds = th;
    applyState(S, { phase: 'running', pid: 1, heartbeat: Date.now(), startedAt: Date.now(), interval: 30, mode, shadow: null, shadowRuns: [], exec: null, balances: null,
      session: { startedAt: ses.startedAt, episodes: [], summary: ses.summary(th), edge: ses.edge() } });
    for (const [w, h] of [[40, 30], [80, 30], [160, 60]]) for (let t = 0; t < 5; t++) { S.tab = t; renderFrame(S, w, h); }
    assert.strictEqual(PROFIT.evaluate(S).stages.find((x) => x.n === 5).met, false, 'no rules listed is never "shadow test passed"');
  }
});

test('stage 3 says what really emptied the shortlist (2.9.15: it always claimed "no token pair has two pools")', () => {
  const MONEY = require('../lib/money.cjs');
  const S = (ind) => ({ cfg: { MIN_NET_PROFIT_USD: 0.35 }, session: { startedAt: Date.now() - 60000 }, res: { marketsFound: 416, candidates: [], indicators: ind } });
  const st = { n: 3 };
  const dead = MONEY.explain(st, S({ deadRoutes: 4, thinPools: 37, depthMinUsd: 1000, cycles: { checked: 900, pricesAllow: 12 } }));
  assert.match(dead.why[0], /dead or thin pool: 4 route\(s\) set aside, 37 pool\(s\) under \$1,000 a side/);
  const quiet = MONEY.explain(st, S({ deadRoutes: 0, thinPools: 0, cycles: { checked: 900, pricesAllow: 0 } }));
  assert.match(quiet.why[0], /900 cycles checked: no cycle's prices leave a gap/);
  const none = MONEY.explain(st, S({ cycles: { checked: 0, pricesAllow: 0 } }));
  assert.match(none.why[0], /no token pair has two pools/, 'kept only when it is true');
});
