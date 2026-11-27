'use strict';
// Persistence without plaintext. Two encrypted files, both unlocked by a passphrase only you know:
//   · the owner keystore (data/keystore/owner.json): your owner wallet's private key in the standard Ethereum keystore
//     format (scrypt + AES-128-CTR, the format MetaMask and geth import). Deploy, venue settings, operator and payouts
//     ask for the passphrase instead of the key. It is never unlocked by the engine on its own: every use is one you
//     start and confirm (YES), so a stolen file or a running engine cannot move your funds.
//   · the settings bundle (chronos-keys.enc): every wallet address, node url and API key in your .env (never a private
//     key in plaintext; the owner keystore travels inside it still encrypted), sealed with scrypt + AES-256-GCM. Copy it
//     to a new phone or computer (Downloads, Drive) and `chronos keys import` restores everything with one passphrase.
//   · the executor keystore (data/keystore/executor.json, 2.9.11): an operator key of yours that signs trades on this
//     phone, same standard format. Only the key agent (lib/keyagent.cjs) opens it, once, with the passphrase you type
//     at `chronos executor unlock`; it never travels in the settings bundle and never leaves this device.
// Trades are signed by the Cloud KMS HSM key (never leaves Google), or by the executor keystore through the key agent.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIN_PASS = 10;
const dirOf = (dataDir) => path.join(dataDir, 'keystore');
const NAMES = new Set(['owner', 'executor']);
const fileOf = (dataDir, name = 'owner') => { if (!NAMES.has(name)) throw new Error('unknown keystore ' + name); return path.join(dirOf(dataDir), name + '.json'); };

/** is the passphrase acceptable (length only: a long phrase beats a clever short one) */
function passOk(p) { return typeof p === 'string' && p.length >= MIN_PASS ? null : `use at least ${MIN_PASS} characters (a few words is best)`; }

/** the address in a keystore ('owner' or 'executor'), or null (read without the passphrase: the address is public) */
function keyAddress(dataDir, name = 'owner') {
  try { const j = JSON.parse(fs.readFileSync(fileOf(dataDir, name), 'utf8')); return j.address ? require('ethers').getAddress('0x' + String(j.address).replace(/^0x/, '')) : null; } catch (_) { return null; }
}
const ownerAddress = (dataDir) => keyAddress(dataDir, 'owner');
const executorAddress = (dataDir) => keyAddress(dataDir, 'executor');

/** encrypt and save a key; → its address. An existing keystore is kept (moved aside, never deleted). */
async function saveKey(dataDir, name, privateKey, passphrase, { scryptN } = {}) {
  const e = passOk(passphrase); if (e) throw new Error(e);
  const { ethers } = require('ethers');
  const w = new ethers.Wallet(String(privateKey).startsWith('0x') ? privateKey : '0x' + privateKey);
  const json = await ethers.encryptKeystoreJson({ address: w.address, privateKey: w.privateKey }, passphrase, scryptN ? { scrypt: { N: scryptN } } : {});
  fs.mkdirSync(dirOf(dataDir), { recursive: true, mode: 0o700 });
  const f = fileOf(dataDir, name);
  if (fs.existsSync(f)) fs.renameSync(f, f + '.replaced-' + Date.now()); // never delete a key file
  fs.writeFileSync(f, json, { mode: 0o600 });
  return w.address;
}

/** a wallet, unlocked with the passphrase (connected to provider if given); throws on a wrong passphrase */
async function unlockKey(dataDir, name, passphrase, provider = null) {
  const { ethers } = require('ethers');
  const w = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(fileOf(dataDir, name), 'utf8'), passphrase);
  return provider ? w.connect(provider) : w;
}
const saveOwner = (dataDir, privateKey, passphrase, o) => saveKey(dataDir, 'owner', privateKey, passphrase, o);
const unlockOwner = (dataDir, passphrase, provider = null) => unlockKey(dataDir, 'owner', passphrase, provider);

// ── settings bundle ─────────────────────────────────────────────────────────────────────────────────────────────
const MAGIC = 'chronos-keys/1';
function kdf(pass, salt) { return crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); }

/** entries [{key, value}] (+ owner keystore json) → sealed bundle text */
function seal(entries, passphrase, ownerJson = null) {
  const e = passOk(passphrase); if (e) throw new Error(e);
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kdf(passphrase, salt), iv);
  const body = Buffer.concat([c.update(JSON.stringify({ entries, ownerJson, at: new Date().toISOString() }), 'utf8'), c.final()]);
  return JSON.stringify({ magic: MAGIC, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: body.toString('base64') });
}

/** sealed bundle text → { entries, ownerJson, at }; throws on a wrong passphrase or a tampered file */
function open(text, passphrase) {
  const b = JSON.parse(text); if (b.magic !== MAGIC) throw new Error('not a Chronos keys bundle');
  const d = crypto.createDecipheriv('aes-256-gcm', kdf(passphrase, Buffer.from(b.salt, 'base64')), Buffer.from(b.iv, 'base64'));
  d.setAuthTag(Buffer.from(b.tag, 'base64'));
  let plain; try { plain = Buffer.concat([d.update(Buffer.from(b.data, 'base64')), d.final()]).toString('utf8'); } catch (_) { throw new Error('wrong passphrase, or the file was changed'); }
  return JSON.parse(plain);
}

module.exports = { saveOwner, unlockOwner, ownerAddress, saveKey, unlockKey, keyAddress, executorAddress, seal, open, passOk, fileOf, dirOf, MAGIC, MIN_PASS };
