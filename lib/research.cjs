'use strict';
// chronos research: what the arbitrage that actually lands on Arbitrum One looks like (flash loans and own-capital
// cycles), read from the chain
// through your own node. Every number comes from event logs and transaction receipts; nothing is estimated except the
// USD value of a token amount (Aave oracle price at the latest block, only for tokens Aave prices). Read-only.
const { ethers } = require('ethers');

const id = (s) => ethers.id(s);
const T = {
  aaveFlash: id('FlashLoan(address,address,address,uint256,uint8,uint256,uint16)'),
  balFlash: id('FlashLoan(address,address,uint256,uint256)'),
  morphoFlash: id('FlashLoan(address,address,uint256)'), // Morpho Blue: caller, token (both indexed), assets
  v3Flash: id('Flash(address,address,uint256,uint256,uint256,uint256)'),
  transfer: id('Transfer(address,address,uint256)'),
};
// swap events of the venue families on Arbitrum (a log's topic says which family the pool belongs to)
const SWAPS = {
  [id('Swap(address,address,int256,int256,uint160,uint128,int24)')]: 'v3 (Uniswap/Sushi/Camelot-style)',
  [id('Swap(address,address,int256,int256,uint160,uint128,int24,uint128,uint128)')]: 'v3 (PancakeSwap)',
  [id('Swap(address,uint256,uint256,uint256,uint256,address)')]: 'v2',
  [id('Swap(bytes32,address,address,uint256,uint256)')]: 'Balancer pool',
  [id('TokenExchange(address,int128,uint256,int128,uint256)')]: 'Curve',
  [id('TokenExchange(address,uint256,uint256,uint256,uint256)')]: 'Curve (crypto)',
};
const topicAddr = (t) => ethers.getAddress('0x' + t.slice(26));

/** flash-loan events in [from, to], chunked (providers cap log ranges) */
async function flashEvents(provider, { aavePool, balancerVault, morpho = null, from, to, chunk = 2000, log = () => {} }) {
  const out = [];
  for (let a = from; a <= to; a += chunk) {
    const b = Math.min(to, a + chunk - 1);
    const q = async (filter) => { try { return await provider.getLogs({ ...filter, fromBlock: a, toBlock: b }); } catch (e) { log(`logs ${a}-${b}: ${String(e.shortMessage || e.message).slice(0, 60)}`); return []; } };
    const [av, bal, v3, mo] = await Promise.all([q({ address: aavePool, topics: [T.aaveFlash] }), balancerVault ? q({ address: balancerVault, topics: [T.balFlash] }) : [], q({ topics: [T.v3Flash] }), morpho ? q({ address: morpho, topics: [T.morphoFlash] }) : []]);
    for (const l of av) out.push({ source: 'aave_v3', tx: l.transactionHash, block: l.blockNumber, receiver: topicAddr(l.topics[1]), asset: topicAddr(l.topics[2]).toLowerCase() });
    for (const l of bal) out.push({ source: 'balancer_v2', tx: l.transactionHash, block: l.blockNumber, receiver: topicAddr(l.topics[1]), asset: topicAddr(l.topics[2]).toLowerCase() });
    for (const l of v3) out.push({ source: 'v3 pool flash', tx: l.transactionHash, block: l.blockNumber, receiver: topicAddr(l.topics[2]), pool: l.address.toLowerCase() });
    for (const l of mo) out.push({ source: 'morpho_blue', tx: l.transactionHash, block: l.blockNumber, receiver: topicAddr(l.topics[1]), asset: topicAddr(l.topics[2]).toLowerCase() });
  }
  return out;
}

/**
 * Pure analysis (unit-tested). events: from flashEvents. receipts: Map(tx → { status, gasUsed, effectiveGasPrice, from,
 * to, logs: [{ address, topics, data }] }). factoryOf: Map(pool → factory|null). venueOf: Map(factory → venue id).
 * price: (token) → { price8, decimals } | null. ethPrice8: BigInt.
 */
function analyze({ events, receipts, factoryOf, venueOf, price, ethPrice8 }) {
  const bySource = {};
  for (const e of events) bySource[e.source] = (bySource[e.source] || 0) + 1;
  const txs = [...new Set(events.map((e) => e.tx))];
  const rows = [];
  const unknownFactories = new Map(); const venues = {}; const legsDist = {};
  for (const h of txs) {
    const r = receipts.get(h); if (!r) continue;
    const ev = events.filter((e) => e.tx === h);
    const swaps = r.logs.filter((l) => SWAPS[l.topics[0]]);
    const legs = swaps.length;
    legsDist[legs] = (legsDist[legs] || 0) + 1;
    const txVenues = [];
    for (const s of swaps) {
      const f = factoryOf.get(s.address.toLowerCase());
      const v = f ? venueOf.get(f.toLowerCase()) : null;
      const name = v || (f ? `unknown factory ${f}` : SWAPS[s.topics[0]]);
      venues[name] = (venues[name] || 0) + 1; txVenues.push(name);
      if (f && !v) unknownFactories.set(f.toLowerCase(), (unknownFactories.get(f.toLowerCase()) || 0) + 1);
    }
    // what stayed with the transaction's sender or its contract: token in − token out, per token
    const keep = new Set([r.from.toLowerCase(), (r.to || '').toLowerCase(), ...ev.filter((e) => e.receiver).map((e) => e.receiver.toLowerCase())]);
    const delta = new Map();
    for (const l of r.logs) {
      if (l.topics[0] !== T.transfer || l.topics.length !== 3) continue;
      const fromA = topicAddr(l.topics[1]).toLowerCase(), toA = topicAddr(l.topics[2]).toLowerCase(); let amt;
      try { amt = BigInt(l.data); } catch (_) { continue; }
      const k = l.address.toLowerCase();
      if (keep.has(toA) && !keep.has(fromA)) delta.set(k, (delta.get(k) || 0n) + amt);
      if (keep.has(fromA) && !keep.has(toA)) delta.set(k, (delta.get(k) || 0n) - amt);
    }
    // an own-capital candidate is an arbitrage only if nothing net left the trader and something came back
    if (ev.every((e) => e.source === 'own capital')) { const ds = [...delta.values()]; if (!ds.length || ds.some((d) => d < 0n) || !ds.some((d) => d > 0n)) continue; }
    let keptUsd = 0, priced = true;
    for (const [tok, d] of delta) { if (d === 0n) continue; const p = price(tok); if (!p) { priced = false; continue; } keptUsd += Number((d * p.price8) / 10n ** BigInt(p.decimals)) / 1e8; }
    const gasUsd = Number((BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice) * BigInt(ethPrice8)) / 10n ** 18n) / 1e8;
    rows.push({ tx: h, block: ev[0].block, source: [...new Set(ev.map((e) => e.source))].join('+'), contract: (r.to || '').toLowerCase(), receiver: (ev[0].receiver || r.to || '').toLowerCase(), sender: r.from.toLowerCase(), ok: Number(r.status) === 1, legs, venues: [...new Set(txVenues)], assets: [...new Set(ev.map((e) => e.asset).filter(Boolean))], gas: Number(r.gasUsed), gasPriceGwei: Number(BigInt(r.effectiveGasPrice)) / 1e9, gasUsd, keptUsd: priced ? keptUsd : null, keptUsdPartial: priced ? null : keptUsd });
  }
  const med = (xs) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const byContract = new Map();
  for (const r of rows) { const k = r.contract; if (!byContract.has(k)) byContract.set(k, []); byContract.get(k).push(r); }
  const contracts = [...byContract].map(([c, rs]) => ({ contract: c, txs: rs.length, success: rs.filter((x) => x.ok).length, medianLegs: med(rs.map((x) => x.legs)), medianGas: med(rs.map((x) => x.gas)), medianGasUsd: med(rs.map((x) => x.gasUsd)), sources: [...new Set(rs.map((x) => x.source))], keptUsd: rs.reduce((s, x) => s + (x.keptUsd || 0), 0) })).sort((a, b) => b.txs - a.txs);
  const profitable = rows.filter((r) => r.ok && r.keptUsd !== null && r.keptUsd - r.gasUsd > 0);
  return {
    flashLoans: bySource, transactions: rows.length, succeeded: rows.filter((r) => r.ok).length,
    profitableAfterGas: profitable.length, medianProfitUsd: med(profitable.map((r) => r.keptUsd - r.gasUsd)),
    legs: legsDist, venues: Object.entries(venues).sort((a, b) => b[1] - a[1]).map(([venue, swaps]) => ({ venue, swaps })),
    venuesYouLack: [...unknownFactories].sort((a, b) => b[1] - a[1]).map(([factory, swaps]) => ({ factory, swaps })),
    medianGas: med(rows.map((r) => r.gas)), topContracts: contracts.slice(0, 10), rows,
  };
}

/**
 * Own-capital arbitrage (2.9.16): the winners on Arbitrum mostly trade their own money, so flash-loan events miss them
 * (6 of 8 flash loans traced on 2026-11-26 were not arbitrage at all). Every swap log in the newest `blocks` blocks,
 * grouped by transaction: a transaction with swaps in two or more different pools is a candidate; analyze() then keeps
 * it as an arbitrage only when the sender and its contract ended with no token less and at least one token more.
 */
async function swapCycles(provider, { from, to, chunk = 2000, log = () => {} }) {
  const topics = [Object.keys(SWAPS)]; const byTx = new Map();
  for (let a = from; a <= to; a += chunk) {
    const b = Math.min(to, a + chunk - 1);
    let logs = []; try { logs = await provider.getLogs({ fromBlock: a, toBlock: b, topics }); } catch (e) { log(`swap logs ${a}-${b}: ${String(e.shortMessage || e.message).slice(0, 60)}`); continue; }
    for (const l of logs) { const k = l.transactionHash; if (!byTx.has(k)) byTx.set(k, { block: l.blockNumber, index: l.transactionIndex, pools: new Set() }); byTx.get(k).pools.add(l.address.toLowerCase()); }
  }
  return [...byTx].filter(([, x]) => x.pools.size >= 2).map(([tx, x]) => ({ source: 'own capital', tx, block: x.block, index: x.index, receiver: null }));
}

/** everything above, live: reads logs, receipts and pool factories through your node */
async function run({ provider, aavePool, balancerVault, morpho = null, venues, assets, ethPrice8, hours = 2, maxTx = 80, logsChunk = 2000, swapBlocks = 600, log = () => {} }) {
  const head = await provider.getBlockNumber();
  const from = Math.max(0, head - Math.round(hours * 3600 * 4)); // Arbitrum One: about 4 blocks per second
  log(`reading flash loans in blocks ${from}–${head} (~${hours} h)`);
  const flash = await flashEvents(provider, { aavePool, balancerVault, morpho, from, to: head, chunk: logsChunk, log }); // the plan's eth_getLogs range cap
  // own-capital cycles: every swap in the newest swapBlocks blocks (about 2.5 min at 600), the same receipts budget
  const own = swapBlocks > 0 ? await swapCycles(provider, { from: Math.max(0, head - swapBlocks), to: head, chunk: Math.min(logsChunk, 2000), log }) : [];
  const flashTx = new Set(flash.map((e) => e.tx));
  const events = [...flash, ...own.filter((e) => !flashTx.has(e.tx))];
  log(`${flash.length} flash loans, ${own.length} multi-pool swap transactions`);
  const half = Math.ceil(maxTx / 2);
  const txs = [...new Set([...[...flashTx].slice(-half), ...own.filter((e) => !flashTx.has(e.tx)).slice(-(maxTx - Math.min(half, flashTx.size))).map((e) => e.tx)])];
  log(`${events.length} flash loans in ${new Set(events.map((e) => e.tx)).size} transactions; reading ${txs.length} receipts`);
  const receipts = new Map();
  await Promise.all(txs.map(async (h) => { try { const r = await provider.getTransactionReceipt(h); if (r) receipts.set(h, { status: r.status, gasUsed: r.gasUsed, effectiveGasPrice: r.gasPrice, from: r.from, to: r.to, logs: r.logs.map((l) => ({ address: l.address, topics: l.topics, data: l.data })) }); } catch (_) { /* skipped */ } }));
  const pools = new Set(); for (const r of receipts.values()) for (const l of r.logs) if (SWAPS[l.topics[0]]) pools.add(l.address.toLowerCase());
  const fi = new ethers.Interface(['function factory() view returns (address)']);
  const factoryOf = new Map();
  await Promise.all([...pools].map(async (p) => { try { factoryOf.set(p, fi.decodeFunctionResult('factory', await provider.call({ to: p, data: fi.encodeFunctionData('factory') }))[0]); } catch (_) { factoryOf.set(p, null); } }));
  // venues with a factory only: Curve's venue lists pools instead (since 2.9.8 v.factory.toLowerCase() threw here on
  // every run, so research never finished and your chain_trades table stayed empty)
  const venueOf = new Map(venues.filter((v) => typeof v.factory === 'string').map((v) => [v.factory.toLowerCase(), v.id]));
  for (const v of venues) for (const x of v.pools || []) { const a = String(x.address || x).toLowerCase(); if (/^0x[0-9a-f]{40}$/.test(a)) { factoryOf.set(a, factoryOf.get(a) || a); venueOf.set(a, v.id); } }
  const pm = new Map(assets.filter((a) => a.decimals !== null && a.price8 > 0n).map((a) => [a.address.toLowerCase(), { price8: a.price8, decimals: a.decimals }]));
  const res = analyze({ events: events.filter((e) => receipts.has(e.tx)), receipts, factoryOf, venueOf, price: (t) => pm.get(t) || null, ethPrice8 });
  res.flashLoans = events.reduce((o, e) => { o[e.source] = (o[e.source] || 0) + 1; return o; }, {});
  return { from, to: head, at: new Date().toISOString(), ...res };
}

module.exports = { T, SWAPS, flashEvents, swapCycles, analyze, run };
