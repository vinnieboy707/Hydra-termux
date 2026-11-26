'use strict';
// The background engine publishes its state here; the dashboard follows it. Every write is HMAC-signed with the
// per-install key, so nothing edited or pasted into the file can show up on screen as if the engine had produced it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { keyFor } = require('./history.cjs');

const fileFor = (dataDir) => path.join(dataDir, 'live', 'state.json');
const mac = (key, body) => crypto.createHmac('sha256', key).update(body).digest('hex');

function write(dataDir, state) {
  const key = keyFor(dataDir);
  const body = JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
  const dir = path.join(dataDir, 'live');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `.state.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ body, sig: mac(key, body) }), { mode: 0o600 });
  fs.renameSync(tmp, fileFor(dataDir));
}
function read(dataDir) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(fileFor(dataDir), 'utf8')); } catch (_) { return { ok: false, reason: 'none' }; }
  try {
    const key = keyFor(dataDir);
    const good = typeof raw.sig === 'string' && raw.sig.length === 64 && typeof raw.body === 'string' && crypto.timingSafeEqual(Buffer.from(raw.sig, 'hex'), Buffer.from(mac(key, raw.body), 'hex'));
    if (!good) return { ok: false, reason: 'signature' };
    return { ok: true, state: JSON.parse(raw.body) };
  } catch (_) { return { ok: false, reason: 'signature' }; }
}
function alive(state, maxAgeMs) {
  if (!state || !state.heartbeat) return false;
  if (Date.now() - state.heartbeat > maxAgeMs) return false;
  try { process.kill(state.pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
/** Control files the dashboard drops for the engine: scan now, pause/resume. */
const control = {
  poke: (dataDir) => { fs.mkdirSync(path.join(dataDir, 'live'), { recursive: true }); fs.writeFileSync(path.join(dataDir, 'live', 'scan-now'), String(Date.now())); },
  setPaused: (dataDir, on) => { const f = path.join(dataDir, 'live', 'paused'); if (on) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, String(Date.now())); } else { try { fs.unlinkSync(f); } catch (_) { /* not paused */ } } },
  isPaused: (dataDir) => fs.existsSync(path.join(dataDir, 'live', 'paused')),
  takePoke: (dataDir) => { const f = path.join(dataDir, 'live', 'scan-now'); if (!fs.existsSync(f)) return false; try { fs.unlinkSync(f); } catch (_) { /* raced */ } return true; },
};
module.exports = { write, read, alive, control, fileFor };
