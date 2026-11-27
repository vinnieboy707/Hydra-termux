'use strict';
// chronos payout end to end on a local test chain (synthetic chain, test only): your real contract artifact, deployed
// by the real `chronos deploy`, holding test tokens; the real `chronos payout` code moves them with Policy T1 applied.
// The keys are ganache's public deterministic test keys; they hold nothing on any real network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ethers } = require('ethers');
const PO = require('../lib/payout.cjs');
const I = require('../lib/integrity.cjs');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;
const OWNER_KEY = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'; // ganache account 0 (TEST-ONLY)
const OTHER_KEY = '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1'; // ganache account 1 (TEST-ONLY)

test('T1 split: reserve is bps of (value − gas), rounded up per token, never short; payout is the rest', () => {
  const rows = [
    { symbol: 'USDC', address: '0x' + '1'.repeat(40), decimals: 6, price8: 100000000n, amount: 100n * 10n ** 6n, verified: true },
    { symbol: 'WETH', address: '0x' + '2'.repeat(40), decimals: 18, price8: 200000000000n, amount: 5n * 10n ** 16n, verified: true }, // $100
    { symbol: 'ARB', address: '0x' + '3'.repeat(40), decimals: 18, price8: 50000000n, amount: 10n ** 18n, verified: false }, // not confirmed: excluded
  ];
  // $200 value, gas 0.0025 ETH at $2000 = $5 → net $195 → reserve 30% = $58.50
  const s = PO.split({ rows, taxBps: 3000, gasWei: 25n * 10n ** 14n, ethPrice8: 200000000000n });
  assert.strictEqual(s.rows.length, 2, 'an unconfirmed balance is never paid out');
  assert.strictEqual(s.total8, 200n * 10n ** 8n); assert.strictEqual(s.gas8, 5n * 10n ** 8n); assert.strictEqual(s.net8, 195n * 10n ** 8n); assert.strictEqual(s.tax8, 5850000000n);
  const reserved8 = s.rows.reduce((a, r) => a + (r.tax * r.price8) / 10n ** BigInt(r.decimals), 0n);
  assert.ok(reserved8 >= s.tax8 - 2n, 'reserve covers T1 (within 1 smallest unit of rounding per token, always up)');
  for (const r of s.rows) assert.strictEqual(r.tax + r.payout, r.amount);
  assert.strictEqual(s.rows[0].tax, 29250000n); // 29.25 USDC
  // gas larger than value: nothing is net, nothing is reserved, everything is still paid out to you
  const z = PO.split({ rows, taxBps: 3000, gasWei: 10n ** 18n, ethPrice8: 200000000000n });
  assert.strictEqual(z.net8, 0n); assert.ok(z.rows.every((r) => r.tax === 0n && r.payout === r.amount));
});

function sealedCopy() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-payout-'));
  for (const f of I.codeFiles()) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), d); fs.chmodSync(d, 0o644); }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  const r = spawnSync(NODE, [path.join(tmp, 'bin', 'chronos.cjs'), 'seal', '--yes'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  return tmp;
}
async function devchain() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(NODE, [path.join(ROOT, 'test', 'devchain.cjs')], { cwd: ROOT, env: { ...process.env, DEVCHAIN_PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore'] });
  const line = await new Promise((res, rej) => {
    let buf = ''; const t = setTimeout(() => rej(new Error('devchain timeout')), 90000);
    p.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { clearTimeout(t); res(buf.slice(0, i)); } });
    p.on('exit', (c) => rej(new Error('devchain exited ' + c)));
  });
  return { proc: p, env: JSON.parse(line), port };
}
function run(copy, script, env, { answer = 'YES', planOnly = false, key = OWNER_KEY } = {}) {
  const runner = path.join(copy, 'runner.cjs');
  fs.writeFileSync(runner, `require('./tui/${script}.cjs').${script === 'deploy' ? 'runDeploy' : 'runPayout'}({ planOnly: ${planOnly}, ask: { secret: async () => { throw new Error('no prompt expected'); }, input: async () => ${JSON.stringify(answer)} }${script === 'deploy' ? ", svc: { restartIfRunning: () => false }" : ''} })
  .then((c) => process.exit(c)).catch((e) => { console.log('ERROR ' + e.message); process.exit(9); });`);
  const r = spawnSync(NODE, [runner], { cwd: copy, encoding: 'utf8', timeout: 180000, env: { ...process.env, ...env, DEPLOYER_PRIVATE_KEY: key } });
  fs.unlinkSync(runner);
  return { code: r.status, out: r.stdout + r.stderr };
}

test('chronos payout: deploy → profit in the contract → plan → YES → reserve and payout land → nothing left → resume', { timeout: 600000 }, async () => {
  const dc = await devchain(); const copy = sealedCopy();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-payout-data-'));
  const payoutWallet = ethers.Wallet.createRandom().address; const vault = ethers.Wallet.createRandom().address;
  // second source: the same test node reached under another hostname (a real install uses another provider)
  const env = { ...dc.env, CHRONOS_DATA_DIR: data, PAYOUT_WALLET_ADDRESS: payoutWallet, TAX_RESERVE_VAULT: vault, ARB_RPC_URL_2: `http://localhost:${dc.port}`, CHRONOS_BLOCKSCOUT_URL: 'off' };
  const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${dc.port}`, 42161, { staticNetwork: true, cacheTimeout: -1 });
  const ownerSigner = new ethers.Wallet(OWNER_KEY, provider);
  const tok = new ethers.Contract(dc.env.CHRONOS_WETH, ['function mint(address,uint256)', 'function balanceOf(address) view returns (uint256)'], ownerSigner);
  try {
    let r = run(copy, 'deploy', env); assert.strictEqual(r.code, 0, r.out);
    const contract = fs.readFileSync(dc.env.ENV_FILE, 'utf8').match(/^CHRONOS_FLASH_ARB_ADDRESS=(0x[0-9a-fA-F]{40})$/m)[1];
    r = run(copy, 'payout', env); assert.strictEqual(r.code, 0, r.out); assert.match(r.out, /Nothing to pay out/);
    const nonce = async () => Number(BigInt(await provider.send('eth_getTransactionCount', [ownerSigner.address, 'pending'])));
    await (await tok.mint(contract, 3n * 10n ** 18n, { nonce: await nonce() })).wait(); // TEST: 3 WETH of "profit"
    r = run(copy, 'payout', env, { planOnly: true }); assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /confirmed by second node, same block/); assert.match(r.out, /WETH\s+3\.0/); assert.match(r.out, /--plan: nothing sent/);
    assert.strictEqual(await tok.balanceOf(contract), 3n * 10n ** 18n);
    r = run(copy, 'payout', env, { answer: 'no' }); assert.strictEqual(r.code, 1); assert.strictEqual(await tok.balanceOf(contract), 3n * 10n ** 18n);
    r = run(copy, 'payout', env, { key: OTHER_KEY }); assert.strictEqual(r.code, 1); assert.match(r.out, /owned by/);
    r = run(copy, 'payout', env); assert.strictEqual(r.code, 0, r.out);
    // no executions → no gas since start → reserve = 30% of 3 WETH = 0.9 WETH exactly
    assert.strictEqual(await tok.balanceOf(contract), 0n);
    assert.strictEqual(await tok.balanceOf(vault), 9n * 10n ** 17n);
    assert.strictEqual(await tok.balanceOf(payoutWallet), 21n * 10n ** 17n);
    assert.strictEqual(await tok.balanceOf(ownerSigner.address), 0n, 'nothing is left behind in the owner wallet');
    const lines = fs.readFileSync(path.join(data, 'payouts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.strictEqual(lines.filter((l) => l.state === 'confirmed').length, 3);
    r = run(copy, 'payout', env); assert.match(r.out, /Nothing to pay out/);
    // resume: a run that stopped after its withdrawal (tokens in the owner wallet, transfers planned) is finished next time
    await (await tok.mint(ownerSigner.address, 10n ** 18n, { nonce: await nonce() })).wait();
    const plan = 'pTEST';
    fs.appendFileSync(path.join(data, 'payouts.jsonl'), [
      { plan, step: 'withdraw:WETH', kind: 'withdraw', symbol: 'WETH', state: 'confirmed', block: 1 },
      { plan, step: 'tax:WETH', kind: 'tax', symbol: 'WETH', token: dc.env.CHRONOS_WETH, amount: String(3n * 10n ** 17n), amountFmt: '0.3', usd: 0, to: vault, state: 'planned' },
      { plan, step: 'payout:WETH', kind: 'payout', symbol: 'WETH', token: dc.env.CHRONOS_WETH, amount: String(7n * 10n ** 17n), amountFmt: '0.7', usd: 0, to: payoutWallet, state: 'planned' },
    ].map((x) => JSON.stringify(x)).join('\n') + '\n');
    r = run(copy, 'payout', env); assert.strictEqual(r.code, 0, r.out); assert.match(r.out, /Finishing 2 transfer/);
    assert.strictEqual(await tok.balanceOf(vault), 12n * 10n ** 17n); assert.strictEqual(await tok.balanceOf(payoutWallet), 28n * 10n ** 17n);
    // a second source that disagrees: nothing is paid out
    await (await tok.mint(contract, 10n ** 18n, { nonce: await nonce() })).wait();
    r = run(copy, 'payout', { ...env, ARB_RPC_URL_2: 'http://127.0.0.1:1' }); assert.notStrictEqual(r.code, 0);
    assert.strictEqual(await tok.balanceOf(contract), 10n ** 18n, 'no second source answering: nothing moved');
    // no second source configured at all (no second node, Blockscout off): it must say so and move nothing
    const { ARB_RPC_URL_2, ...noSecond } = env;
    r = run(copy, 'payout', noSecond); assert.notStrictEqual(r.code, 0); assert.match(r.out, /no second source to confirm balances/);
    assert.strictEqual(await tok.balanceOf(contract), 10n ** 18n, 'no second source configured: nothing moved');
  } finally { dc.proc.kill(); provider.destroy(); }
});
