'use strict';
// Contract v2's real-protocol probe (source: the contract project's test/ForkProbe.sol). Sent as ONE eth_call with no
// `to` against the latest Arbitrum One block: inside that call it deploys ChronosFlashArbV2 wired to the real Aave pool,
// Balancer vault, Morpho Blue, the Uniswap V4 PoolManager, a Curve stable pool, Uniswap/Sushi/Pancake factories, routers, pools and pairs, and runs every check named in the
// contract's counterparts register. Nothing is signed or sent; the ETH it wraps exists only inside the call (a balance
// override on a fresh address). The profit checks make their own price gap inside the call: they prove the contract
// works with the real protocols, not that the gap exists on the market.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const CFG = 'tuple(address aave,address vault,address weth,address usdc,address usdt,address[] v3Factories,address[] v3Routers,address[] v2Factories,uint16[] v2Fees,address[] v2Routers,uint256 probeWeth,uint256 dumpWeth,uint256[] sizes,address morpho,address v4,address[] curvePools,address[] cl,uint8[] clModes,uint24[] clFees)';
const OUT = 'tuple(string name,bool ok,uint256[] values,bytes err)[]';
const E = (n) => BigInt(n) * 10n ** 18n, M = (n) => BigInt(n) * 10n ** 6n;

function realConfig(R) {
  return {
    aave: R.AAVE_V3_POOL, vault: R.BALANCER_VAULT, weth: R.WETH, usdc: R.USDC, usdt: R.USDT,
    v3Factories: [R.UNI_V3_FACTORY, R.SUSHI_V3_FACTORY, R.PANCAKE_V3_FACTORY],
    v3Routers: [R.UNI_V3_ROUTER, R.SUSHI_V3_ROUTER, R.PANCAKE_V3_ROUTER],
    v2Factories: [R.UNI_V2_FACTORY, R.SUSHI_V2_FACTORY, R.PANCAKE_V2_FACTORY], v2Fees: [30, 30, 25],
    v2Routers: [R.UNI_V2_ROUTER, R.SUSHI_V2_ROUTER, R.PANCAKE_V2_ROUTER],
    probeWeth: E(100), dumpWeth: E(Number(process.env.CHRONOS_PROBE_DUMP_WETH || 300)), sizes: [M(1000), M(5000), M(20000), M(50000), M(100000)],
    morpho: R.MORPHO_BLUE || require('./live.cjs').MORPHO || ethers.ZeroAddress,
    v4: R.UNI_V4_POOL_MANAGER || ethers.ZeroAddress, // flash accounting, no fee
    curvePools: R.CURVE_USDC_USDT0 ? [R.CURVE_USDC_USDT0] : [], // coin 0 must be USDC; the probe trades back on Uniswap V3 0.01%
    // v2.1 venues traded for real through the contract: Aero Slipstream (pools by tick spacing 100), Camelot V3 (Algebra)
    cl: [R.AERO_SLIPSTREAM_FACTORY, R.CAMELOT_V3_FACTORY].filter(Boolean), clModes: [R.AERO_SLIPSTREAM_FACTORY && 1, R.CAMELOT_V3_FACTORY && 2].filter(Boolean), clFees: [R.AERO_SLIPSTREAM_FACTORY && 100, R.CAMELOT_V3_FACTORY && 0].filter((x) => x !== undefined && x !== null && x !== ''),
  };
}

async function runProbe(provider, cfg, dir, { from, value, override = false, gas = 300_000_000n, block = 'latest' } = {}) {
  const art = (n) => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8'));
  const init = art('ForkProbe').bytecode + ethers.AbiCoder.defaultAbiCoder().encode([CFG], [cfg]).slice(2);
  const params = [{ from, data: init, value: ethers.toQuantity(value), gas: ethers.toQuantity(gas) }, block];
  if (override) params.push({ [from]: { balance: ethers.toQuantity(value * 2n) } });
  const ret = await provider.send('eth_call', params);
  const [checks] = ethers.AbiCoder.defaultAbiCoder().decode([OUT], ret);
  const errs = new ethers.Interface(art('ChronosFlashArbV2').abi);
  return checks.map((raw) => {
    let err = null;
    if (raw[3] && raw[3] !== '0x') { try { err = errs.parseError(raw[3]).name; } catch (_) { err = raw[3].slice(0, 10); } }
    return { name: raw[0], ok: raw[1], values: [...raw[2]].map(String), err };
  });
}

/** against Arbitrum One through `provider` (chain already checked by chain.connect) */
async function runV2Probe(provider, dir) {
  const R = JSON.parse(fs.readFileSync(path.join(dir, 'real.json'), 'utf8')).real;
  const block = await provider.getBlockNumber();
  return runProbe(provider, realConfig(R), dir, { from: ethers.Wallet.createRandom().address, value: E(1000), override: true, block: ethers.toQuantity(block), gas: BigInt(process.env.CHRONOS_PROBE_GAS || 300_000_000) });
}

module.exports = { runProbe, runV2Probe, realConfig, CFG };
