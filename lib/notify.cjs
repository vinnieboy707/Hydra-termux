'use strict';
// Alerts that reach you without the dashboard open: an Android notification (Termux:API) and/or your webhook
// (CHRONOS_WEBHOOK_URL, by default your project's alerts function, device-signed; Discord- and Slack-style JSON). Texts are redacted; repeats are rate-limited.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const { redact } = require('./safety.cjs');

function onPath(cmd) {
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    try { const p = path.join(d, cmd); fs.accessSync(p, fs.constants.X_OK); return p; } catch (_) { /* next */ }
  }
  return null;
}
const STATUS_ID = '424242'; // the one pinned status notification is always edited in place
function webhookOk(u) { return /^https:\/\//.test(u || '') || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u || ''); }

function createNotifier({ webhook = null, dataDir, perIdMs = 10 * 60000, perHour = 30 } = {}) {
  const termux = onPath('termux-notification');
  const hook = webhookOk(webhook) ? webhook : null;
  const HU = require('./hookurl.cjs');
  const last = new Map(); const recent = [];
  const log = (line) => { try { fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(path.join(dataDir, 'notifications.log'), `${new Date().toISOString()} ${line}\n`, { mode: 0o600 }); } catch (_) { /* never fatal */ } };
  async function send({ id, title, text, level = 'info', minIntervalMs, buttons = [] }) {
    const now = Date.now();
    const gap = minIntervalMs !== undefined ? minIntervalMs : perIdMs;
    if (last.has(id) && now - last.get(id) < gap) return { skipped: 'repeat' };
    while (recent.length && now - recent[0] > 3600000) recent.shift();
    if (recent.length >= perHour) return { skipped: 'hourly cap' };
    last.set(id, now); recent.push(now);
    const t = redact(title).slice(0, 80), c = redact(text).slice(0, 400);
    const done = [];
    if (termux) {
      const nid = String(parseInt(crypto.createHash('sha1').update(id).digest('hex').slice(0, 6), 16));
      const args = ['--id', nid, '--group', 'chronos', '--title', t, '--content', c, '--priority', level === 'error' ? 'high' : 'default'];
      buttons.slice(0, 3).forEach((b, i) => args.push(`--button${i + 1}`, b.label, `--button${i + 1}-action`, b.action)); // a tap runs the command in Termux
      done.push(new Promise((res) => execFile(termux, args, { timeout: 8000 }, (e) => res(e ? 'termux:fail' : 'termux'))));
    }
    if (hook) {
      done.push((async () => {
        const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 8000);
        const body = JSON.stringify({ content: `${t}: ${c}`, text: `${t}: ${c}`, title: t, message: c, level, id, channel: 'notify', at: new Date(now).toISOString() });
        try { const r = await fetch(hook, { method: 'POST', headers: HU.headersFor(hook, body), body, signal: ac.signal }); return r.ok ? 'webhook' : `webhook:${r.status}`; } catch (_) { return 'webhook:fail'; } finally { clearTimeout(timer); }
      })());
    }
    const via = await Promise.all(done);
    log(`${level.toUpperCase()} ${id} ${t}: ${c} [${via.join(',') || 'log only'}]`);
    return { via };
  }
  // The money status pinned in the notification shade and on the lock screen. Edited in place without sound or
  // vibration after the first time; refreshed at most once a minute unless its headline changes. It is a status, not
  // an alert: it does not count against the alert cap and never goes to the webhook.
  let lastStatus = { title: null, at: 0 };
  async function status({ title, text, buttons = [], ongoing = true, minIntervalMs = 60000 }) {
    if (!termux) return { skipped: 'no termux' };
    const now = Date.now();
    if (title === lastStatus.title && now - lastStatus.at < minIntervalMs) return { skipped: 'throttled' };
    lastStatus = { title, at: now };
    const args = ['--id', STATUS_ID, '--group', 'chronos-status', '--title', redact(title).slice(0, 80), '--content', redact(text).slice(0, 400), '--alert-once', '--priority', 'low'];
    if (ongoing) args.push('--ongoing');
    buttons.slice(0, 3).forEach((b, i) => args.push(`--button${i + 1}`, b.label, `--button${i + 1}-action`, b.action));
    return new Promise((res) => execFile(termux, args, { timeout: 8000 }, (e) => res({ via: [e ? 'termux:fail' : 'termux'] })));
  }
  return { send, status, channels: { termux: !!termux, webhook: !!hook } };
}
module.exports = { createNotifier, onPath, STATUS_ID };
