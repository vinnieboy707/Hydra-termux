'use strict';
// Balances, shown only when they are verified by a second, independent source:
//   1. a second node from another provider (ARB_RPC_URL_2 / ARBITRUM_RPC_URL), read at the very same block: the
//      numbers must be identical; or
//   2. the Blockscout explorer index (CHRONOS_BLOCKSCOUT_URL, default arbitrum.blockscout.com): it must match.
// A balance the sources disagree on, or that only one source has, is reported as unverified and has no number.
const { ethers } = require('ethers');
const { Batcher } = require('./batch.cjs');

const ERC20 = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);

async function readAt(provider, block, addresses, tokens) {
  const b = new Batcher(provider, { blockTag: block });
  const out = {};
  await Promise.all(addresses.map(async (a) => {
    out[a] = { eth: await provider.getBalance(a, block), tokens: {} };
    await Promise.all(tokens.map(async (t) => {
      const r = await b.call(t.address, ERC20.encodeFunctionData('balanceOf', [a]));
      out[a].tokens[t.address.toLowerCase()] = r.ok ? ERC20.decodeFunctionResult('balanceOf', r.data)[0] : null;
    }));
  }));
  return out;
}

async function readBlockscout(base, addresses, fetchImpl) {
  const out = {};
  const get = async (u) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000); try { const r = await fetchImpl(u, { signal: ac.signal, headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); } finally { clearTimeout(t); } };
  await Promise.all(addresses.map(async (a) => {
    const [info, toks] = await Promise.all([get(`${base}/api/v2/addresses/${a}`), get(`${base}/api/v2/addresses/${a}/token-balances`)]);
    const tokens = {};
    for (const x of Array.isArray(toks) ? toks : []) { const ta = x.token && (x.token.address_hash || x.token.address); if (ta && /^\d+$/.test(String(x.value))) tokens[String(ta).toLowerCase()] = BigInt(x.value); }
    out[a] = { eth: /^\d+$/.test(String(info.coin_balance)) ? BigInt(info.coin_balance) : null, tokens };
  }));
  return out;
}

/**
 * accounts: [{ label, address }]; tokens: [{ address, symbol, decimals }].
 * secondary: an ethers provider from a different provider (preferred), else blockscoutUrl is used.
 */
async function verifiedBalances({ primary, secondary = null, blockscoutUrl = null, accounts, tokens, fetchImpl = fetch }) {
  const addrs = accounts.map((a) => ethers.getAddress(a.address));
  // direct call: ethers reuses identical requests for 250 ms, and a balance must be read at the newest block
  const block = Number(BigInt(await primary.send('eth_blockNumber', [])));
  const p = await readAt(primary, block, addrs, tokens);
  let q = null, source = null, why = null;
  try {
    if (secondary) { q = await readAt(secondary, block, addrs, tokens); source = 'second node, same block'; }
    else if (blockscoutUrl) { q = await readBlockscout(blockscoutUrl.replace(/\/+$/, ''), addrs, fetchImpl); source = 'Blockscout explorer'; }
    else why = 'no second source: add ARB_RPC_URL_2 (another provider) or allow Blockscout';
  } catch (e) { why = `second source unavailable (${String(e.message || e).slice(0, 60)})`; q = null; }
  const fmt = (v, d) => Number(ethers.formatUnits(v, d));
  const rows = accounts.map((acc, i) => {
    const a = addrs[i];
    const eq = (x, y) => x !== null && x !== undefined && y !== null && y !== undefined && x === y;
    const ethOk = !!q && eq(p[a].eth, q[a] && q[a].eth);
    const toks = tokens.map((t) => {
      const k = t.address.toLowerCase(); const mine = p[a].tokens[k]; const theirs = q && q[a] ? (q[a].tokens[k] !== undefined ? q[a].tokens[k] : (source === 'Blockscout explorer' && mine === 0n ? 0n : null)) : null;
      const ok = !!q && eq(mine, theirs);
      return { symbol: t.symbol, address: t.address, verified: ok, amount: ok ? fmt(mine, t.decimals) : null };
    }).filter((t) => !t.verified || t.amount > 0);
    return { label: acc.label, address: a, eth: { verified: ethOk, amount: ethOk ? fmt(p[a].eth, 18) : null }, tokens: toks };
  });
  return { at: new Date().toISOString(), block, source, why, rows };
}

module.exports = { verifiedBalances, readBlockscout, readAt };
