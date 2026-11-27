import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
// Engine -> cloud calls are signed by an APPROVED device: Ed25519 over `${ts}.${body}` (x-device-pub, x-chronos-ts,
// x-chronos-sig), 60-second window. There is no shared secret: a device you have not approved, or have revoked, is
// refused. The device key never leaves the device that made it.
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const PUB = /^[A-Za-z0-9+/=]{40,120}$/;
export const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const service = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
/** The raw body and the device's id if the request is signed by an approved device, otherwise a Response to send back. */
export async function authentic(req: Request, maxBody = 1_000_000): Promise<{ raw: string; device: string } | Response> {
  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  const raw = await req.text();
  if (raw.length > maxBody) return out(413, { error: 'too large' });
  const pub = req.headers.get('x-device-pub') || '', ts = req.headers.get('x-chronos-ts') || '', sig = req.headers.get('x-chronos-sig') || '';
  if (!PUB.test(pub) || !/^\d{13}$/.test(ts) || Math.abs(Date.now() - Number(ts)) > 60_000) return out(401, { error: 'stale or missing device signature' });
  let ok = false;
  try {
    const k = await crypto.subtle.importKey('spki', b64d(pub), { name: 'Ed25519' }, false, ['verify']);
    ok = await crypto.subtle.verify('Ed25519', k, b64d(sig), enc.encode(`${ts}.${raw}`));
  } catch { ok = false; }
  if (!ok) return out(401, { error: 'bad signature' });
  const { data: dev } = await service().from('devices').select('id,status,code').eq('pubkey', pub).maybeSingle();
  if (!dev) return out(403, { error: 'unknown device: run chronos device' });
  if (dev.status !== 'approved') return out(403, { error: `device ${dev.status}: approve it in the portal (code ${dev.code})` });
  return { raw, device: dev.id };
}
