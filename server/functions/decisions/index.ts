import { authentic, out, service } from './auth.ts';

// Owner decisions back to the engine. Returns only ref + yes/no: the action itself lives on the engine, so nothing
// here can make the engine do something it did not propose.
//   {op:'list'}                 -> decided, not yet applied: [{ref, status, decided_at}]
//   {op:'ack', ref, result}     -> marks it applied (result: short text)
Deno.serve(async (req) => {
  const a = await authentic(req, 10_000);
  if (a instanceof Response) return a;
  const raw = a.raw;
  let b: any;
  try { b = JSON.parse(raw); } catch { return out(400, { error: 'bad json' }); }
  const db = service();
  if (b?.op === 'list') {
    const { data, error } = await db.from('approvals').select('ref,status,decided_at').in('status', ['approved', 'denied']).is('applied_at', null).not('ref', 'is', null).limit(50);
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true, decisions: data });
  }
  if (b?.op === 'ack' && typeof b.ref === 'string' && /^[0-9a-f]{32}$/.test(b.ref)) {
    const { error } = await db.from('approvals').update({ applied_at: new Date().toISOString(), applied_result: String(b.result || '').slice(0, 300) }).eq('ref', b.ref).is('applied_at', null);
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true });
  }
  return out(400, { error: 'op must be list or ack' });
});
