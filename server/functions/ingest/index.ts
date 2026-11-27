import { authentic, out, service } from './auth.ts';

// Engine -> database sync, accepted only from devices you approved (see auth.ts). Only the allowlisted columns of the
// allowlisted tables are written.
// approvals: the engine may only CREATE a pending proposal (ref, agent, kind, title, detail). It can never set the
// status; only the owner can, in the portal. An existing ref is never overwritten.
const TABLES: Record<string, { cols: string[]; conflict?: string; ignoreDuplicates?: boolean }> = {
  opportunities: { cols: ['scanned_at','block','route_key','asset','amount_raw','legs','gross_usd','gas_usd','premium_usd','net_usd'], conflict: 'block,route_key' },
  shadow_runs: { cols: ['ts','block','route_key','stage','win','net_usd','profit_usd','gas_usd','failed','error'], conflict: 'block,route_key' },
  executions: { cols: ['tx_hash','sent_at','route_key','status','receipt_block','gas_used','gas_usd','profit_usd','net_usd','tax_reserve_usd','updated_at'], conflict: 'tx_hash' },
  mode_events: { cols: ['ts','mode','reason'] },
  balances_verified: { cols: ['label','token','address','amount','verified','block','ts'], conflict: 'label,token' },
  heartbeats: { cols: ['service','ts','mode','version','detail'], conflict: 'service' },
  agent_events: { cols: ['ts','agent','severity','source','message','action','outcome','detail'] },
  approvals: { cols: ['ref','agent','kind','title','detail'], conflict: 'ref', ignoreDuplicates: true },
  payouts: { cols: ['ts','tx_hash','kind','token','amount_raw','amount_usd','to_address','block'], conflict: 'tx_hash' },
  // the company's daily reports, immediate alerts and build requests (read in the portal; owner-only)
  reports: { cols: ['day','kind','title','body','critical'] },
  // path to profit: the closest routes of a scan with their cost breakdown (device is set here, never by the engine)
  route_stats: { cols: ['ts','block','route_key','path','legs','lender','size_usd','gross_usd','premium_usd','gas_usd','net_usd','floor_usd','killer','approved'], conflict: 'device,block,route_key', ignoreDuplicates: true },
  // chain research: flash-loan transactions the engine read from receipts (one row per transaction, first report kept)
  chain_trades: { cols: ['tx_hash','block','contract','sender','lender','assets','success','legs','venues','gas_used','gas_price_gwei','gas_usd','kept_usd','net_usd','priced'], conflict: 'tx_hash', ignoreDuplicates: true },
  // price-move relay: which watched pools moved, broadcast at once to every engine (device set here)
  pool_moves: { cols: ['block','pools'] },
};
const ADDR = /^0x[0-9a-f]{40}$/;
const KILLERS = ['no price gap','flash-loan fee','gas','below your floor','price impact cap','flash liquidity','venue not executable','gas ceiling','other rule','none'];

Deno.serve(async (req) => {
  const a = await authentic(req);
  if (a instanceof Response) return a;
  const raw = a.raw;
  let body: any;
  try { body = JSON.parse(raw); } catch { return out(400, { error: 'bad json' }); }
  const spec = TABLES[body?.table];
  if (!spec) return out(400, { error: 'unknown table' });
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 500) return out(400, { error: 'rows 1..500' });
  const rows = body.rows.map((r: Record<string, unknown>) => Object.fromEntries(spec.cols.filter((c) => r[c] !== undefined).map((c) => [c, r[c]])));
  if (body.table === 'reports' && rows.some((r: any) => !['daily-report', 'alert', 'build-request', 'audit'].includes(r.kind) || typeof r.title !== 'string' || r.title.length > 200)) return out(400, { error: 'bad report' });
  if (body.table === 'route_stats') {
    if (rows.some((r: any) => !KILLERS.includes(r.killer) || typeof r.route_key !== 'string' || !Number.isFinite(r.net_usd))) return out(400, { error: 'bad route_stats row' });
    for (const r of rows) r.device = a.device;
  }
  if (body.table === 'chain_trades') {
    if (rows.some((r: any) => typeof r.tx_hash !== 'string' || !/^0x[0-9a-f]{64}$/.test(r.tx_hash) || !ADDR.test(r.contract) || typeof r.lender !== 'string' || typeof r.success !== 'boolean' || !Number.isInteger(r.legs) || r.legs < 0 || r.legs > 30 || (r.venues !== undefined && (!Array.isArray(r.venues) || r.venues.length > 40)))) return out(400, { error: 'bad chain_trades row' });
    for (const r of rows) r.device = a.device;
  }
  if (body.table === 'pool_moves') {
    if (rows.length > 20 || rows.some((r: any) => !Number.isInteger(r.block) || r.block <= 0 || !Array.isArray(r.pools) || r.pools.length < 1 || r.pools.length > 500 || r.pools.some((x: unknown) => typeof x !== 'string' || !ADDR.test(x)))) return out(400, { error: 'bad pool_moves row' });
    for (const r of rows) r.device = a.device;
  }
  if (body.table === 'approvals' && rows.some((r: any) => typeof r.ref !== 'string' || !/^[0-9a-f]{32}$/.test(r.ref))) return out(400, { error: 'bad ref' });
  const db = service();
  const q = spec.conflict
    ? db.from(body.table).upsert(rows, { onConflict: spec.conflict, ignoreDuplicates: !!spec.ignoreDuplicates })
    : db.from(body.table).insert(rows);
  const { error } = await q;
  if (error) return out(422, { error: error.message });
  // the price-move relay: every engine listening on Realtime topic chronos-pool-moves gets the moved pools at once
  if (body.table === 'pool_moves') {
    const base = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const messages = rows.map((r: any) => ({ topic: 'chronos-pool-moves', event: 'moves', payload: { block: r.block, pools: r.pools, at: new Date().toISOString() }, private: false }));
    const b = await fetch(`${base}/realtime/v1/api/broadcast`, { method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ messages }) }).catch(() => null);
    return out(200, { ok: true, written: rows.length, broadcast: !!(b && b.ok) });
  }
  return out(200, { ok: true, written: rows.length });
});
