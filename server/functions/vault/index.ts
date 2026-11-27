import { authentic, out, service } from './auth.ts';
// Your secrets into Supabase Vault from an approved device, never through a chat or a browser:
//   POST { name: 'resend_api_key' | 'alert_email', secret }  (signed by the device, see auth.ts)  →  { ok, name }
// Only these two names, each checked for its shape; the value is never logged or returned. Used by the database's
// own email sender (chronos_email) for alerts to you.
const SHAPES: Record<string, RegExp> = {
  resend_api_key: /^re_[A-Za-z0-9_]{10,200}$/,
  alert_email: /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$/,
};
Deno.serve(async (req) => {
  const a = await authentic(req, 2_000);
  if (a instanceof Response) return a;
  let body: any;
  try { body = JSON.parse(a.raw); } catch { return out(400, { error: 'bad json' }); }
  const name = String(body?.name || ''), secret = String(body?.secret || '').trim();
  if (!SHAPES[name]) return out(400, { error: 'name must be resend_api_key or alert_email' });
  if (!SHAPES[name].test(secret)) return out(400, { error: `that does not look like a ${name === 'alert_email' ? 'email address' : 'Resend key (re_…)'}` });
  const { error } = await service().rpc('chronos_set_secret', { p_name: name, p_secret: secret });
  if (error) return out(422, { error: 'could not save it' });
  return out(200, { ok: true, name });
});
