'use strict';
// Etherscan API V2 on Arbitrum One (chainid 42161), with your ETHERSCAN_API_KEY: a second independent witness of the
// chain head and your contract, used when Blockscout does not answer (docs ingested 2026-11-26: base
// https://api.etherscan.io/v2/api, ?chainid=&module=&action=&apikey=; free tier covers Arbitrum, 3 calls/s).
class Etherscan {
  constructor(key, { fetchImpl = fetch, timeoutMs = 10000, chainId = 42161 } = {}) { this.key = key; this.fetch = fetchImpl; this.timeoutMs = timeoutMs; this.chainId = chainId; }
  async proxy(action, params = {}) {
    const q = new URLSearchParams({ chainid: String(this.chainId), module: 'proxy', action, ...params, apikey: this.key });
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const r = await this.fetch('https://api.etherscan.io/v2/api?' + q.toString(), { signal: ac.signal, headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`Etherscan HTTP ${r.status}`);
      const j = await r.json();
      if (j && typeof j.result === 'string' && /^0x/.test(j.result)) return j.result;
      throw new Error('Etherscan: ' + String((j && (j.result || j.message)) || 'no result').slice(0, 80));
    } finally { clearTimeout(t); }
  }
  async head() { return Number(BigInt(await this.proxy('eth_blockNumber'))); }
  async isContract(a) { const code = await this.proxy('eth_getCode', { address: a, tag: 'latest' }); return code !== '0x' && code.length > 2; }
}
module.exports = { Etherscan };
