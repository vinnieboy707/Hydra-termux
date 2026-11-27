'use strict';
// chronos liquidations (2.9.18): a read-only measurement of Aave V3 liquidations on Arbitrum One and Base, before
// anything is built for them (research, 2026-11-26: liquidations are the only flow with published evidence of more
// than $1 net per event). Through Etherscan API V2 with your ETHERSCAN_API_KEY (one key, both chains); nothing is sent.
// For every LiquidationCall in the window: debt repaid and collateral seized in USD, the liquidator's gross bonus,
// gas paid, and whether the transaction went through Chainlink SVR's Atlas auction (Aave on Arbitrum and Base since
// March 2026), where the winner also paid a bid that this measurement cannot see yet. The verdict uses the research's
// build gates: median kept above $1, at least 10 distinct winners, at least 5 events a day.
// Prices are Aave's oracle prices NOW (Etherscan's eth_call reads the latest block): fine for the bonus (both legs at
// the same prices), approximate for USD totals; the report says so.
const { ethers } = require('ethers');

const TOPIC = ethers.id('LiquidationCall(address,address,address,uint256,uint256,address,bool)');
const ATLAS = '0x8ad1aE9D97C79aA68A0a151E83ff3942f68F86C1'; // Chainlink SVR / Atlas (Chainlink searcher docs)
const CHAINS = {
  arbitrum: { id: 42161, name: 'Arbitrum One', pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', blocksPerDay: 345600 },
  base: { id: 8453, name: 'Base', pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', weth: '0x4200000000000000000000000000000000000006', blocksPerDay: 43200 },
};
const GATES = { medianKeptUsd: 1, winners: 10, eventsPerDay: 5 };
const IF = new ethers.Interface([
  'function ADDRESSES_PROVIDER() view returns (address)', 'function getPriceOracle() view returns (address)',
  'function getAssetPrice(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class EtherscanV2 {
  constructor(key, chainId, { fetchImpl = fetch, gapMs = 350 } = {}) { this.key = key; this.chainId = chainId; this.fetch = fetchImpl; this.gapMs = gapMs; this.calls = 0; }
  async get(params) {
    if (this.calls++) await sleep(this.gapMs); // the free plan: 3 calls a second
    const q = new URLSearchParams({ chainid: String(this.chainId), ...params, apikey: this.key });
    const r = await this.fetch('https://api.etherscan.io/v2/api?' + q.toString(), { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`Etherscan HTTP ${r.status}`);
    const j = await r.json();
    if (params.module === 'proxy') { if (j && typeof j.result === 'string' && /^0x/.test(j.result)) return j.result; throw new Error('Etherscan: ' + String((j && (j.error && j.error.message)) || (j && j.result) || 'no result').slice(0, 100)); }
    if (j && j.status === '1' && Array.isArray(j.result)) return j.result;
    if (j && /no records found/i.test(String(j.message))) return [];
    throw new Error('Etherscan: ' + String((j && (j.result || j.message)) || 'no result').slice(0, 100));
  }
  head() { return this.get({ module: 'proxy', action: 'eth_blockNumber' }).then((h) => Number(BigInt(h))); }
  call(to, data) { return this.get({ module: 'proxy', action: 'eth_call', to, data, tag: 'latest' }); }
  /** every log in [from, to]: a range that fills a page (1,000) is split in two until none does */
  async logs(address, topic0, from, to, depth = 0) {
    const page = await this.get({ module: 'logs', action: 'getLogs', address, ...(topic0 ? { topic0 } : {}), fromBlock: String(from), toBlock: String(to), page: '1', offset: '1000' });
    if (page.length < 1000 || from >= to || depth > 24) return page;
    const mid = Math.floor((from + to) / 2);
    return [...(await this.logs(address, topic0, from, mid, depth + 1)), ...(await this.logs(address, topic0, mid + 1, to, depth + 1))];
  }
}

const hexN = (h) => Number(BigInt(h || '0x0'));
const med = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

/** one chain's liquidations → { chain, events: [...], summary } */
async function measureChain(es, chain, days, log = () => {}) {
  const head = await es.head(); const from = Math.max(0, head - Math.round(days * chain.blocksPerDay));
  log(`${chain.name}: Aave liquidations in blocks ${from.toLocaleString('en-US')}–${head.toLocaleString('en-US')} (~${days} days)`);
  const [liq, atlas] = await Promise.all([es.logs(chain.pool, TOPIC, from, head), es.logs(ATLAS, null, from, head).catch((e) => { log(`${chain.name}: Atlas logs not read (${e.message}): auction share unknown`); return null; })]);
  const viaAtlas = atlas ? new Set(atlas.map((l) => l.transactionHash.toLowerCase())) : null;
  // prices and decimals: Aave's own oracle on that chain (found through the pool, so a wrong pool address shows here)
  const dec = (r) => IF.decodeFunctionResult(r[0], r[1]);
  const prov = dec(['ADDRESSES_PROVIDER', await es.call(chain.pool, IF.encodeFunctionData('ADDRESSES_PROVIDER'))])[0];
  const oracle = dec(['getPriceOracle', await es.call(prov, IF.encodeFunctionData('getPriceOracle'))])[0];
  const tokens = [...new Set(liq.flatMap((l) => [l.topics[1], l.topics[2]]).map((t) => ethers.getAddress('0x' + t.slice(26))).concat([ethers.getAddress(chain.weth)]))];
  const info = new Map();
  for (const t of tokens) {
    try {
      const price8 = BigInt(dec(['getAssetPrice', await es.call(oracle, IF.encodeFunctionData('getAssetPrice', [t]))])[0]);
      const decimals = Number(dec(['decimals', await es.call(t, IF.encodeFunctionData('decimals'))])[0]);
      let symbol = t.slice(0, 8); try { symbol = dec(['symbol', await es.call(t, IF.encodeFunctionData('symbol'))])[0]; } catch (_) { /* bytes32 symbol */ }
      info.set(t.toLowerCase(), { price8, decimals, symbol });
    } catch (e) { log(`${chain.name}: no price for ${t} (${e.message})`); }
  }
  const usd = (t, amt) => { const i = info.get(t.toLowerCase()); return i ? Number((BigInt(amt) * i.price8) / 10n ** BigInt(i.decimals)) / 1e8 : null; };
  const eth = info.get(chain.weth.toLowerCase());
  const events = liq.map((l) => {
    const coll = ethers.getAddress('0x' + l.topics[1].slice(26)), debt = ethers.getAddress('0x' + l.topics[2].slice(26));
    const [debtToCover, seized, liquidator] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256', 'address', 'bool'], l.data);
    const debtUsd = usd(debt, debtToCover), collUsd = usd(coll, seized);
    const gasUsd = eth ? Number((BigInt(hexN(l.gasUsed)) * BigInt(hexN(l.gasPrice)) * eth.price8) / 10n ** 18n) / 1e8 : null;
    const grossUsd = debtUsd !== null && collUsd !== null ? collUsd - debtUsd : null;
    return { tx: l.transactionHash.toLowerCase(), block: hexN(l.blockNumber), at: hexN(l.timeStamp) * 1000, liquidator: liquidator.toLowerCase(), collateral: (info.get(coll.toLowerCase()) || {}).symbol || coll, debt: (info.get(debt.toLowerCase()) || {}).symbol || debt,
      debtUsd, collUsd, grossUsd, bonusPct: debtUsd ? (grossUsd / debtUsd) * 100 : null, gasUsd, keptUsd: grossUsd !== null && gasUsd !== null ? grossUsd - gasUsd : null, viaAtlas: viaAtlas ? viaAtlas.has(l.transactionHash.toLowerCase()) : null };
  });
  return { chain: chain.name, from, to: head, days, events, summary: summarize(events, days) };
}

function summarize(events, days) {
  const winners = new Map(); for (const e of events) winners.set(e.liquidator, (winners.get(e.liquidator) || 0) + 1);
  const top = [...winners].sort((a, b) => b[1] - a[1]);
  const direct = events.filter((e) => e.viaAtlas === false), auction = events.filter((e) => e.viaAtlas === true);
  const kept = events.map((e) => e.keptUsd);
  return {
    events: events.length, perDay: days ? Math.round((events.length / days) * 10) / 10 : null, winners: winners.size,
    top3SharePct: events.length ? Math.round((top.slice(0, 3).reduce((s, x) => s + x[1], 0) / events.length) * 100) : null,
    viaAuctionPct: events.some((e) => e.viaAtlas !== null) ? Math.round((auction.length / Math.max(1, events.length)) * 100) : null,
    repaidUsd: Math.round(events.reduce((s, e) => s + (e.debtUsd || 0), 0)), grossUsd: Math.round(events.reduce((s, e) => s + (e.grossUsd || 0), 0)),
    medianBonusPct: med(events.map((e) => e.bonusPct)), medianGrossUsd: med(events.map((e) => e.grossUsd)), medianKeptUsd: med(kept),
    medianKeptDirectUsd: med(direct.map((e) => e.keptUsd)), medianKeptAuctionBeforeBidUsd: med(auction.map((e) => e.keptUsd)),
    topLiquidators: top.slice(0, 5).map(([a, n]) => ({ liquidator: a, events: n })),
  };
}

/** both gates and the verdict, in words */
function verdict(sums) {
  const all = sums.flatMap((s) => s.events); const days = sums.length ? Math.max(...sums.map((s) => s.days)) : 0;
  const S = summarize(all, days);
  // the auction winners' bids are not visible yet: use the direct (non-auction) liquidations for "kept" when there are
  // enough of them, else the auction ones before their bid, flagged
  const kept = S.medianKeptDirectUsd ?? S.medianKeptAuctionBeforeBidUsd;
  const gates = [
    { gate: `median kept per liquidation above $${GATES.medianKeptUsd}`, value: kept, pass: Number.isFinite(kept) && kept > GATES.medianKeptUsd, note: S.medianKeptDirectUsd === null ? 'auction trades only, BEFORE their bid (their real kept is lower)' : 'liquidations outside the auction' },
    { gate: `at least ${GATES.winners} distinct winners`, value: S.winners, pass: S.winners >= GATES.winners },
    { gate: `at least ${GATES.eventsPerDay} events a day`, value: S.perDay, pass: S.perDay >= GATES.eventsPerDay },
  ];
  return { all: S, gates, build: gates.every((g) => g.pass) };
}

async function run({ key, days = 14, chains = ['arbitrum', 'base'], fetchImpl = fetch, log = () => {}, gapMs = 350 }) {
  if (!key) throw new Error('no ETHERSCAN_API_KEY: chronos set ETHERSCAN_API_KEY');
  const out = [];
  for (const c of chains) { const ch = CHAINS[c]; if (!ch) continue; try { out.push(await measureChain(new EtherscanV2(key, ch.id, { fetchImpl, gapMs }), ch, days, log)); } catch (e) { log(`${ch.name}: ${e.message}`); out.push({ chain: ch.name, error: e.message, days, events: [], summary: summarize([], days) }); } }
  return { at: new Date().toISOString(), days, chains: out, verdict: verdict(out.filter((x) => !x.error)) };
}

module.exports = { run, measureChain, summarize, verdict, EtherscanV2, TOPIC, ATLAS, CHAINS, GATES };
