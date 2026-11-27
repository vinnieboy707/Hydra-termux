'use strict';
// Alert webhook: incidents, resolution attempts, verifications and escalations are POSTed as JSON to the https url you
// set (CHRONOS_ALERT_WEBHOOK_URL), signed with HMAC-SHA256 over "timestamp.body" when CHRONOS_ALERT_WEBHOOK_SECRET is
// set (header x-chronos-signature: t=<unix seconds>,v1=<hex>). Text is redacted before it leaves; the same event is
// not sent twice within a minute; to your own project's alerts function (lib/hookurl.cjs) it is device-signed instead; a slow or failing webhook never blocks the engine.
const crypto = require('crypto');
const os = require('os');
const { redact } = require('./safety.cjs');

function createWebhook({ url, secret = null, fetchImpl = globalThis.fetch, version = null, host = os.hostname(), now = () => Date.now(), minGapMs = 60000, log = () => {} }) {
  if (!/^https:\/\/\S+$/.test(url || '')) return null;
  const last = new Map();
  return async function send(kind, payload) {
    const key = kind + ':' + JSON.stringify(payload).slice(0, 200);
    const t = now(); if (last.has(key) && t - last.get(key) < minGapMs) return { skipped: 'duplicate' };
    last.set(key, t); if (last.size > 500) last.delete(last.keys().next().value);
    const body = JSON.stringify({ source: 'chronos', kind, at: new Date(t).toISOString(), host, version, ...JSON.parse(redact(JSON.stringify(payload))) });
    const own = require('./hookurl.cjs').isOwn(url);
    const headers = { ...(own ? require('./hookurl.cjs').headersFor(url, body) : { 'content-type': 'application/json' }), 'user-agent': 'chronos-webhook' };
    if (secret && !own) { const ts = Math.floor(t / 1000); headers['x-chronos-signature'] = `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`; }
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 8000);
    try { const r = await fetchImpl(url, { method: 'POST', headers, body, signal: ac.signal }); return { status: r.status }; }
    catch (e) { log('webhook failed: ' + redact(String(e.message)).slice(0, 80)); return { error: true }; }
    finally { clearTimeout(timer); }
  };
}

module.exports = { createWebhook };
