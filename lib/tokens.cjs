'use strict';
// Token discovery: which tokens to look for pools between, beyond Aave's own reserves.
// Source: Blockscout's public token list for Arbitrum One (ranked by market cap; only tokens with reputation "ok" and
// trading volume in the last 24 h). The list only nominates tokens: each one is then checked on-chain (decimals and
// symbol read at the scan's node), and it only matters if real pools with liquidity exist for it. Nothing from the
// list is used as a price or an amount.
const fs = require('fs');
const path = require('path');
const { clean } = require('./safety.cjs');

const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '');

async function fetchList({ url, limit, fetchImpl = fetch, timeoutMs = 15000 }) {
  const out = []; let params = null;
  for (let page = 0; page < 10 && out.length < limit; page++) {
    const q = new URLSearchParams({ type: 'ERC-20', ...(params || {}) });
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    let j;
    try {
      const r = await fetchImpl(`${url}/api/v2/tokens?${q}`, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`token list HTTP ${r.status}`);
      j = await r.json();
    } finally { clearTimeout(t); }
    for (const it of j.items || []) {
      const a = it.address_hash || it.address;
      if (!isAddr(a) || it.reputation && it.reputation !== 'ok' || !(Number(it.volume_24h) > 0)) continue;
      out.push({ address: a.toLowerCase(), listedSymbol: clean(String(it.symbol || ''), 12) });
      if (out.length >= limit) break;
    }
    if (!j.next_page_params) break;
    params = Object.fromEntries(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)]));
  }
  return out;
}

/** nominated token addresses (lowercase), cached; [] when discovery is off or the list cannot be reached */
async function discover({ url, limit, cacheFile, cacheMin = 720, fetchImpl, log = () => {} }) {
  if (!url || !(limit > 0)) return [];
  const key = `${url}|${limit}`;
  if (cacheFile) {
    try { const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); if (c.key === key && Date.now() - c.at < cacheMin * 60000) return c.tokens; } catch (_) { /* no cache */ }
  }
  try {
    const tokens = await fetchList({ url, limit, fetchImpl });
    if (cacheFile) { try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify({ key, at: Date.now(), tokens })); } catch (_) { /* optional */ } }
    return tokens;
  } catch (e) {
    log('token discovery unavailable (' + String(e.message || e).slice(0, 80) + '): scanning Aave tokens and SCAN_EXTRA_TOKENS only');
    if (cacheFile) { try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')).tokens || []; } catch (_) { /* none */ } }
    return [];
  }
}

module.exports = { discover, fetchList };
