'use strict';
// The Visuals tab shows real on-chain data only (P0): nothing before the first real scan; every screen names its
// Arbitrum One block and age; old data is marked STALE; every number it prints is one the engine measured; and no
// dashboard code contains a source of made-up values.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../tui/ansi.cjs');
const { renderFrame, createState } = require('../tui/app.cjs');
const HD = require('../tui/hd.cjs');

function state({ scanned = 5000, history = [], res } = {}) {
  const S = createState(); S.phase = 'running'; S.tab = 2; S.interval = 20; S.cfg = { MIN_NET_PROFIT_USD: 0.35, problems: [] };
  S.history = history; S.res = res; S.lastScanAt = res ? Date.now() - scanned : 0; return S;
}
const text = (S, w = 70) => renderFrame(S, w, 120).map(A.strip).join('\n');
const realRes = { blockNumber: 427308256, candidates: [{ netUsd: -0.37, legs: [{ market: 'uniswap_v3:500:0x1' }, { market: 'sushi_v3:500:0x2' }] }], indicators: {
  blockedBy: [{ filter: 'profit floor', routes: 23, onlyThis: 9, bestNetIfOnlyThis: -0.37 }], best: { path: ['USDC', 'WETH', 'USDC'], legs: 2, amountUsd: 2500, netUsd: -0.37, altNetUsd: null },
  breakEven: { gasGwei: 0.011, gasCeilingGwei: 0.05 }, cycles: { nearMiss10bps: 7, pricesAllow: 30 }, flashLiquidity: [{ symbol: 'USDC', aaveUsd: 81000000, altUsd: 12000000 }] } };
const hist = [{ t: 1, block: 427308250, best: -1.2, ms: 4100, gas: 0.011, quotes: 812, fails: 3, sp: [['WETH/USDC', 3.2]] }, { t: 2, block: 427308256, best: -0.37, ms: 3900, gas: 0.011, quotes: 812, fails: 3, sp: [['WETH/USDC', 2.7]] }];

test('before the first real scan nothing is drawn: no amounts, no charts', () => {
  const t = text(state());
  assert.match(t, /No real scan yet/);
  assert.doesNotMatch(t.split('\n').slice(3).join('\n'), /\$\d|[⠀-⣿]|█/, 'no amount, chart dot or bar before real data');
});

test('every screen names its Arbitrum One block and age; old data is marked STALE in place of LIVE', () => {
  const live = text(state({ res: realRes, history: hist }));
  assert.match(live, /● LIVE\s+Arbitrum One · block #427308256\s*\n\s*scanned \d+s ago · real quotes only/);
  const old = text(state({ res: realRes, history: hist, scanned: 10 * 60000 }));
  assert.match(old, /STALE · last real scan 10m 0s ago \(block #427308256\)\s*\n\s*nothing below is current/);
  assert.doesNotMatch(old, /● LIVE/);
});

test('every number printed comes from the engine\'s measurements', () => {
  const t = text(state({ res: realRes, history: hist }));
  for (const s of ['-$0.370', '23', '$2.5k', '0.011 / 0.05 gwei', '3 of 812', '7 within 10 bps', '$81.0M', '$12.0M', 'block #427308256']) assert.ok(t.includes(s), `missing measured value ${s}`);
  const allowed = new Set(['-$0.370', '-$1.20', '$0.350', '$0.000', '$2.5k', '$81.0M', '$12.0M']);
  for (const m of t.match(/-?\$[\d.]+[kM]?/g) || []) assert.ok(allowed.has(m), `${m} is not a measured value (or the profit floor / zero line)`);
});

test('no dashboard code contains a source of made-up values', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'tui'))) {
    const s = fs.readFileSync(path.join(__dirname, '..', 'tui', f), 'utf8');
    assert.doesNotMatch(s, /Math\.random|faker|lorem|demo ?data|sample ?data|mock/i, `tui/${f}`);
  }
  // a gap in the data stays a gap
  const none = HD.chart([{ values: [null, null], color: '#ffffff' }], 20, 2, { hlines: [{ value: 0.35 }] }).map(A.strip).join('');
  assert.match(none, /no data yet/);
  assert.doesNotMatch(none, /[\u2800-\u28FF]/, 'a floor line alone is not drawn as if it were data');
  const line = HD.chart([{ values: [1, null, 3], color: '#ffffff' }], 20, 2).map(A.strip).join('');
  assert.ok(/[⠀-⣿]/.test(line));
});
