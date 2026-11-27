import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Private releases for approved devices.
//   GET  ?f=go.sh | ?f=device.cjs     the installer and device helper of the newest release (no secrets; public on purpose)
//   POST {op:'enroll', name, pubkey, ts, sig}   a device asks to join (proves it holds the key); you approve it in the portal
//   POST signed by an enrolled device (x-device-pub, x-chronos-ts, x-chronos-sig = Ed25519 over `${ts}.${body}`):
//        {op:'status'}                          its own status and pairing code
//        {op:'latest', current}                 newest release (approved devices only)
//        {op:'download', version}               a 120-second link to that release (approved devices only)
//        {op:'executor_offer', address, kms_key}  your cloud engine says which HSM executor it signs with (approved only;
//                                       it derived the address from the KMS key's own public key)
//        {op:'executors'}                       the executors your OTHER approved devices offered (approved only), so
//                                       your phone picks them up without copying anything
//        {op:'publish', version, sha256, notes, data_b64, bootstrap}   new release (devices you allowed to publish only);
//                                       bootstrap = its go.sh and lib/device.cjs, served by GET from then on
const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const PUB = /^[A-Za-z0-9+/=]{40,120}$/;
const VER = /^\d+\.\d+\.\d+$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const KMS = /^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]+\/cryptoKeys\/[A-Za-z0-9_-]+\/cryptoKeyVersions\/\d+$/;
const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

async function verify(pub: string, msg: string, sig: string) {
  try {
    const k = await crypto.subtle.importKey('spki', b64d(pub), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', k, b64d(sig), enc.encode(msg));
  } catch { return false; }
}
async function pairCode(pub: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', b64d(pub)));
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 8; i++) s += A[h[i] % 32];
  return s.slice(0, 4) + '-' + s.slice(4);
}
const fresh = (ts: string) => /^\d{13}$/.test(ts) && Math.abs(Date.now() - Number(ts)) <= 60_000;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const f = url.searchParams.get('f') || 'go.sh';
    if (f !== 'go.sh' && f !== 'device.cjs') return out(404, { error: 'not found' });
    const { data, error } = await db().storage.from('releases').download('bootstrap/' + f);
    if (error || !data) return new Response('echo "Nothing is published yet: install from chronos-console.tgz in your Downloads first, then chronos publish."; exit 1\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response(await data.text(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (req.method !== 'POST') return out(405, { error: 'GET or POST' });
  const raw = await req.text();
  if (raw.length > 8_000_000) return out(413, { error: 'too large' });
  let b: any; try { b = JSON.parse(raw); } catch { return out(400, { error: 'bad json' }); }
  const sb = db();

  if (b?.op === 'enroll') {
    const name = String(b.name || '').replace(/[^\w .@-]/g, '').slice(0, 64) || 'device';
    if (!PUB.test(b.pubkey || '') || !fresh(String(b.ts || ''))) return out(400, { error: 'bad enrollment' });
    if (!(await verify(b.pubkey, `enroll.${b.ts}.${b.pubkey}.${b.name}`, String(b.sig || '')))) return out(401, { error: 'bad signature' });
    const { data: ex } = await sb.from('devices').select('id,status,code').eq('pubkey', b.pubkey).maybeSingle();
    if (ex) return out(200, { ok: true, id: ex.id, status: ex.status, code: ex.code });
    const { count } = await sb.from('devices').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((count || 0) >= 20) return out(429, { error: 'too many pending devices; approve or deny them in the portal first' });
    const code = await pairCode(b.pubkey);
    const { data, error } = await sb.from('devices').insert({ name, pubkey: b.pubkey, code }).select('id,status,code').single();
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true, ...data });
  }

  // every other operation is signed by an enrolled device
  const pub = req.headers.get('x-device-pub') || '', ts = req.headers.get('x-chronos-ts') || '', sig = req.headers.get('x-chronos-sig') || '';
  if (!PUB.test(pub) || !fresh(ts)) return out(401, { error: 'stale or missing signature' });
  if (!(await verify(pub, `${ts}.${raw}`, sig))) return out(401, { error: 'bad signature' });
  const { data: dev } = await sb.from('devices').select('id,status,code,can_publish').eq('pubkey', pub).maybeSingle();
  if (!dev) return out(403, { error: 'unknown device: enroll first' });
  if (b?.op === 'status') return out(200, { ok: true, status: dev.status, code: dev.code, can_publish: dev.can_publish });
  if (dev.status !== 'approved') return out(403, { error: `device ${dev.status}: approve it in the portal (code ${dev.code})`, status: dev.status, code: dev.code });

  if (b?.op === 'latest') {
    await sb.from('devices').update({ last_seen: new Date().toISOString(), version: VER.test(b.current || '') ? b.current : null }).eq('id', dev.id);
    const { data: rel, error } = await sb.from('releases').select('version,sha256,size_bytes,notes,created_at');
    if (error) return out(422, { error: error.message });
    const top = (rel || []).sort((x: any, y: any) => cmp(y.version, x.version))[0] || null;
    return out(200, { ok: true, latest: top });
  }
  if (b?.op === 'executor_offer') {
    if (!ADDR.test(b.address || '') || !KMS.test(b.kms_key || '')) return out(400, { error: 'bad executor: address 0x… and a full KMS key version name' });
    const { error } = await sb.from('devices').update({ executor_address: b.address, kms_key: b.kms_key, executor_at: new Date().toISOString() }).eq('id', dev.id);
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true });
  }
  if (b?.op === 'executors') {
    const { data, error } = await sb.from('devices').select('name,executor_address,kms_key,executor_at').eq('status', 'approved').neq('id', dev.id).not('executor_address', 'is', null).order('executor_at', { ascending: false });
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true, executors: (data || []).map((d: any) => ({ device: d.name, address: d.executor_address, kms_key: d.kms_key, at: d.executor_at })) });
  }
  if (b?.op === 'download') {
    if (!VER.test(b.version || '')) return out(400, { error: 'bad version' });
    const { data: rel } = await sb.from('releases').select('path,sha256,size_bytes').eq('version', b.version).maybeSingle();
    if (!rel) return out(404, { error: 'no such release' });
    const { data, error } = await sb.storage.from('releases').createSignedUrl(rel.path, 120);
    if (error) return out(422, { error: error.message });
    return out(200, { ok: true, url: data.signedUrl, sha256: rel.sha256, size: rel.size_bytes });
  }
  if (b?.op === 'publish') {
    if (!dev.can_publish) return out(403, { error: 'this device may not publish: allow it in the portal' });
    if (!VER.test(b.version || '') || !/^[0-9a-f]{64}$/.test(b.sha256 || '') || typeof b.data_b64 !== 'string') return out(400, { error: 'bad release' });
    const bytes = b64d(b.data_b64);
    if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== b.sha256) return out(400, { error: 'sha256 does not match the uploaded archive' });
    const { data: rel } = await sb.from('releases').select('version');
    if ((rel || []).some((r: any) => cmp(r.version, b.version) >= 0)) return out(409, { error: `version ${b.version} is not newer than what is published` });
    const path = `v${b.version}/chronos-console.tgz`;
    const up = await sb.storage.from('releases').upload(path, bytes, { contentType: 'application/gzip', upsert: false });
    if (up.error) return out(422, { error: up.error.message });
    const { error } = await sb.from('releases').insert({ version: b.version, sha256: b.sha256, size_bytes: bytes.length, path, notes: String(b.notes || '').slice(0, 2000), published_by: dev.id });
    if (error) return out(422, { error: error.message });
    for (const f of ['go.sh', 'device.cjs']) {
      const t = b.bootstrap && typeof b.bootstrap[f] === 'string' ? b.bootstrap[f] : null;
      if (t && t.length < 200_000) await sb.storage.from('releases').upload('bootstrap/' + f, new TextEncoder().encode(t), { contentType: 'text/plain', upsert: true });
    }
    return out(200, { ok: true, version: b.version });
  }
  return out(400, { error: 'unknown op' });
});
