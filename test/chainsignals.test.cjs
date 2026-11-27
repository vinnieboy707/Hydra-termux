'use strict';
// Chain signals: groups, verdicts and the route prior, checked on two real Arbitrum One transactions of one competitor
// (0xD315…5a5D, read on Blockscout 2026-11-25) plus hand-made rows, labelled below. Real counterpart: the rows come from
// chronos research reading receipts on your own node (test/research.test.cjs; verify-real real-quote, blockscout-witness)
// and from the chain_indicators view in your database, which uses the same rules.
const test = require('node:test');
const assert = require('node:assert');
const CS = require('../lib/chainsignals.cjs');

const USDT0 = '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', D315 = '0xd315d8c4488e9cfbf00049a4fa44a77c989e5a5d';
// real (Blockscout): Morpho Blue loan of 250 USDT0, USDT0 → USSD (mint), USSD → USDT0 on Curve StableSwapNG 0x7d22…5343
// (the only Swap-family event, so research counts 1 leg), USDT0 kept by the sender; gas = fee × $1,699 (ETH then)
const real = [
  { tx: '0x341c0df05888f547c10358f92412b8ee77814c4c0e17409e63e60673988eddaa', block: 524318170, source: 'morpho_blue', contract: D315, sender: '0x5d03a3f8151d98a1bf9de604e7552caf49034ec3', ok: true, legs: 1, venues: ['Curve'], assets: [USDT0], gas: 445573, gasPriceGwei: 0.020348, gasUsd: 0.0154, keptUsd: 0.074221 },
  { tx: '0x0aace2b684761516682b4d8f0c3c847ed2a59622f89f2bdb15a8445457f8c152', block: 524226690, source: 'morpho_blue', contract: D315, sender: '0x5d03a3f8151d98a1bf9de604e7552caf49034ec3', ok: true, legs: 1, venues: ['Curve'], assets: [USDT0], gas: 449537, gasPriceGwei: 0.020086, gasUsd: 0.0153, keptUsd: 0.078245 },
];
// hand-made (labelled): a third winner of the same shape, and three reverts through another venue
const made = { ...real[0], tx: '0x' + 'e'.repeat(64), gas: 460000, keptUsd: 0.07, gasUsd: 0.015 };
const rev = (i, venue) => ({ tx: '0x' + String(i).padStart(64, '0'), block: 1, source: 'aave_v3', contract: '0x' + 'a'.repeat(40), ok: false, legs: 3, venues: [venue], assets: ['0x' + 'b'.repeat(40)], gas: 300000, gasPriceGwei: 0.02, gasUsd: 0.01, keptUsd: 0 });

test('chain signals: winners and reverts are grouped, judged and turned into a route order', () => {
  const s = CS.compute([...real, made, rev(1, 'bad_dex'), rev(2, 'bad_dex'), rev(3, 'bad_dex')]);
  assert.strictEqual(s.trades, 6); assert.strictEqual(s.wins, 3);
  assert.strictEqual(s.numbers.winPct, 50); assert.strictEqual(s.numbers.revertPct, 50);
  assert.ok(Math.abs(s.numbers.lowestWinningNetUsd - 0.055) < 1e-9, 'the smallest winner kept $0.055 after gas');
  assert.strictEqual(s.numbers.winnerGasP50, 449537); assert.strictEqual(s.numbers.winnerGasP90, 460000);
  const g = (id, key) => s.indicators[id].find((x) => x.key === String(key));
  assert.deepStrictEqual([g('lender', 'morpho_blue').verdict, g('lender', 'morpho_blue').wins], ['exploit', 3]);
  assert.strictEqual(g('lender', 'aave_v3').verdict, 'avoid', '3 of 3 reverted');
  assert.strictEqual(g('venue', 'bad_dex').verdict, 'avoid');
  assert.strictEqual(g('venue', 'Curve').verdict, 'exploit'); assert.strictEqual(g('legs', 1).verdict, 'exploit'); assert.strictEqual(g('legs', 3).verdict, 'avoid');
  assert.strictEqual(g('contract', D315).wins, 3);
  assert.strictEqual(g('asset', USDT0).verdict, 'exploit');
  assert.strictEqual(s.indicators['unknown-venue'].length, 0);
  // the route prior: winners' shape scores above nothing, the reverting shape below
  const P = CS.prior(s);
  const win = P({ legs: 1, venues: ['Curve'], asset: USDT0 });
  assert.ok(win > 0 && P({ legs: 2, venues: ['x'], asset: '0x' + 'c'.repeat(40) }) === 0 && P({ legs: 3, venues: ['bad_dex'], asset: '0x' + 'b'.repeat(40) }) < 0);
  assert.ok(P({ venues: ['curve'], asset: USDT0.toUpperCase() }) > 0, 'keys match whatever the case');
  // too few trades: no verdict either way
  const few = CS.compute(real);
  assert.ok(Object.values(few.indicators).flat().every((x) => x.verdict === 'watch'));
  assert.strictEqual(CS.prior(few)({ legs: 1, venues: ['Curve'], asset: USDT0 }), 0);
  assert.strictEqual(CS.prior(null)({}), 0);
  // database rows (chain_trades) give the same signals as research rows
  const db = real.map((r) => ({ tx_hash: r.tx, contract: r.contract, sender: r.sender, lender: r.source, success: r.ok, legs: r.legs, venues: r.venues, assets: r.assets, gas_used: r.gas, gas_price_gwei: r.gasPriceGwei, net_usd: r.keptUsd - r.gasUsd }));
  assert.deepStrictEqual(CS.compute(db).indicators.lender, CS.compute(real).indicators.lender);
  // the shared signals win once they cover more trades
  assert.strictEqual(CS.pick(s, { trades: 10 }).trades, 10); assert.strictEqual(CS.pick(s, { trades: 2 }), s); assert.strictEqual(CS.pick(null, null), null);
  assert.match(CS.lines(s).join('\n'), /6 flash-loan trades studied · 3 won \(50%\)[\s\S]*lenders: morpho_blue \(3\/3 won[\s\S]*avoid: .*bad_dex/);
  assert.match(CS.lines(null)[0], /no studied trades yet/);
});
