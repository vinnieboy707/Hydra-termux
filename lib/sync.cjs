'use strict';
// Engine -> Supabase sync. One-way, signed, and never in the way of trading: a failure here is logged and
// retried, it can never block a scan or a send. Only real engine records are written (policy P0).
// Auth: every request is signed with THIS DEVICE's Ed25519 key (lib/device.cjs, ~/.chronos/device.key, mode 600) over
// `${ts}.${body}`. Supabase accepts it only while you have the device approved in the portal. There is no shared
// secret to copy anywhere. The address defaults to your project's ingest function; CHRONOS_SYNC_URL overrides it.
const fs = require('fs');
const path = require('path');
const DV = require('./device.cjs');
const { redact } = require('./safety.cjs');

const urlOk = (u) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/ingest$/i.test(u || '') || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/.*ingest$/.test(u || '');
const iso = (ms) => new Date(ms).toISOString();
const defaultUrl = () => DV.BASE.replace(/\/release\/?$/, '/ingest');
/** Headers that prove this request comes from this device (approved or not is decided by the server). */
function signedHeaders(body) {
  const k = DV.key(); const ts = String(Date.now());
  return { 'content-type': 'application/json', 'x-device-pub': k.pub, 'x-chronos-ts': ts, 'x-chronos-sig': k.sign(`${ts}.${body}`) };
}

// Row mappers: engine record -> table columns. Anything not measured stays null; nothing is invented.
const MAP = {
  opportunity: (c, block, at) => c.runParams && Number.isFinite(c.netUsd) ? { scanned_at: iso(at), block, route_key: c.routeKey, asset: c.runParams.asset, amount_raw: String(c.runParams.amount), legs: c.runParams.legs || null, gross_usd: c.grossUsd, gas_usd: c.gasUsdAssumed, premium_usd: c.premiumUsd, net_usd: c.netUsd } : null,
  shadow: (s) => s.route && Number.isFinite(s.block) ? { ts: iso(s.at), block: s.block, route_key: s.route, stage: s.stage, win: !!s.win, net_usd: s.netUsd ?? null, profit_usd: s.profitUsd ?? null, gas_usd: s.gasUsd ?? null, failed: s.failed || null, error: s.error || null } : null,
  execution: (x, now, meta = {}) => x.txHash ? { tx_hash: x.txHash, sent_at: meta.at || null, route_key: meta.route || 'unknown', status: x.status || 'success', receipt_block: x.block ?? null, gas_used: null, gas_usd: x.gasUsd ?? null, profit_usd: x.profitUsd ?? null, net_usd: x.netUsd ?? null, tax_reserve_usd: Number.isFinite(x.taxUsd) ? x.taxUsd : null, updated_at: iso(now) } : null,
  // a flash-loan transaction from chronos research (lib/research.cjs analyze rows): chain facts only
  chainTrade: (r) => (/^0x[0-9a-f]{64}$/.test(String(r.tx || '').toLowerCase()) && /^0x[0-9a-f]{40}$/.test(r.contract || '')) ? {
    tx_hash: r.tx.toLowerCase(), block: r.block, contract: r.contract, sender: r.sender || null, lender: r.source || 'unknown', assets: r.assets || [],
    success: !!r.ok, legs: Math.min(30, r.legs | 0), venues: (r.venues || []).slice(0, 40), gas_used: Number.isFinite(r.gas) ? r.gas : null,
    gas_price_gwei: Number.isFinite(r.gasPriceGwei) ? r.gasPriceGwei : null, gas_usd: Number.isFinite(r.gasUsd) ? r.gasUsd : null,
    kept_usd: Number.isFinite(r.keptUsd) ? r.keptUsd : null, net_usd: Number.isFinite(r.keptUsd) && Number.isFinite(r.gasUsd) ? r.keptUsd - r.gasUsd : null, priced: r.keptUsd !== null && r.keptUsd !== undefined,
  } : null,
  // only values a second source confirmed are ever sent
  balances: (b, block, at) => {
    const out = [];
    for (const r of b.rows || []) {
      if (r.eth && r.eth.verified) out.push({ label: r.label, token: 'ETH', address: r.address, amount: String(r.eth.amount), verified: true, block, ts: iso(at) });
      for (const t of r.tokens || []) if (t.verified) out.push({ label: r.label, token: t.symbol, address: r.address, amount: String(t.amount), verified: true, block, ts: iso(at) });
    }
    return out;
  },
};

function createSync({ url, dataDir, fetchImpl = globalThis.fetch, log = () => {}, maxQueue = 3000 } = {}) {
  url = url || defaultUrl();
  const off = (why) => ({ enabled: false, why, enqueue() {}, flush: async () => ({ sent: 0 }), pending: () => 0, call: async () => { throw new Error(why); } });
  if (!urlOk(url)) return off('CHRONOS_SYNC_URL must be your Supabase function URL (https://<ref>.supabase.co/functions/v1/ingest)');
  // records queue in memory; a device that is not enrolled or approved yet is retried with backoff
  const q = new Map(); // table -> rows
  let failures = 0, nextTry = 0, lastOk = null, lastErr = null, total = 0;
  const pending = () => [...q.values()].reduce((n, r) => n + r.length, 0);
  function enqueue(table, row) {
    if (!row) return;
    const rows = q.get(table) || []; rows.push(row); q.set(table, rows);
    while (pending() > maxQueue) { const t = [...q.keys()].find((k) => q.get(k).length); q.get(t).shift(); } // drop oldest, bounded memory
  }
  async function post(table, rows) {
    if (!fs.existsSync(DV.KEYFILE)) throw new Error('this device is not enrolled yet: chronos device');
    const body = JSON.stringify({ table, rows });
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await fetchImpl(url, { method: 'POST', headers: signedHeaders(body), body, signal: ac.signal });
      if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (_) { /* no body */ } throw new Error(`HTTP ${r.status} ${m}`.trim()); }
    } finally { clearTimeout(timer); }
  }
  // the database refusing rows (400/409/422) is permanent: retrying the same rows can never succeed and would hold up
  // everything queued behind them. Such a batch is split until the refused rows are found; those are set aside in
  // data/sync-rejected.jsonl (and counted in status), the rest is sent. Network errors and 5xx are retried with backoff.
  const permanent = (e) => /^HTTP (400|409|422)\b/.test(e.message || '');
  let rejected = 0;
  function setAside(table, rows, why) {
    rejected += rows.length;
    try { if (dataDir) { fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(path.join(dataDir, 'sync-rejected.jsonl'), rows.map((r) => JSON.stringify({ at: new Date().toISOString(), table, why, row: r })).join('\n') + '\n', { mode: 0o600 }); } } catch (_) { /* best effort */ }
    log(`sync: ${rows.length} ${table} row(s) refused by the database and set aside (${why})`);
  }
  async function sendRows(table, rows) { // → number sent; throws only on a retryable failure
    try { await post(table, rows); return rows.length; }
    catch (e) {
      if (!permanent(e)) throw e;
      if (rows.length === 1) { setAside(table, rows, redact(e.message)); return 0; }
      const mid = Math.ceil(rows.length / 2);
      return (await sendRows(table, rows.slice(0, mid))) + (await sendRows(table, rows.slice(mid)));
    }
  }
  async function flush(now = Date.now()) {
    if (now < nextTry || !pending()) return { sent: 0 };
    let sent = 0;
    for (const [table, all] of [...q.entries()]) {
      while (all.length) {
        const chunk = all.slice(0, 200);
        try { const n = await sendRows(table, chunk); all.splice(0, chunk.length); sent += n; total += n; failures = 0; lastOk = now; lastErr = null; }
        catch (e) {
          failures++; lastErr = redact(e.message || String(e)); nextTry = now + Math.min(300000, 5000 * 2 ** Math.min(failures, 6));
          log('sync failed (' + failures + '): ' + lastErr); return { sent, error: lastErr };
        }
      }
    }
    return { sent };
  }
  // signed call to a sibling function (…/functions/v1/<name>); returns its JSON or throws
  async function call(name, payload) {
    if (!/^[a-z]+$/.test(name)) throw new Error('bad function name');
    if (!fs.existsSync(DV.KEYFILE)) throw new Error('this device is not enrolled yet: chronos device');
    const body = JSON.stringify(payload);
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await fetchImpl(url.replace(/ingest$/, name), { method: 'POST', headers: signedHeaders(body), body, signal: ac.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error || ''}`.trim());
      return j;
    } finally { clearTimeout(timer); }
  }
  return { enabled: true, enqueue, flush, pending, call, status: () => ({ pending: pending(), total, lastOk, lastErr, failures, rejected }) };
}
module.exports = { createSync, signedHeaders, defaultUrl, urlOk, MAP };
