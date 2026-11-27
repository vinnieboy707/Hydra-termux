'use strict';
// This device's identity and your private releases. Node built-ins only: it also runs on a brand-new device before
// Chronos is installed (the installer downloads it next to go.sh).
//   key:      ~/.chronos/device.key (Ed25519, mode 600). It never leaves the device; the portal sees its public key
//             and a pairing code, and you approve the device there.
//   releases: only approved devices get a 120-second download link; every archive is checked against its sha256.
// CLI: node device.cjs enroll [NAME] | wait | status | latest [CURRENT] | download VERSION OUTFILE | publish FILE [NOTES]
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const BASE = process.env.CHRONOS_RELEASE_BASE || 'https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/release';
const KEYFILE = process.env.CHRONOS_DEVICE_KEY || path.join(os.homedir(), '.chronos', 'device.key');
const VER = /^\d+\.\d+\.\d+$/;
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function key() {
  let pem = null;
  try { pem = fs.readFileSync(KEYFILE, 'utf8'); } catch (_) { /* first run */ }
  if (!pem) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.mkdirSync(path.dirname(KEYFILE), { recursive: true, mode: 0o700 });
    pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(KEYFILE, pem, { mode: 0o600, flag: 'wx' });
  }
  const sk = crypto.createPrivateKey(pem);
  if (sk.asymmetricKeyType !== 'ed25519') throw new Error(KEYFILE + ' is not an Ed25519 key');
  const pub = crypto.createPublicKey(sk).export({ type: 'spki', format: 'der' }).toString('base64');
  return { sk, pub, sign: (msg) => crypto.sign(null, Buffer.from(msg), sk).toString('base64') };
}

async function post(body, headers = {}) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
async function signed(payload) {
  const k = key(); const body = JSON.stringify(payload); const ts = String(Date.now());
  return post(body, { 'x-device-pub': k.pub, 'x-chronos-ts': ts, 'x-chronos-sig': k.sign(`${ts}.${body}`) });
}
async function enroll(name = os.hostname()) {
  const k = key(); const ts = String(Date.now()); const n = String(name).slice(0, 64);
  return post(JSON.stringify({ op: 'enroll', name: n, pubkey: k.pub, ts, sig: k.sign(`enroll.${ts}.${k.pub}.${n}`) }));
}
const status = () => signed({ op: 'status' });
async function latest(current = null) { return (await signed({ op: 'latest', current: VER.test(current || '') ? current : null })).latest; }
/** Downloads a release to outFile and refuses it unless its sha256 matches the published one. */
async function download(version, outFile) {
  const d = await signed({ op: 'download', version });
  const r = await fetch(d.url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const got = sha256(buf);
  if (got !== d.sha256) throw new Error(`downloaded archive sha256 ${got} does not match the published ${d.sha256}: refused`);
  fs.writeFileSync(outFile, buf, { mode: 0o600 });
  return { file: outFile, sha256: got, size: buf.length };
}
/** your cloud engine tells your other devices which HSM executor it signs with (address derived from the KMS key) */
const offerExecutor = (address, kmsKey) => signed({ op: 'executor_offer', address, kms_key: kmsKey });
/** executors your other approved devices offered, newest first: [{ device, address, kms_key, at }] */
async function executors() { return (await signed({ op: 'executors' })).executors || []; }
/**
 * This engine's name on your server: the machine name, made unique where every phone has the same one (Termux reports
 * "localhost"): then the first 4 characters of this device's pairing code are added, e.g. localhost-45WM.
 */
function engineName(host = require('os').hostname()) {
  if (host && host !== 'localhost') return host;
  try {
    // the same digest the release service makes the pairing code from, so the name starts like the code
    const h = crypto.createHash('sha256').update(Buffer.from(key().pub, 'base64')).digest(); const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'localhost-' + [0, 1, 2, 3].map((i) => A[h[i] % 32]).join('');
  } catch (_) { return host || 'device'; }
}

/** Version of an archive: read from chronos-console/package.json inside it. */
function archiveVersion(file) {
  const { execFileSync } = require('child_process');
  const j = JSON.parse(execFileSync('tar', ['-xzOf', file, 'chronos-console/package.json'], { encoding: 'utf8' }));
  if (!VER.test(j.version || '')) throw new Error('archive has no valid version');
  return j.version;
}
async function publish(file, notes = '') {
  const buf = fs.readFileSync(file);
  const { execFileSync } = require('child_process');
  const inside = (f) => execFileSync('tar', ['-xzOf', file, 'chronos-console/' + f], { encoding: 'utf8' });
  // the installer and this helper travel with the release, so a new device always gets the matching installer
  return signed({ op: 'publish', version: archiveVersion(file), sha256: sha256(buf), notes, data_b64: buf.toString('base64'), bootstrap: { 'go.sh': inside('go.sh'), 'device.cjs': inside('lib/device.cjs') } });
}
/** Enroll if needed, then wait until you approve this device in the portal (or deny it). */
async function waitApproved({ name, log = console.log, everyMs = 5000, maxMs = 30 * 60000 } = {}) {
  let s = await enroll(name);
  if (s.status === 'approved') return s;
  log(`  This device asks to join. Pairing code: ${s.code}`);
  log('  Approve it in your portal → Devices (check the code matches). Waiting…');
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, everyMs));
    try { s = await status(); } catch (e) { if (e.status !== 403) throw e; }
    if (s.status === 'approved') return s;
    if (s.status === 'denied' || s.status === 'revoked') throw new Error(`this device was ${s.status} in the portal`);
  }
  throw new Error('not approved within 30 minutes; run the command again to keep waiting');
}

module.exports = { key, enroll, status, latest, download, publish, offerExecutor, executors, engineName, archiveVersion, waitApproved, cmp, BASE, KEYFILE };

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  const done = (x) => { if (x !== undefined) console.log(typeof x === 'string' ? x : JSON.stringify(x)); };
  const run = {
    enroll: () => enroll(a), status, wait: () => waitApproved({ name: a }).then((s) => `approved · ${s.code}`),
    name: async () => engineName(),
    latest: () => latest(a).then((l) => l || {}), download: () => download(a, b), publish: () => publish(a, b || ''),
  }[cmd];
  if (!run) { console.log('usage: node device.cjs enroll [NAME] | wait [NAME] | name | status | latest [CURRENT] | download VERSION OUT | publish FILE [NOTES]'); process.exit(2); }
  run().then(done).catch((e) => { console.error('device: ' + e.message); process.exit(e.status === 403 ? 3 : 1); });
}
