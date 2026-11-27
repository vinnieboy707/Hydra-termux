'use strict';
// Which contract is deployed at your address, read from the chain: v1 (ChronosFlashArb: Aave + routers) or v2
// (ChronosFlashArbV2: Aave or Balancer loans; routers, or direct swaps on pools/pairs of factories it allows). For v2 it
// also reads its Balancer vault and, for each venue factory, whether the contract allows it and the V2 fee it assumes.
// Read-only. The engine only builds calls the deployed contract accepts; anything unknown falls back to router legs.
const { ethers } = require('ethers');

const ABI = ['function VAULT() view returns (address)', 'function MORPHO() view returns (address)', 'function V4() view returns (address)', 'function allowedFactories(address) view returns (bool)', 'function v2FeeBps(address) view returns (uint16)', 'function allowedCurvePools(address) view returns (bool)', 'function MAX_LEGS() view returns (uint8)'];

/** → { kind: 1|2, vault: address|null, morpho: address|null, v4: address|null, factories: { lowercased factory: { allowed, v2FeeBps } } } */
async function read(provider, address, factories = [], blockTag = 'latest', curvePools = []) {
  const c = new ethers.Contract(address, ABI, provider);
  let vault;
  try { vault = await c.VAULT({ blockTag }); } catch (_) { return { kind: 1, vault: null, factories: {} }; } // v1 has no VAULT()
  let morpho = null; try { const m = await c.MORPHO({ blockTag }); morpho = m === ethers.ZeroAddress ? null : m.toLowerCase(); } catch (_) { morpho = null; } // v2.2+
  let v4 = null; try { const m = await c.V4({ blockTag }); v4 = m === ethers.ZeroAddress ? null : m.toLowerCase(); } catch (_) { v4 = null; } // v2.3+
  let maxLegs = 4; try { maxLegs = Number(await c.MAX_LEGS({ blockTag })); } catch (_) { maxLegs = 4; } // v2.1+: 5
  const out = { kind: 2, vault: vault === ethers.ZeroAddress ? null : vault.toLowerCase(), morpho, v4, maxLegs, factories: {}, curvePools: {} };
  // Curve pools the owner allowed (v2.3+; an older contract has no allowedCurvePools: none allowed)
  await Promise.all([...new Set(curvePools.map((x) => x.toLowerCase()))].map(async (x) => {
    try { out.curvePools[x] = !!(await c.allowedCurvePools(x, { blockTag })); } catch (_) { out.curvePools[x] = false; }
  }));
  await Promise.all([...new Set(factories.map((f) => f.toLowerCase()))].map(async (f) => {
    try {
      const [allowed, fee] = await Promise.all([c.allowedFactories(f, { blockTag }), c.v2FeeBps(f, { blockTag })]);
      out.factories[f] = { allowed: !!allowed, v2FeeBps: Number(fee) };
    } catch (_) { out.factories[f] = { allowed: false, v2FeeBps: 0 }; }
  }));
  return out;
}

/** how the contract can trade on this market: a direct pool/pair leg when it allows the market's factory as that
 * kind (V3 factories with fee 0, V2 factories with their fee), otherwise through the venue's router */
function legMode(info, m) {
  if (m.kind === 'curve') return info && info.kind === 2 && info.curvePools && info.curvePools[m.address] ? 'curve' : 'none'; // no router path for Curve
  if (!info || info.kind !== 2 || !m.factory || !m.address) return 'router';
  const f = info.factories[m.factory];
  if (!f || !f.allowed) return 'router';
  if (m.kind === 'v3' && f.v2FeeBps === 0) return 'pool';
  if (m.kind === 'v2' && f.v2FeeBps > 0) return 'pair';
  return 'router';
}

module.exports = { read, legMode, ABI };
