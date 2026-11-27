'use strict';
// Chain signals: what successful flash-loan arbitrage on Arbitrum One has in common, measured from real transactions
// (chronos research reads them from receipts and event logs; every engine pools them in your chain_trades table).
// Each indicator groups the studied trades one way and measures, per group: trades, wins (succeeded AND kept money
// after gas), win rate, median and total net USD, revert rate. A group needs MIN_SAMPLES trades before it counts.
// Verdicts: exploit (wins often and pays), avoid (reverts often or loses), watch (too early / mixed).
//
//   id               groups trades by                         what the engine does with it
//   lender           flash-loan source                        prefers routes it can borrow the way winners borrow
//   legs             number of swaps                          prefers route lengths that win
//   venue            each venue in the trade                  prefers routes through winning venues
//   venue-pair       each pair of venues in one trade         prefers routes that join two venues winners join
//   asset            borrowed token                           prefers routes that start in winning tokens
//   contract         the arbitrage contract                   the leaders to study (their venues, legs, lenders)
//   sender           the sending wallet (operator fleet)      how many operators really compete
//   hour             hour of day (UTC)                        when gaps are real: tempo can run hotter then
//   unknown-venue    venues Chronos does not cover            the venues to add next (biggest winner share first)
// plus single numbers: the lowest net a winner kept (a floor that is achievable), winners' gas units p50/p90 (gas
// budget) and gas price p50/p90 (what it takes to land), and the revert rate overall.
// Nothing here moves money or changes a rule: it only re-orders which routes are quoted first, and it is shown to you.
const MIN_SAMPLES = 3;

const med = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (xs, p) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const isWin = (t) => !!t.success && Number.isFinite(t.net) && t.net > 0;

/** chain_trades rows or research analyze rows → one normal shape */
function norm(r) {
  const net = Number.isFinite(r.net_usd) ? r.net_usd : Number.isFinite(r.keptUsd) && Number.isFinite(r.gasUsd) ? r.keptUsd - r.gasUsd : null;
  const ts = r.ts || r.seen_at || r.at || null;
  return {
    tx: r.tx_hash || r.tx, contract: r.contract || null, sender: r.sender || null, lender: r.lender || r.source || 'unknown',
    success: r.success !== undefined ? !!r.success : !!r.ok, legs: Number(r.legs) || 0, venues: [...new Set(r.venues || [])], assets: [...new Set(r.assets || [])],
    gas: Number(r.gas_used ?? r.gas), gwei: Number(r.gas_price_gwei ?? r.gasPriceGwei), net, hour: ts ? new Date(ts).getUTCHours() : null,
  };
}

function group(trades, keysOf) {
  const g = new Map();
  for (const t of trades) for (const k0 of keysOf(t)) { if (k0 === null || k0 === undefined || k0 === '') continue; const k = String(k0); const s = g.get(k) || []; s.push(t); g.set(k, s); }
  return [...g].map(([key, ts]) => {
    const wins = ts.filter(isWin); const reverts = ts.filter((t) => !t.success).length;
    const winPct = Math.round((1000 * wins.length) / ts.length) / 10, revertPct = Math.round((1000 * reverts) / ts.length) / 10;
    const total = wins.reduce((a, t) => a + t.net, 0);
    const verdict = ts.length < MIN_SAMPLES ? 'watch' : revertPct >= 50 || (wins.length === 0 && ts.length >= 2 * MIN_SAMPLES) ? 'avoid' : winPct >= 30 && total > 0 ? 'exploit' : 'watch';
    return { key, samples: ts.length, wins: wins.length, winPct, revertPct, medianNetUsd: med(wins.map((t) => t.net)), totalNetUsd: Math.round(total * 1e4) / 1e4, verdict };
  }).sort((a, b) => b.totalNetUsd - a.totalNetUsd || b.wins - a.wins || b.samples - a.samples);
}

const pairs = (vs) => { const out = []; const s = [...vs].sort(); for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) out.push(`${s[i]} + ${s[j]}`); return out; };

const INDICATORS = Object.freeze([
  { id: 'lender', keys: (t) => [t.lender] },
  { id: 'legs', keys: (t) => [t.legs] },
  { id: 'venue', keys: (t) => t.venues },
  { id: 'venue-pair', keys: (t) => pairs(t.venues) },
  { id: 'asset', keys: (t) => t.assets },
  { id: 'contract', keys: (t) => [t.contract] },
  { id: 'sender', keys: (t) => [t.sender] },
  { id: 'hour', keys: (t) => [t.hour] },
  { id: 'unknown-venue', keys: (t) => t.venues.filter((v) => /^unknown factory/.test(v)) },
]);

/** rows (chain_trades or research rows) → { trades, wins, indicators: { id: groups[] }, numbers } */
function compute(rows) {
  const trades = (rows || []).map(norm).filter((t) => t.tx);
  const wins = trades.filter(isWin);
  const indicators = {}; for (const d of INDICATORS) indicators[d.id] = group(trades, d.keys);
  const numbers = {
    tradesStudied: trades.length, winners: wins.length,
    winPct: trades.length ? Math.round((1000 * wins.length) / trades.length) / 10 : null,
    revertPct: trades.length ? Math.round((1000 * trades.filter((t) => !t.success).length) / trades.length) / 10 : null,
    lowestWinningNetUsd: wins.length ? Math.min(...wins.map((t) => t.net)) : null,
    medianWinningNetUsd: med(wins.map((t) => t.net)),
    winnerGasP50: pct(wins.map((t) => t.gas), 0.5), winnerGasP90: pct(wins.map((t) => t.gas), 0.9),
    winnerGweiP50: pct(wins.map((t) => t.gwei), 0.5), winnerGweiP90: pct(wins.map((t) => t.gwei), 0.9),
  };
  return { at: new Date().toISOString(), trades: trades.length, wins: wins.length, indicators, numbers };
}

/**
 * A scoring function for routes from the signals: + for each exploit match, − for each avoid match.
 * route: { lender, legs, venues: [venueId], asset: tokenAddress } → score (0 = no evidence either way).
 */
function prior(sig) {
  if (!sig || !sig.indicators) return () => 0;
  const table = {};
  for (const id of ['lender', 'legs', 'venue', 'venue-pair', 'asset']) {
    table[id] = new Map((sig.indicators[id] || []).filter((g) => g.verdict !== 'watch').map((g) => [String(g.key).toLowerCase(), g.verdict === 'exploit' ? 1 + Math.min(2, g.winPct / 50) : -1]));
  }
  const at = (id, k) => (k === null || k === undefined ? 0 : table[id].get(String(k).toLowerCase()) || 0);
  return (r) => {
    let s = at('lender', r.lender) + at('legs', r.legs) + at('asset', r.asset);
    const vs = [...new Set(r.venues || [])]; for (const v of vs) s += at('venue', v); for (const p of pairs(vs)) s += at('venue-pair', p);
    return Math.round(s * 100) / 100;
  };
}

/** the indicators from your database (insights.chain.indicators) win over the engine's own research when both exist */
function pick(local, shared) { return shared && shared.trades >= (local ? local.trades : 0) ? shared : local || null; }

/** lines for the daily report and the dashboard */
function lines(sig) {
  if (!sig || !sig.trades) return ['CHAIN SIGNALS: no studied trades yet (research runs every 12 h)'];
  const n = sig.numbers; const top = (id, k = 3) => (sig.indicators[id] || []).filter((g) => g.verdict === 'exploit').slice(0, k).map((g) => `${g.key} (${g.wins}/${g.samples} won, $${(g.medianNetUsd || 0).toFixed(2)} median)`).join(', ') || '—';
  const avoid = Object.entries(sig.indicators).flatMap(([id, gs]) => gs.filter((g) => g.verdict === 'avoid').slice(0, 2).map((g) => `${id} ${g.key} (${g.revertPct}% reverted)`)).slice(0, 4).join(', ') || '—';
  return [
    `CHAIN SIGNALS: ${sig.trades} flash-loan trades studied · ${sig.wins} won (${n.winPct}%) · ${n.revertPct}% reverted · winners kept $${(n.medianWinningNetUsd || 0).toFixed(2)} median, $${(n.lowestWinningNetUsd || 0).toFixed(2)} lowest`,
    `  winners' gas: ${n.winnerGasP50 ?? '—'} units median (p90 ${n.winnerGasP90 ?? '—'}) at ${n.winnerGweiP50 ?? '—'} gwei (p90 ${n.winnerGweiP90 ?? '—'})`,
    `  exploit · lenders: ${top('lender')} · legs: ${top('legs')} · venues: ${top('venue')}`,
    `  exploit · venue pairs: ${top('venue-pair', 2)} · tokens: ${top('asset')}`,
    `  leaders: ${top('contract', 3)} · venues to add: ${(sig.indicators['unknown-venue'] || []).slice(0, 3).map((g) => `${g.key.replace('unknown factory ', '')} (${g.wins} wins)`).join(', ') || '—'}`,
    `  avoid: ${avoid}`,
  ];
}

module.exports = { compute, prior, pick, lines, norm, group, INDICATORS, MIN_SAMPLES };
