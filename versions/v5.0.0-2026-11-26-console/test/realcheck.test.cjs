'use strict';
// Every stand-in has a real counterpart (test/counterparts.json → lib/realcheck.cjs), the contract v2 probe works
// end to end on the stand-ins (so a failure on Arbitrum One means the real protocol differs, not that the probe is
// broken), and a check that could not run is never reported as a pass.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');
const ganache = require('ganache');
const RC = require('../lib/realcheck.cjs');
const { runProbe } = require('../lib/v2probe.cjs');

const T = __dirname;
const reg = JSON.parse(fs.readFileSync(path.join(T, 'counterparts.json'), 'utf8'));

function discover() {
  const tests = fs.readdirSync(T).filter((f) => f.endsWith('.cjs') && f !== path.basename(__filename) && f !== 'mutate.cjs');
  const read = (f) => fs.readFileSync(path.join(T, f), 'utf8');
  const contracts = fs.readdirSync(path.join(T, 'mocks')).filter((f) => f.endsWith('.sol')).flatMap((f) => [...read(path.join('mocks', f)).matchAll(/^contract (\w+)/gm)].map((m) => m[1]));
  const fixtures = [...fs.readdirSync(path.join(T, 'fixtures')).filter((f) => f.endsWith('.json')), ...fs.readdirSync(path.join(T, 'fixtures', 'v2')).map((f) => 'v2/' + f)];
  const fakes = ['devchain.cjs', 'portal:render_test.js']; // the portal's own render test enforces its side
  for (const f of tests) {
    const s = read(f);
    for (const m of s.matchAll(/function (fake\w+)/g)) fakes.push(m[1]);
    if (/createServer\(/.test(s)) fakes.push('server:' + f);
    if (/new BlockFeed\(/.test(s)) fakes.push('feed:' + f);
    if (/fetchImpl/.test(s)) fakes.push('fetch:' + f);
  }
  return { contracts, fixtures, fakes: [...new Set(fakes)] };
}

function problemsFor(found, reg) {
  const problems = [];
  for (const [group, names] of Object.entries(found)) {
    for (const n of names) if (!reg[group][n]) problems.push(`${group}: ${n} has no real counterpart in test/counterparts.json`);
    for (const n of Object.keys(reg[group])) if (!names.includes(n)) problems.push(`${group}: ${n} is registered but no longer used`);
    for (const [n, e] of Object.entries(reg[group])) {
      if (!e.real || !e.checks || !e.checks.length) problems.push(`${group}: ${n} names no real system or check`);
      for (const c of e.checks || []) if (!RC.CHECKS[c]) problems.push(`${group}: ${n} → check ${c} does not exist in lib/realcheck.cjs`);
    }
  }
  const used = new Set(Object.values(reg).filter((g) => typeof g === 'object').flatMap((g) => Object.values(g).flatMap((e) => e.checks || [])));
  for (const id of Object.keys(RC.CHECKS)) if (!used.has(id) && !['rpc-is-arbitrum', 'contract-deployed'].includes(id)) problems.push(`check ${id} answers no stand-in`);
  return problems;
}

test('every stand-in is paired with a real system and a real check that exists', () => {
  assert.deepStrictEqual(problemsFor(discover(), reg), []);
});

test('the guard objects to an orphan stand-in, a stale entry and a check that does not exist', () => {
  const found = discover();
  const orphan = problemsFor({ ...found, contracts: [...found.contracts, 'MockOrphan'] }, reg);
  assert.ok(orphan.some((p) => p.includes('MockOrphan has no real counterpart')));
  const stale = problemsFor({ ...found, fakes: found.fakes.filter((f) => f !== 'fakeKms') }, reg);
  assert.ok(stale.some((p) => p.includes('fakeKms is registered but no longer used')));
  const bad = JSON.parse(JSON.stringify(reg)); bad.fakes.fakeKms.checks = ['no-such-check'];
  assert.ok(problemsFor(found, bad).some((p) => p.includes('no-such-check does not exist')));
});

test('a check that could not run is reported as not run, never as a pass', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')); const env = path.join(dir, '.env');
  fs.writeFileSync(env, 'ARB_RPC_URL=\nCHRONOS_ALERT_WEBHOOK_URL=off\n', { mode: 0o600 }); // off: the default (your portal) is checked against the real project by verify-real
  const keep = {}; for (const k of ['ARBITRUM_WSS_URL', 'CHRONOS_EXECUTOR_KMS_KEY', 'CHRONOS_ALERT_WEBHOOK_URL', 'OPENROUTER_API_KEY', 'CHRONOS_FLASH_ARB_ADDRESS', 'CONTRACT_ADDRESS']) { keep[k] = process.env[k]; delete process.env[k]; }
  try {
    const r = await RC.verifyReal({ envFile: env, only: ['wss-feed', 'kms-signer', 'alert-webhook', 'ai-agent', 'contract-deployed', 'rpc-is-arbitrum'], dataDir: dir });
    const by = Object.fromEntries(r.results.map((x) => [x.id, x.status]));
    assert.deepStrictEqual(by, { 'rpc-is-arbitrum': RC.FAIL, 'wss-feed': RC.SKIP, 'contract-deployed': RC.SKIP, 'kms-signer': RC.SKIP, 'alert-webhook': RC.SKIP, 'ai-agent': RC.SKIP });
    assert.ok(fs.existsSync(path.join(dir, 'live', 'realcheck.json')), 'result recorded');
  } finally { for (const [k, v] of Object.entries(keep)) if (v !== undefined) process.env[k] = v; }
});

test('the contract v2 probe passes every check on the stand-ins and fails on a lying router, a low fee, a foreign pool', async () => {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, miner: { blockGasLimit: '0x3B9ACA00', callGasLimit: '0x3B9ACA00' }, wallet: { deterministic: true, totalAccounts: 2, defaultBalance: 100000 } }));
  const owner = await provider.getSigner(0); const A = (c) => c.getAddress();
  const art = (n) => JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'v2', n + '.json'), 'utf8'));
  const deploy = async (n, ...a) => { const c = await new ethers.ContractFactory(art(n).abi, art(n).bytecode, owner).deploy(...a); await c.waitForDeployment(); return c; };
  const usdc = await deploy('MockToken', 'USDC', 6), usdt = await deploy('MockNoReturnToken'), weth = await deploy('MockWETH');
  const [U, W, Tt] = await Promise.all([A(usdc), A(weth), A(usdt)]);
  const aave = await deploy('MockAavePool', 5n), vault = await deploy('MockBalancerVaultFull'), morpho = await deploy('MockMorpho'), pm = await deploy('MockPoolManager');
  const r1 = await deploy('MockRouter'), v2r = await deploy('MockV2Router'), v3f = await deploy('MockV3Factory'), v2f = await deploy('MockV2Factory');
  const pool = await deploy('MockV3Pool', await A(v3f), U, W, 500); await v3f.register(U, W, 500, await A(pool));
  if (U.toLowerCase() < W.toLowerCase()) await pool.setRate(5n * 10n ** 8n, 1n); else await pool.setRate(1n, 5n * 10n ** 8n);
  const pair = await deploy('MockV2Pair', await A(v2f), W, U, 30n); await v2f.register(W, U, await A(pair));
  const E = (n) => BigInt(n) * 10n ** 18n, M = (n) => BigInt(n) * 10n ** 6n;
  await weth.mint(await A(pair), E(1000)); await usdc.mint(await A(pair), M(2_000_000)); await pair.sync();
  for (const t of [usdc, usdt]) for (const x of [aave, vault, morpho, pm, r1, v2r]) await t.mint(await A(x), M(10_000_000));
  // v2.1 venues: a pool keyed by tick spacing (Aero Slipstream style) and an Algebra pool (Camelot style), same price as the Uniswap pool
  const tsf = await deploy('MockV3FactoryTS'), alg = await deploy('MockAlgebraFactory');
  for (const [fac, reg] of [[tsf, (p) => tsf.register(U, W, 100, p)], [alg, (p) => alg.register(U, W, p)]]) {
    const p = await deploy('MockV3Pool', await A(fac), U, W, 100);
    if (U.toLowerCase() < W.toLowerCase()) await p.setRate(5n * 10n ** 8n, 1n); else await p.setRate(1n, 5n * 10n ** 8n);
    await weth.mint(await A(p), E(1000)); await reg(await A(p));
  }
  const curve = await deploy('MockCurvePool', U, Tt, 1n, 1n); await usdt.mint(await A(curve), M(10_000_000)); await r1.setRate(Tt, U, 1n, 1n); // USDC → USDT0 on Curve, back 1:1 on Uniswap V3
  await usdc.mint(await A(pool), M(10_000_000)); await weth.mint(await A(pool), E(1000));
  for (const x of [r1, v2r]) await weth.mint(await A(x), E(1000));
  await r1.setRate(W, U, 2020n * 10n ** 6n, 10n ** 18n); await r1.setRate(W, Tt, 2000n * 10n ** 6n, 10n ** 18n); await v2r.setRate(W, U, 2000n * 10n ** 6n, 10n ** 18n);
  const cfg = { aave: await A(aave), vault: await A(vault), weth: W, usdc: U, usdt: Tt, v3Factories: [await A(v3f)], v3Routers: [await A(r1)], v2Factories: [await A(v2f)], v2Fees: [30], v2Routers: [await A(v2r)], probeWeth: E(10), dumpWeth: E(1), sizes: [M(100), M(1000), M(5000)], morpho: await A(morpho), v4: await A(pm), curvePools: [await A(curve)], cl: [await A(tsf), await A(alg)], clModes: [1, 2], clFees: [100, 0] };
  const opts = { from: await owner.getAddress(), value: E(20), gas: 900_000_000n };
  const dir = path.join(__dirname, '..', 'contracts', 'v2');
  const good = await runProbe(provider, cfg, dir, opts);
  assert.deepStrictEqual(good.filter((c) => !c.ok).map((c) => c.name), []);
  assert.strictEqual(good.length, 18, 'incl. the Morpho, Uniswap V4, Curve and v2.1-venue checks');
  assert.strictEqual(good.find((c) => c.name === 'venue-legs-real').values[0], '2', 'both v2.1 venues traded through the contract');
  const curveRow = good.find((c) => c.name === 'curve-leg-real'); assert.strictEqual(curveRow.values[0], '1', 'the Curve pool traded');
  assert.ok(good.find((c) => c.name === 'real-profit-v4').values[1] !== '0', 'a real V4 loan made the same profit route work');
  const lax = await deploy('MockLaxRouter'); await usdc.mint(await A(lax), M(10_000_000)); await lax.setRate(W, U, 2020n * 10n ** 6n, 10n ** 18n); await lax.setPayBps(9000n);
  const other = await deploy('MockV3Factory'); await other.register(U, W, 500, await A(pool));
  const bad = await runProbe(provider, { ...cfg, v2Fees: [20], v3Routers: [await A(r1), await A(lax)], v3Factories: [await A(v3f), await A(other)] }, dir, opts);
  const failed = bad.filter((c) => !c.ok).map((c) => c.name).sort();
  assert.deepStrictEqual(failed, ['pair-fee-matches-setting', 'pools-belong-to-their-factory', 'routers-pay-what-they-report']);
});

test('portal check: refused or empty passes; readable rows, a missing table or no answer fails', async () => {
  const http = require('http');
  let mode = 'refuse';
  const srv = http.createServer((q, r) => {
    const t = q.url.split('/rest/v1/')[1].split('?')[0];
    if (mode === 'leak' && t === 'payouts') { r.writeHead(200); return r.end('[{"amount_usd":1}]'); }
    if (mode === 'missing' && t === 'reports') { r.writeHead(404); return r.end('{"code":"PGRST205","message":"Could not find the table"}'); }
    if (t === 'heartbeats') { r.writeHead(200); return r.end('[]'); }
    r.writeHead(401); r.end('{"code":"42501","message":"permission denied for table ' + t + '"}');
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  process.env.CHRONOS_PORTAL_SUPABASE_URL = 'http://127.0.0.1:' + srv.address().port;
  try {
    const run = () => RC.CHECKS['portal-backend'].run({});
    assert.strictEqual((await run()).status, RC.PASS);
    mode = 'leak'; const leak = await run(); assert.strictEqual(leak.status, RC.FAIL); assert.match(leak.detail, /payouts: a signed-out visitor can read rows/);
    mode = 'missing'; const miss = await run(); assert.strictEqual(miss.status, RC.FAIL); assert.match(miss.detail, /reports: table missing/);
  } finally { delete process.env.CHRONOS_PORTAL_SUPABASE_URL; srv.close(); }
});
