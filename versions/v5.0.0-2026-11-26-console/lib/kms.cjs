'use strict';
// Executor signer backed by Google Cloud KMS. The key is an HSM-protected secp256k1 key (Cloud KMS supports that
// curve only at the HSM protection level): it cannot be exported, this code never sees it, and every signature is
// recorded in Cloud Audit Logs. Each transaction hash is sent to KMS (asymmetricSign) and the returned DER
// signature is turned into an Ethereum signature (low-s, recovery id found by recovering the key's own address).
// Auth: the Google Compute Engine metadata server (the VM's service account, which should hold only
// roles/cloudkms.signerVerifier on this one key). No SDK: two HTTPS calls, easy to audit.
const { ethers } = require('ethers');

const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'); // secp256k1 group order
const KEY_RE = /^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]+\/cryptoKeys\/[A-Za-z0-9_-]+\/cryptoKeyVersions\/\d+$/;
const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** DER ECDSA signature → { r, s } (SEQUENCE { INTEGER r, INTEGER s }). */
function parseDer(buf) {
  let i = 0;
  const fail = () => { throw new Error('KMS returned a malformed DER signature'); };
  if (buf[i++] !== 0x30) fail();
  let len = buf[i++];
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = (len << 8) | buf[i++]; }
  if (i + len !== buf.length) fail();
  const int = () => { if (buf[i++] !== 0x02) fail(); const l = buf[i++]; if (!l || i + l > buf.length) fail(); const v = BigInt('0x' + buf.subarray(i, i + l).toString('hex')); i += l; return v; };
  const r = int(), s = int();
  if (i !== buf.length || r <= 0n || s <= 0n || r >= N || s >= N) fail();
  return { r, s };
}
/** SubjectPublicKeyInfo PEM of a secp256k1 key → 65-byte uncompressed point. */
function pointFromPem(pem) {
  const der = Buffer.from(String(pem).replace(/-----[A-Z ]+-----|\s/g, ''), 'base64');
  const SECP256K1_OID = Buffer.from('06052b8104000a', 'hex');
  if (der.indexOf(SECP256K1_OID) < 0) throw new Error('KMS key is not on the secp256k1 curve');
  const pt = der.subarray(der.length - 65);
  if (pt[0] !== 0x04) throw new Error('KMS public key is not an uncompressed EC point');
  return pt;
}
const hex32 = (v) => '0x' + v.toString(16).padStart(64, '0');

function endpointOk(u) { return /^https:\/\//.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u); }

class KmsSigner extends ethers.AbstractSigner {
  /**
   * @param {string} keyName projects/…/locations/…/keyRings/…/cryptoKeys/…/cryptoKeyVersions/N
   * @param {object} [opts] endpoint (default Cloud KMS), token (async () => access token; default: VM metadata server)
   */
  constructor(keyName, provider = null, opts = {}) {
    super(provider);
    if (!KEY_RE.test(keyName || '')) throw new Error('CHRONOS_EXECUTOR_KMS_KEY must be a full key version name: projects/…/locations/…/keyRings/…/cryptoKeys/…/cryptoKeyVersions/N');
    const endpoint = opts.endpoint || process.env.CHRONOS_KMS_ENDPOINT || 'https://cloudkms.googleapis.com/v1/';
    if (!endpointOk(endpoint)) throw new Error('KMS endpoint must be https (or localhost for tests)');
    this.keyName = keyName; this.opts = { ...opts, endpoint };
    this._token = opts.token || metadataToken(opts.fetchImpl || fetch);
    this._fetch = opts.fetchImpl || fetch;
    this._address = null;
  }
  connect(provider) { const s = new KmsSigner(this.keyName, provider, this.opts); s._address = this._address; return s; }
  async _api(method, suffix, body) {
    const token = await this._token();
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await this._fetch(this.opts.endpoint + this.keyName + suffix, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ac.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`KMS ${suffix.replace(/^[:/]/, '')} failed: ${r.status} ${(j.error && j.error.status) || ''}`.trim());
      return j;
    } finally { clearTimeout(t); }
  }
  async getAddress() {
    if (this._address) return this._address;
    const j = await this._api('GET', '/publicKey');
    if (j.algorithm && j.algorithm !== 'EC_SIGN_SECP256K1_SHA256') throw new Error(`KMS key algorithm is ${j.algorithm}; it must be EC_SIGN_SECP256K1_SHA256`);
    if (j.protectionLevel && j.protectionLevel !== 'HSM') throw new Error(`KMS key protection level is ${j.protectionLevel}; it must be HSM`);
    this._address = ethers.computeAddress('0x' + pointFromPem(j.pem).toString('hex'));
    return this._address;
  }
  /** Signs a 32-byte digest in KMS; returns an Ethereum signature that recovers to this key's address. */
  async signDigest(digest) {
    const d = ethers.getBytes(digest);
    if (d.length !== 32) throw new Error('digest must be 32 bytes');
    const address = await this.getAddress();
    // KMS signs the 32 bytes it is given as the "sha256" digest without hashing again: here that is keccak256.
    const j = await this._api('POST', ':asymmetricSign', { digest: { sha256: Buffer.from(d).toString('base64') } });
    let { r, s } = parseDer(Buffer.from(j.signature || '', 'base64'));
    if (s > N / 2n) s = N - s; // Ethereum accepts only low-s signatures (EIP-2)
    for (const v of [27, 28]) {
      const sig = ethers.Signature.from({ r: hex32(r), s: hex32(s), v });
      if (ethers.recoverAddress(d, sig) === address) return sig;
    }
    throw new Error('KMS signature does not recover to the executor address; refusing to use it');
  }
  async signTransaction(tx) {
    const t = ethers.Transaction.from({ ...tx, from: undefined });
    if (tx.from && ethers.getAddress(tx.from) !== await this.getAddress()) throw new Error('transaction from does not match the KMS executor address');
    t.signature = await this.signDigest(t.unsignedHash);
    return t.serialized;
  }
  async signMessage(message) { return (await this.signDigest(ethers.hashMessage(message))).serialized; }
  async signTypedData(domain, types, value) { return (await this.signDigest(ethers.TypedDataEncoder.hash(domain, types, value))).serialized; }
}

/** Access token from the VM's metadata server, cached until a minute before it expires. */
function metadataToken(fetchImpl) {
  let cached = null;
  return async () => {
    if (cached && Date.now() < cached.until) return cached.token;
    const url = process.env.CHRONOS_METADATA_TOKEN_URL || METADATA_TOKEN;
    if (!endpointOk(url) && !url.startsWith('http://metadata.google.internal/')) throw new Error('metadata url refused');
    const r = await fetchImpl(url, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!r.ok) throw new Error(`no Google credentials on this machine (metadata server ${r.status}); the KMS signer runs on the Google Cloud VM`);
    const j = await r.json();
    cached = { token: j.access_token, until: Date.now() + Math.max(0, (Number(j.expires_in) || 300) - 60) * 1000 };
    return cached.token;
  };
}

module.exports = { KmsSigner, parseDer, pointFromPem, KEY_RE, N };
