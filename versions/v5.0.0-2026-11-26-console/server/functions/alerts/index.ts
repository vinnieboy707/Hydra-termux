import { authentic, out, service } from './auth.ts';
// Your own alert webhook (the default for CHRONOS_ALERT_WEBHOOK_URL and CHRONOS_WEBHOOK_URL): the engine posts its
// alerts here signed by an approved device (no shared secret), and the ones you asked to hear about are kept in
// `reports` (kind 'alert'), shown in your portal under "Reports and alerts from your VP". Kept: escalations (Chronos
// needs you), critical/error alerts, a failure's mirror that pays, money made or lost (profit, executions), and the
// verify-real test event. The rest (each resolver step, info notices) stays in the engine's own log and agent activity: answered 200 { kept: false }.
const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const keep = (b: any) => {
  const kind = String(b?.kind || ''), level = String(b?.level || b?.severity || 'info'), id = String(b?.id || '');
  if (kind === 'verify' || kind === 'escalated') return true;
  if (/critical|error|fatal/i.test(level)) return true;
  if (kind === 'mirror' && level === 'success') return true; // a failure's mirror that pays (the VP's own wins arrive through sync)
  return /^(profit|exec:)/.test(id);
};
Deno.serve(async (req) => {
  const a = await authentic(req, 20_000);
  if (a instanceof Response) return a;
  let b: any;
  try { b = JSON.parse(a.raw); } catch { return out(400, { error: 'bad json' }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return out(400, { error: 'expected a JSON object' });
  if (!keep(b)) return out(200, { ok: true, kept: false });
  const title = String(b.title || (b.kind === 'escalated' && b.symptom ? `Chronos needs you: ${b.symptom}` : '') || (b.kind ? `Chronos ${b.kind}` : '') || 'Chronos alert').slice(0, 200);
  const level = String(b.level || b.severity || 'info');
  const at = typeof b.at === 'string' && !isNaN(Date.parse(b.at)) ? b.at : new Date().toISOString();
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) if (JSON.stringify(v ?? null).length <= 4000) body[k] = v;
  const { error } = await service().from('reports').insert({ day: day(at), kind: 'alert', title, body: { ...body, device: a.device }, critical: b.kind === 'escalated' || /critical|error|fatal/i.test(level) });
  if (error) return out(422, { error: error.message });
  return out(200, { ok: true, kept: true });
});
