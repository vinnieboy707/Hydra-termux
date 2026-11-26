import { authentic, out, service } from './auth.ts';
// The path to profit and the road to mainnet in one signed call (approved devices only), across all your engines:
//   POST {}  →  { routes: closest routes of the last 24 h (route_insights), killers: what kept routes from paying
//               (profit_gap), mainnet: each step done or left (mainnet_progress), watchdog: engines reported silent,
//               chain: what wins on Arbitrum from your engines' research — policies (chain_policies), the top
//               competitors (competitors) and venues (venue_usage), engines: every engine of the last hour with its
//               role (primary / standby) and what it is acting as, so a standby knows when to take over }
// Read-only. Used by the dashboard and the daily report on your phone; your portal reads the same views directly.
// chain_indicators + chain_numbers → the same shape as lib/chainsignals.cjs compute(), so engines use it unchanged
const n = (x: unknown) => (x === null || x === undefined ? null : Number(x));
function signalsOf(rows: any[], num: any) {
  const indicators: Record<string, unknown[]> = {};
  for (const r of rows) (indicators[r.id] ||= []).push({ key: r.key, samples: Number(r.samples), wins: Number(r.wins), winPct: Number(r.win_pct), revertPct: Number(r.revert_pct), medianNetUsd: n(r.median_net_usd), totalNetUsd: Number(r.total_net_usd), verdict: r.verdict });
  const m = num || {};
  return { at: new Date().toISOString(), trades: Number(m.trades || 0), wins: Number(m.wins || 0), indicators, numbers: {
    tradesStudied: Number(m.trades || 0), winners: Number(m.wins || 0), winPct: n(m.win_pct), revertPct: n(m.revert_pct),
    lowestWinningNetUsd: n(m.lowest_winning_net_usd), medianWinningNetUsd: n(m.median_winning_net_usd),
    winnerGasP50: n(m.winner_gas_p50), winnerGasP90: n(m.winner_gas_p90), winnerGweiP50: n(m.winner_gwei_p50), winnerGweiP90: n(m.winner_gwei_p90) } };
}

Deno.serve(async (req) => {
  const a = await authentic(req, 10_000);
  if (a instanceof Response) return a;
  const db = service();
  const since = new Date(Date.now() - 3600000).toISOString();
  const [routes, killers, mainnet, watchdog, policies, competitors, venues, indicators, numbers, engines] = await Promise.all([
    db.from('route_insights').select('route_key,path,legs,samples,best_net_usd,median_net_usd,best_gap_usd,avg_gross_usd,avg_premium_usd,avg_gas_usd,usual_killer,approved,last_seen').order('best_net_usd', { ascending: false }).limit(15),
    db.from('profit_gap').select('killer,samples,best_net_usd,best_gap_usd,avg_gross_usd,avg_gas_usd,last_seen').order('samples', { ascending: false }),
    db.from('mainnet_progress').select('step,what,done,detail,version').order('step'),
    db.from('watchdog_state').select('service,down,since').eq('down', true),
    db.from('chain_policies').select('key,value,samples,basis'),
    db.from('competitors').select('contract,txs,succeeded,profitable,success_pct,net_usd_total,median_net_usd,best_net_usd,median_legs,median_gas,lenders,venues,last_seen').order('net_usd_total', { ascending: false, nullsFirst: false }).limit(10),
    db.from('venue_usage').select('venue,supported,swaps,txs,in_profitable_txs,profitable_net_usd,last_seen').order('in_profitable_txs', { ascending: false }).limit(15),
    db.from('chain_indicators').select('id,key,samples,wins,win_pct,revert_pct,median_net_usd,total_net_usd,verdict').order('total_net_usd', { ascending: false }).limit(1000),
    db.from('chain_numbers').select('*').maybeSingle(),
    db.from('heartbeats').select('service,ts,role:detail->>role,acting:detail->>acting').gte('ts', since), // device roles: who is primary
  ]);
  const err = [routes, killers, mainnet, watchdog, policies, competitors, venues, indicators, numbers, engines].find((r) => r.error);
  if (err) return out(422, { error: err.error!.message });
  return out(200, { ok: true, at: new Date().toISOString(), routes: routes.data, killers: killers.data, mainnet: mainnet.data, watchdog: watchdog.data, engines: engines.data, chain: { policies: policies.data, competitors: competitors.data, venues: venues.data, signals: signalsOf(indicators.data || [], numbers.data) } });
});
