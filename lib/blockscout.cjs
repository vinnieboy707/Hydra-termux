'use strict';
// Blockscout: an index of Arbitrum One that Chronos does not run and your node providers do not feed, so it is the
// independent witness for everything the engine claims about the chain: the chain head, what a contract is and who
// created it, wallet balances, what the executor sent, and whether a trade's receipt really succeeded.
// Read-only, public data, no key (CHRONOS_BLOCKSCOUT_URL; default https://arbitrum.blockscout.com; "off" disables).
// Field names as the Arbitrum deployment answers them (checked 2026-11-25): addresses → coin_balance, is_contract,
// is_verified, creator_address_hash, creation_transaction_hash, creation_status; blocks → height; transactions →
// hash, status ("ok" | "error"), result, block_number (older deployments: block), from.hash, to.hash, fee.value.
const DEFAULT = 'https://arbitrum.blockscout.com';

/** the Blockscout base url from your settings, or null when switched off */
function baseUrl(get) {
  const v = String(get('CHRONOS_BLOCKSCOUT_URL') || '').trim();
  if (v === 'off') return null;
  return (/^https:\/\//.test(v) ? v : DEFAULT).replace(/\/+$/, '');
}

class Blockscout {
  constructor(base, { fetchImpl = fetch, timeoutMs = 10000 } = {}) { this.base = base; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; }
  async get(path, query = null) {
    const u = this.base + path + (query ? '?' + new URLSearchParams(query).toString() : '');
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const r = await this.fetch(u, { signal: ac.signal, headers: { accept: 'application/json' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`Blockscout HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  /** newest block height Blockscout has indexed */
  async head() {
    const j = await this.get('/api/v2/blocks', { type: 'block' });
    const items = Array.isArray(j) ? j : (j && j.items) || [];
    const h = items.length ? Number(items[0].height) : NaN;
    if (!Number.isFinite(h)) throw new Error('Blockscout returned no blocks');
    return h;
  }
  /** → { isContract, isVerified, balanceWei, creator, creationTx, creationOk, balanceBlock } or null (never seen) */
  async address(a) {
    const j = await this.get(`/api/v2/addresses/${a}`); if (!j) return null;
    return {
      isContract: !!j.is_contract, isVerified: !!j.is_verified,
      balanceWei: /^\d+$/.test(String(j.coin_balance)) ? BigInt(j.coin_balance) : null,
      creator: j.creator_address_hash ? String(j.creator_address_hash).toLowerCase() : null,
      creationTx: j.creation_transaction_hash || j.creation_tx_hash || null,
      creationOk: j.creation_status ? j.creation_status === 'success' : null,
      balanceBlock: Number.isFinite(Number(j.block_number_balance_updated_at)) ? Number(j.block_number_balance_updated_at) : null,
    };
  }
  /** the latest transactions sent by an address (one page, newest first) */
  async sentBy(a) {
    const j = await this.get(`/api/v2/addresses/${a}/transactions`, { filter: 'from' });
    return ((j && j.items) || []).map(norm);
  }
  /** one transaction as Blockscout recorded it, or null when it does not know it */
  async tx(hash) { const j = await this.get(`/api/v2/transactions/${hash}`); return j ? norm(j) : null; }
}

function norm(x) {
  return {
    hash: String(x.hash || '').toLowerCase(), ok: x.status === 'ok', status: x.status || null, result: x.result || null,
    block: Number(x.block_number ?? x.block) || null,
    from: x.from && x.from.hash ? String(x.from.hash).toLowerCase() : null, to: x.to && x.to.hash ? String(x.to.hash).toLowerCase() : null,
    feeWei: x.fee && /^\d+$/.test(String(x.fee.value)) ? BigInt(x.fee.value) : null, method: x.method || null,
  };
}

module.exports = { Blockscout, baseUrl, DEFAULT, norm };
