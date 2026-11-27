'use strict';
// TEST TOOL: starts a local chain (chain id 42161) with mock Aave/Uniswap contracts so the console can be exercised
// end to end without mainnet. Writes a throwaway .env + venues file. Everything it produces is synthetic test data.
const fs = require('fs');
const os = require('os');
const path = require('path');
const solc = require('solc');
const ganache = require('ganache');
const { ethers } = require('ethers');

(async () => {
  const port = Number(process.env.DEVCHAIN_PORT || 8545);
  const server = ganache.server({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, miner: { defaultGasPrice: 10000000 }, wallet: { deterministic: true, totalAccounts: 2 } });
  await new Promise((r) => server.listen(port, r));
  const bp = new ethers.JsonRpcProvider(`http://127.0.0.1:${port}`, 42161, { staticNetwork: true });
  const signer = await bp.getSigner(0);
  const src = fs.readFileSync(path.join(__dirname, 'mocks', 'ChainMocks.sol'), 'utf8');
  const art = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'M.sol': { content: src } }, settings: { evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }))).contracts['M.sol'];
  let nonce = await bp.getTransactionCount(await signer.getAddress());
  const dep = async (n, ...a) => { const c = await new ethers.ContractFactory(art[n].abi, '0x' + art[n].evm.bytecode.object, signer).deploy(...a, { nonce: nonce++ }); await c.waitForDeployment(); return c; };
  const tx = async (p) => { const t = await p; await t.wait(); };
  const A = (c) => c.getAddress();
  const usdc = await dep('MockERC20', 'USDC', 6), weth = await dep('MockERC20', 'WETH', 18), arb = await dep('MockERC20', 'ARB', 18);
  const aave = await dep('MockAave'), oracle = await dep('MockOracle'), ap = await dep('MockAP', await A(oracle));
  await tx(aave.setProvider(await A(ap), { nonce: nonce++ }));
  const FLASH = (1n << 56n) | (1n << 63n);
  for (const [t, amt, price] of [[usdc, 5_000_000n * 10n ** 6n, 100000000n], [weth, 2000n * 10n ** 18n, 200000000000n], [arb, 1_000_000n * 10n ** 18n, 50000000n]]) {
    const at = ethers.Wallet.createRandom().address;
    await tx(t.mint(at, amt, { nonce: nonce++ })); await tx(aave.add(await A(t), FLASH, at, { nonce: nonce++ })); await tx(oracle.set(await A(t), price, { nonce: nonce++ }));
  }
  const v3f = await dep('MockV3Factory'), q = await dep('MockQuoter', await A(v3f)), v2f = await dep('MockV2Factory'), v2r = await dep('MockV2Router', await A(v2f));
  const multicall = await dep('MockMulticall3');
  const pool = async () => A(await dep('MockV3Pool', 10n ** 18n));
  const [U, Wt, R] = [await A(usdc), await A(weth), await A(arb)];
  const E = 10n ** 18n;
  await tx(v3f.setPool(U, Wt, 500, await pool(), { nonce: nonce++ })); await tx(v3f.setPool(U, Wt, 3000, await pool(), { nonce: nonce++ }));
  await tx(v3f.setPool(Wt, R, 3000, await pool(), { nonce: nonce++ })); await tx(v2f.setPair(U, Wt, await pool(), { nonce: nonce++ })); await tx(v2f.setPair(Wt, R, await pool(), { nonce: nonce++ }));
  // rates: out = in * r / 1e18. USDC->WETH 2000, WETH->USDC 1990 on V3; V2 pays 2008 for WETH. WETH/ARB roughly flat.
  const set = async (c, ...a) => tx(c.setRate(...a, { nonce: nonce++ }));
  await set(q, U, Wt, 500, 5n * 10n ** 26n); await set(q, Wt, U, 500, 1990n * 10n ** 6n);
  await set(q, U, Wt, 3000, 4985n * 10n ** 23n); await set(q, Wt, U, 3000, 1994n * 10n ** 6n);
  await set(q, Wt, R, 3000, 4000n * E); await set(q, R, Wt, 3000, 249n * 10n ** 12n);
  await set(v2r, Wt, U, 2008n * 10n ** 6n); await set(v2r, U, Wt, 4975n * 10n ** 23n);
  await set(v2r, Wt, R, 3990n * E); await set(v2r, R, Wt, 2505n * 10n ** 11n);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-dev-'));
  fs.mkdirSync(path.join(dir, 'data')); fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'venues.json'), JSON.stringify({ venues: [
    { id: 'uniswap_v3', kind: 'v3', executable: true, factory: await A(v3f), quoter: await A(q), router: null, fees: [100, 500, 3000, 10000] },
    { id: 'sushi_v2', kind: 'v2', executable: true, factory: await A(v2f), router: await A(v2r) },
    { id: 'camelot_v2', kind: 'v2', executable: false, factory: await A(v3f), router: await A(v2r) },
  ] }, null, 2));
  fs.writeFileSync(path.join(dir, '.env'), [`ARB_RPC_URL=http://127.0.0.1:${port}`, 'MIN_NET_PROFIT_USD=0.35', 'MAX_SLIPPAGE_BPS=35', 'GAS_CEILING_GWEI=0.05', 'GAS_UNITS_ASSUMED=900000',
    'SIZE_LADDER_USD=200,500,1000,2500,5000', 'SCREEN_SIZE_USD=1000', 'SCAN_TOPK=12', 'OPT_REFINE_ITERS=6', 'MIN_PROFIT_CAPTURE_BPS=5000', 'SLIPPAGE_PROBE_USD=10', 'DEADLINE_SECONDS=120',
    'MEASURE_INTERVAL_SEC=8', 'GO_MIN_EPISODES=5', 'GO_MIN_DISTINCT_BLOCKS=5', 'GO_MIN_USD_PER_DAY=5', 'POLICY_T1_TAX_BPS=3000', 'TAX_RESERVE_VAULT=0x000000000000000000000000000000000000dEaD',
    'MAX_DAILY_DRAWDOWN_USD=25', 'MARKET_CACHE_MIN=0'].join('\n') + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'data', 'verified_mainnet_actions.json'), JSON.stringify({ payoutWallet: '0x000000000000000000000000000000000000bEEF', actions: { test_swap: { txHash: '0x' + 'ab'.repeat(32), blockNumber: 1, summary: 'synthetic test entry' }, test_scan: { txHash: 'N/A (read)', blockNumber: 2, summary: 'synthetic' } } }));
  fs.writeFileSync(path.join(dir, 'src', 'registry.ts'), `export const R = [ { exchange: "UniswapV3", pair: "WETH/USDC", address: "${await A(await dep('MockV3Pool', 1n))}", token0: "${Wt}", token1: "${U}", feeTier: 500 } ];\n`);
  console.log(JSON.stringify({ CHRONOS_MULTICALL: await A(multicall), ENV_FILE: path.join(dir, '.env'), CHRONOS_VENUES_FILE: path.join(dir, 'venues.json'), CHRONOS_AAVE_POOL: await A(aave), CHRONOS_WETH: Wt, CHRONOS_WORKSPACE: dir }));
  setInterval(() => bp.send('evm_mine', []).catch(() => {}), 2000);
})().catch((e) => { console.error(e); process.exit(1); });
