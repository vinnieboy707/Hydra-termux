'use strict';
// Registry audit as a function: is each pool in src/registry.ts the exchange, pair and fee tier it claims?
const fs = require('fs');
const { ethers } = require('ethers');
const C = require('./chain.cjs');
const { clean, redact } = require('./safety.cjs');

function parseRegistry(src) {
  // "x", 'x' or `x`; quoted or bare keys; the pool address may be named address, pool or poolAddress
  const get = (b, ...ks) => { for (const k of ks) { const m = b.match(new RegExp('["\']?' + k + '["\']?\\s*:\\s*(["\'`])([^"\'`]+)\\1')); if (m) return m[2].trim(); } return null; };
  return src.split('{').slice(1).map((b) => b.split('}')[0]).filter((b) => /exchange["']?\s*:/.test(b)).map((b) => ({
    exchange: clean(get(b, 'exchange'), 24), pair: clean(get(b, 'pair'), 24), address: get(b, 'address', 'poolAddress', 'pool') || ((b.match(/["']?(?:address|poolAddress|pool)["']?\s*:\s*([A-Za-z_$][\w$.]*)/) || [])[1] || null), token0: get(b, 'token0'), token1: get(b, 'token1'),
    fee: Number((b.match(/feeTier\s*:\s*(\d+)/) || [])[1]),
  }));
}


const POOL_ABI = ['function factory() view returns (address)', 'function token0() view returns (address)', 'function token1() view returns (address)', 'function fee() view returns (uint24)', 'function liquidity() view returns (uint128)', 'function getReserves() view returns (uint112, uint112, uint32)', 'function globalState() view returns (uint160, int24, uint16, uint16, uint8, uint8, bool)'];
/** a pool's kind and state: Uniswap-V3 style (fixed fee), Algebra (Camelot V3: dynamic fee), or a V2 pair */
async function readPool(provider, addr) {
  const p = new ethers.Contract(addr, POOL_ABI, provider);
  const [factory, t0, t1] = await Promise.all([p.factory(), p.token0(), p.token1()]);
  try { const [fee, liquidity] = await Promise.all([p.fee(), p.liquidity()]); return { kind: 'v3', factory, t0, t1, fee: Number(fee), liquidity }; } catch (_) { /* not V3 */ }
  try { const [gs, liquidity] = await Promise.all([p.globalState(), p.liquidity()]); return { kind: 'algebra', factory, t0, t1, fee: Number(gs[2]), liquidity }; } catch (_) { /* not Algebra */ }
  const [r0, r1] = await p.getReserves();
  return { kind: 'v2', factory, t0, t1, fee: null, liquidity: r0 < r1 ? r0 : r1 };
}
/** "UniswapV3", "Uniswap", "uniswap_v3", "Uniswap V3" are the same venue; "SushiSwap" is sushi; a stated version must match */
function sameVenue(label, venueId, kind) {
  const n = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const brand = (x) => n(x).replace(/(swap|exchange|finance|dex|amm)/g, '').replace(/v[23]$/, '');
  if (brand(label) !== brand(venueId)) return false;
  const ver = (x) => (n(x).match(/v([23])$/) || [])[1] || null;
  const said = ver(label); const is = ver(venueId) || (kind === 'v2' ? '2' : kind ? '3' : null);
  return !said || !is || said === is;
}


const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)', 'function getPair(address,address) view returns (address)'];
/**
 * The pool the entry most likely meant, from the factory of the venue it is labelled with: getPool(token0, token1,
 * fee) for V3 venues, getPair(token0, token1) for V2. → { address, why } or null (tokens not stated, no such pool)
 */
async function suggest(provider, claim, venues, onchain) {
  const t0 = claim.token0, t1 = claim.token1;
  if (!/^0x[0-9a-fA-F]{40}$/.test(t0 || '') || !/^0x[0-9a-fA-F]{40}$/.test(t1 || '')) return { address: null, why: 'add token0 and token1 (0x addresses) to this entry so the right pool can be looked up' };
  const vs = venues.filter((v) => typeof v.factory === 'string' && sameVenue(claim.exchange, v.id, v.kind));
  for (const v of vs) {
    const f = new ethers.Contract(v.factory, FACTORY_ABI, provider);
    let a = null;
    try { a = v.kind === 'v2' ? await f.getPair(t0, t1) : Number.isFinite(claim.fee) ? await f.getPool(t0, t1, claim.fee) : null; } catch (_) { a = null; }
    if (a && a !== ethers.ZeroAddress) return { address: ethers.getAddress(a), why: `${v.id}'s factory says the ${claim.pair || 'pair'} pool${v.kind === 'v2' ? '' : ` at fee ${claim.fee}`} for the tokens in this entry is ${ethers.getAddress(a)}${onchain ? ` (the address in the entry is a ${onchain.pair} pool)` : ''}` };
  }
  return { address: null, why: vs.length ? `${vs.map((v) => v.id).join(', ')} has no pool for these two tokens${Number.isFinite(claim.fee) ? ` at fee ${claim.fee}` : ''}: check the token addresses${onchain ? `; the address in the entry is a ${onchain.pair} pool` : ''}` : `no venue in Chronos matches the label "${claim.exchange}"` };
}

/** src/registry.ts with each looked-up address put in place of the wrong one (the original is never changed) */
function corrected(src, results) {
  let out = src; let n = 0;
  for (const r of results) if (r.suggest && r.suggest.address && r.claim.address && r.suggest.address.toLowerCase() !== r.claim.address.toLowerCase()) { const re = new RegExp(r.claim.address.replace(/[^0-9a-fA-Fx]/g, ''), 'i'); if (re.test(out)) { out = out.replace(re, r.suggest.address); n++; } }
  return { text: out, changed: n };
}

async function auditRegistry(provider, file, venues) {
  const entries = parseRegistry(fs.readFileSync(file, 'utf8'));
  const out = [];
  for (const claim of entries) {
    const r = { claim, problems: [], notes: [], onchain: null };
    // an entry with no literal 0x address (a constant, a comment block, a type) is not a pool to check
    if (!/^0x[0-9a-fA-F]{40}$/.test(claim.address || '')) { r.skipped = claim.address ? 'address is not a literal 0x… value (a constant or expression): not checked' : 'no pool address in this entry: not checked'; out.push(r); continue; }
    // wrong upper/lower case only breaks the checksum, not the address: read the pool, and say what the right casing is
    const addr = claim.address.toLowerCase();
    try { ethers.getAddress(claim.address); } catch (_) { r.notes.push(`address casing is not a valid checksum; correct form ${ethers.getAddress(addr)} (same address)`); }
    try {
      const pool = await readPool(provider, addr);
      // venues with a factory only (Curve's venue lists its pools instead): 2.9.8–2.9.11 read v.factory on every
      // venue and threw on Curve, which made every pool in your registry a "mismatch"
      const real = venues.find((v) => typeof v.factory === 'string' && v.factory.toLowerCase() === pool.factory.toLowerCase())
        || venues.find((v) => Array.isArray(v.pools) && v.pools.some((x) => String(x.address || x).toLowerCase() === addr));
      const sym = async (a) => { try { return clean(await new ethers.Contract(a, C.ABI.erc20, provider).symbol(), 12); } catch (_) { return a.slice(0, 8); } };
      r.onchain = { kind: pool.kind, factory: pool.factory, venue: real ? real.id : null, pair: `${await sym(pool.t0)}/${await sym(pool.t1)}`, fee: pool.fee, liquidity: String(pool.liquidity) };
      if (!real) r.notes.push(`pool of a factory Chronos does not trade (${pool.factory.slice(0, 10)}…): checked for tokens and liquidity only`);
      else if (!sameVenue(claim.exchange, real.id, pool.kind)) r.problems.push(`labelled ${claim.exchange}, pool belongs to ${real.id}`);
      // a fee tier is only checked where the pool has a fixed one (V3); V2 and Algebra pools have none to compare
      if (pool.kind === 'v3' && Number.isFinite(claim.fee) && pool.fee !== claim.fee) r.problems.push(`fee labelled ${claim.fee}, on-chain ${pool.fee}`);
      const set = new Set([pool.t0.toLowerCase(), pool.t1.toLowerCase()]);
      for (const t of [claim.token0, claim.token1]) if (/^0x[0-9a-fA-F]{40}$/.test(t || '') && !set.has(t.toLowerCase())) r.problems.push(`token ${t.slice(0, 10)}… not in this pool`);
      if (BigInt(pool.liquidity) === 0n) r.problems.push('zero liquidity');
    } catch (e) {
      // "could not decode result data" means the address answered, but not as a pool: usually a token, a router or a
      // typo'd address; no code at all means nothing is deployed there
      let what = 'not a pool Chronos can read (V3, Algebra or V2)';
      try { const code = await provider.getCode(addr); if (code === '0x') what = 'nothing is deployed at this address (wrong address?)'; else if (/could not decode|BAD_DATA|execution reverted/i.test(String(e.shortMessage || e.message))) what = 'this address is a contract but not a pool (a token or router?)'; } catch (_) { /* keep the general text */ }
      r.problems.push(what);
    }
    // 2.9.18: the right address, asked from the venue's own factory, for the tokens and fee tier the entry names
    if (r.problems.length) { try { r.suggest = await suggest(provider, claim, venues, r.onchain); } catch (_) { r.suggest = null; } }
    out.push(r);
  }
  return out;
}
module.exports = { parseRegistry, auditRegistry, sameVenue, readPool, suggest, corrected };
