'use strict';
// Scan history with a per-install HMAC on every line, so nothing typed or pasted into the file by hand can show up
// in the dashboard as if it were a real scan. Lines that fail the check are ignored and counted.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function keyFor(dir) {
  const f = path.join(dir, '.history_key');
  try { const k = fs.readFileSync(f); if (k.length === 32) return k; } catch (_) { /* create */ }
  fs.mkdirSync(dir, { recursive: true });
  const k = crypto.randomBytes(32);
  fs.writeFileSync(f, k, { mode: 0o600 });
  return k;
}
const FIELDS = ['t', 'block', 'gas', 'best', 'approved', 'ms', 'quotes', 'fails'];
const mac = (key, rec) => crypto.createHmac('sha256', key).update(JSON.stringify(FIELDS.map((k) => rec[k]))).digest('hex');

function append(dir, rec) {
  const key = keyFor(dir);
  const r = {}; for (const k of FIELDS) r[k] = rec[k];
  fs.appendFileSync(path.join(dir, 'console_history.jsonl'), JSON.stringify({ ...r, mac: mac(key, r) }) + '\n');
}
function load(dir, limit = 240) {
  let lines = [];
  try { lines = fs.readFileSync(path.join(dir, 'console_history.jsonl'), 'utf8').trim().split('\n').filter(Boolean); } catch (_) { return { records: [], rejected: 0 }; }
  const key = keyFor(dir); const records = []; let rejected = 0;
  for (const l of lines) {
    try {
      const r = JSON.parse(l);
      const ok = r && typeof r.mac === 'string' && r.mac.length === 64 && crypto.timingSafeEqual(Buffer.from(r.mac, 'hex'), Buffer.from(mac(key, r), 'hex'))
        && Number.isFinite(r.t) && Number.isInteger(r.block) && Number.isFinite(r.gas) && (r.best === null || Number.isFinite(r.best));
      if (ok) records.push(r); else rejected++;
    } catch (_) { rejected++; }
  }
  return { records: records.slice(-limit), rejected };
}
module.exports = { append, load, keyFor };
