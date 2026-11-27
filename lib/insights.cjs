'use strict';
// Path to profit, measured: the routes that came closest in a scan, each with its whole cost breakdown and the one
// thing that kept it from paying (the "killer"). Uploaded every 5 minutes (table route_stats) so your portal and the
// insights function can show, across all your engines, how far from profit each route is and why. Only numbers this
// scan measured are sent; a missing value stays null.
const { routeKey } = require('./session.cjs');

const KILLERS = ['dead pool', 'no price gap', 'flash-loan fee', 'gas', 'below your floor', 'price impact cap', 'flash liquidity', 'venue not executable', 'gas ceiling', 'other rule', 'none'];
const num = (x) => (Number.isFinite(x) ? x : null);

/** the one thing that kept this candidate from being sent, cheapest explanation first */
function killer(c, floorUsd) {
  if (c.approved) return 'none';
  // losing more than 5% of the size is not a missing gap: a pool on the route has a price and nothing behind it
  if (Number.isFinite(c.grossUsd) && Number.isFinite(c.amountUsd) && c.amountUsd > 0 && c.grossUsd < -0.05 * c.amountUsd) return 'dead pool';
  if (Number.isFinite(c.grossUsd) && c.grossUsd <= 0) return 'no price gap';
  if (Number.isFinite(c.grossUsd) && Number.isFinite(c.premiumUsd) && c.grossUsd - c.premiumUsd <= 0) return 'flash-loan fee';
  if (Number.isFinite(c.netUsd) && c.netUsd <= 0) return 'gas';
  if (Number.isFinite(c.netUsd) && Number.isFinite(floorUsd) && c.netUsd < floorUsd) return 'below your floor';
  const why = (c.reasons || []).join(' ');
  if (/impact/.test(why)) return 'price impact cap';
  if (/liquidity|flash-loanable/.test(why)) return 'flash liquidity';
  if (/NOT_EXECUTABLE/.test(why)) return 'venue not executable';
  if (/STANDBY_GAS|gas ceiling/i.test(why)) return 'gas ceiling';
  return 'other rule';
}

/** route_stats rows for the n candidates closest to profit in one scan result */
function nearMisses(res, floorUsd, n = 10, at = Date.now()) {
  if (!res || !Number.isFinite(res.blockNumber)) return [];
  return (res.candidates || []).filter((c) => Number.isFinite(c.netUsd) && (c.legsCount || 0) >= 2).slice().sort((a, b) => b.netUsd - a.netUsd).slice(0, n).map((c) => ({
    ts: new Date(at).toISOString(), block: res.blockNumber, route_key: routeKey(c), path: (c.loopPath || c.path || []).join('>').slice(0, 200),
    legs: Math.min(6, c.legsCount), lender: (c.flash && c.flash.provider) || 'aave_v3',
    size_usd: num(c.amountUsd), gross_usd: num(c.grossUsd), premium_usd: num(c.premiumUsd), gas_usd: num(c.gasUsdAssumed), net_usd: c.netUsd,
    floor_usd: num(floorUsd), killer: killer(c, floorUsd), approved: !!c.approved,
  }));
}

const usd = (v) => (Number.isFinite(Number(v)) && v !== null ? (Number(v) < 0 ? '-$' : '$') + Math.abs(Number(v)).toFixed(2) : '—');

/** the insights function's answer as plain lines (daily report, dashboard); [] when there is no answer */
function summarize(j) {
  if (!j || !j.ok) return [];
  const out = [];
  const m = j.mainnet || []; const done = m.filter((x) => x.done).length; const next = m.find((x) => !x.done);
  if (m.length) out.push(`ROAD TO MAINNET: ${done}/${m.length} done${next ? ` · next: ${next.what}${next.version ? ` (version ${next.version})` : ''}: ${next.detail}` : ' · every step done'}`);
  const r = (j.routes || [])[0];
  const k = (j.killers || []).filter((x) => x.killer !== 'none'); const tot = k.reduce((s, x) => s + Number(x.samples || 0), 0);
  if (r) out.push(`PATH TO PROFIT (24 h, all engines): closest ${r.path} best ${usd(r.best_net_usd)} (${usd(r.best_gap_usd)} vs your floor) over ${r.samples} samples · usually stopped by ${r.usual_killer}`);
  else out.push('PATH TO PROFIT: no route data uploaded yet (it fills in every 5 minutes while an engine scans)');
  if (tot) out.push('  stopped by: ' + k.slice(0, 4).map((x) => `${x.killer} ${Math.round((100 * x.samples) / tot)}%`).join(' · '));
  for (const w of j.watchdog || []) out.push(`  ENGINE SILENT: ${w.service} since ${w.since}`);
  return out;
}

/** ask the insights function (signed by this device); null when unreachable or not approved */
async function fetchInsights(sync) {
  if (!sync || !sync.enabled) return null;
  try { const j = await sync.call('insights', {}); return j && j.ok ? { ...j, fetchedAt: Date.now() } : null; } catch (_) { return null; }
}

module.exports = { killer, nearMisses, summarize, fetchInsights, KILLERS };
