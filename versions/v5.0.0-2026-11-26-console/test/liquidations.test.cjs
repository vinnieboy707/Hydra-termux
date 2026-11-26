'use strict';
// chronos liquidations (2.9.18): Aave V3 liquidations read through Etherscan API V2, measured, gated. Etherscan is
// played by fakeEtherscan (logs, eth_call, head); its real counterpart is api.etherscan.io with your key on Arbitrum
// One and Base, checked by chronos verify-real (aave-liquidation-sources: both pools answer through Etherscan).
const test = require('node:test');
const assert = require('node:assert');
const { ethers } = require('ethers');
const L = require('../lib/liquidations.cjs');

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', WETH = L.CHAINS.arbitrum.weth;
const PROV = '0x' + '11'.repeat(20), ORACLE = '0x' + '22'.repeat(20);
const IF = new ethers.Interface(['function ADDRESSES_PROVIDER() view returns (address)', 'function getPriceOracle() view returns (address)', 'function getAssetPrice(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)']);
const t32 = (a) => ethers.zeroPadValue(a, 32);
function liqLog({ tx, debt = 1000n * 10n ** 6n, seized = 525n * 10n ** 15n, liquidator = '0x' + 'aa'.repeat(20), gasUsed = 900000, gasPrice = 10000000 }) {
  // repaid 1,000 USDC, took 0.525 WETH ($1,050 at $2,000): a 5% bonus, $50 gross
  return { address: L.CHAINS.arbitrum.pool, topics: [L.TOPIC, t32(WETH), t32(USDC), t32('0x' + 'bb'.repeat(20))], data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'address', 'bool'], [debt, seized, liquidator, false]),
    blockNumber: '0x64', timeStamp: '0x6745a000', gasPrice: '0x' + gasPrice.toString(16), gasUsed: '0x' + gasUsed.toString(16), transactionHash: tx };
}
function fakeEtherscan({ liqs, atlasTx = [], big = false }) {
  const seen = [];
  const f = async (url) => {
    const q = Object.fromEntries(new URL(url).searchParams); seen.push(q);
    const ok = (result) => ({ ok: true, status: 200, json: async () => (q.module === 'proxy' ? { jsonrpc: '2.0', id: 1, result } : { status: result.length ? '1' : '0', message: result.length ? 'OK' : 'No records found', result }) });
    if (q.module === 'proxy' && q.action === 'eth_blockNumber') return ok('0x' + (10_000_000).toString(16));
    if (q.module === 'proxy' && q.action === 'eth_call') {
      const fn = IF.parseTransaction({ data: q.data }).name; const to = q.to.toLowerCase();
      if (fn === 'ADDRESSES_PROVIDER') return ok(IF.encodeFunctionResult(fn, [PROV]));
      if (fn === 'getPriceOracle') return ok(IF.encodeFunctionResult(fn, [ORACLE]));
      if (fn === 'getAssetPrice') { const a = IF.parseTransaction({ data: q.data }).args[0].toLowerCase(); return ok(IF.encodeFunctionResult(fn, [a === USDC.toLowerCase() ? 100000000n : 200000000000n])); }
      if (fn === 'decimals') return ok(IF.encodeFunctionResult(fn, [to === USDC.toLowerCase() ? 6 : 18]));
      if (fn === 'symbol') return ok(IF.encodeFunctionResult(fn, [to === USDC.toLowerCase() ? 'USDC' : 'WETH']));
    }
    if (q.module === 'logs') {
      if (q.address.toLowerCase() === L.ATLAS.toLowerCase()) return ok(atlasTx.map((h) => ({ transactionHash: h })));
      const span = Number(q.toBlock) - Number(q.fromBlock);
      if (big && span > 1000) return ok(Array.from({ length: 1000 }, () => liqs[0])); // a full page: the range must be split
      return ok(liqs.filter(() => true));
    }
    return { ok: false, status: 400, json: async () => ({}) };
  };
  f.seen = seen; return f;
}

test('liquidations: bonus, gas and kept from each LiquidationCall, the auction share, winners and the build gates', async () => {
  const liqs = [liqLog({ tx: '0x' + '01'.repeat(32) }), liqLog({ tx: '0x' + '02'.repeat(32), liquidator: '0x' + 'cc'.repeat(20) })];
  const f = fakeEtherscan({ liqs, atlasTx: ['0x' + '01'.repeat(32)] });
  const r = await L.run({ key: 'K'.repeat(34), days: 1, chains: ['arbitrum'], fetchImpl: f, gapMs: 0 });
  const c = r.chains[0]; const e = c.events[0];
  assert.ok(Math.abs(e.debtUsd - 1000) < 1e-6 && Math.abs(e.collUsd - 1050) < 1e-6 && Math.abs(e.grossUsd - 50) < 1e-6, 'repaid $1,000, seized $1,050: $50 gross');
  assert.ok(Math.abs(e.bonusPct - 5) < 1e-9); assert.ok(Math.abs(e.gasUsd - 0.018) < 1e-9, '900k gas × 0.01 gwei × $2,000'); assert.ok(Math.abs(e.keptUsd - 49.982) < 1e-9);
  assert.deepStrictEqual(c.events.map((x) => x.viaAtlas), [true, false], 'the first went through the SVR auction');
  assert.strictEqual(c.summary.winners, 2); assert.strictEqual(c.summary.viaAuctionPct, 50);
  assert.ok(f.seen.every((q) => q.chainid === '42161'), 'Arbitrum One through Etherscan V2'); assert.ok(f.seen.every((q) => q.module !== 'proxy' || q.action !== 'eth_sendRawTransaction'), 'nothing is ever sent');
  const g = r.verdict.gates; assert.strictEqual(g[0].pass, true, 'kept $49.98 > $1 (outside the auction)'); assert.strictEqual(g[1].pass, false, '2 winners < 10'); assert.strictEqual(r.verdict.build, false);
});

test('a range that fills a page is split until every log is read; no key = refused before any call', async () => {
  const liqs = [liqLog({ tx: '0x' + '03'.repeat(32) })];
  const f = fakeEtherscan({ liqs, big: true });
  const c = await L.measureChain(new L.EtherscanV2('K'.repeat(34), 42161, { fetchImpl: f, gapMs: 0 }), L.CHAINS.arbitrum, 0.01, () => {});
  const logCalls = f.seen.filter((q) => q.module === 'logs' && q.address.toLowerCase() === L.CHAINS.arbitrum.pool.toLowerCase());
  assert.ok(logCalls.length > 3, 'split into smaller ranges'); assert.ok(logCalls.every((q) => Number(q.toBlock) >= Number(q.fromBlock)));
  await assert.rejects(L.run({ key: '', fetchImpl: f }), /no ETHERSCAN_API_KEY/);
});
