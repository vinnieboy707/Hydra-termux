'use strict';
// Shadow test: your contract's exact call against real chain state, with nothing sent.
//  preflight() checks every requirement ChronosFlashArb and the flash-loan provider impose for this exact call.
//  simulate()  runs execute(asset, amount, minProfit, deadline, legs) as an eth_call from your executor and returns
//              the profit the contract itself computes (its return value) or the contract's own error, decoded.
// A "shadow win" is a simulation that succeeds with net profit (after the flash fee, which the contract pays, and
// gas at the live price) at or above your floor. Shadow wins are what can switch live execution on.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const IFACE = new ethers.Interface(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contract_abi.json'), 'utf8')));
// contract v2 (ChronosFlashArbV2): execute(source, asset, amount, minProfit, deadline, legs[dex, target, tokenOut, fee, minOut])
const IFACE2 = new ethers.Interface(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'v2', 'ChronosFlashArbV2.json'), 'utf8')).abi);
const ifaceFor = (p) => (p && p.v === 2 ? IFACE2 : IFACE);

function revertData(e) {
  for (const d of [e && e.data, e && e.info && e.info.error && e.info.error.data, e && e.error && e.error.data]) {
    if (typeof d === 'string' && /^0x[0-9a-fA-F]*$/.test(d)) return d;
    if (d && typeof d.data === 'string') return d.data;
  }
  return null;
}
/** The contract's own error (Unprofitable, Slippage, NotOperator, …) with its arguments, or the node's message. */
function decodeError(e) {
  const d = revertData(e);
  if (d && d.length >= 10) for (const I of [IFACE2, IFACE]) { try { const x = I.parseError(d); if (x) return `${x.name}(${x.args.map(String).join(', ')})`; } catch (_) { /* not this contract's */ } }
  return String((e && (e.shortMessage || e.message)) || e).split('\n')[0].slice(0, 160);
}
const encodeExecute = (p) => (p.v === 2
  ? IFACE2.encodeFunctionData('execute', [p.source || 0, p.asset, p.amount, p.minProfit, p.deadline, p.legs.map((l) => [l.v2dex, l.target, l.tokenOut, l.fee, l.minOut])])
  : IFACE.encodeFunctionData('execute', [p.asset, p.amount, p.minProfit, p.deadline, p.legs.map((l) => [l.dex, l.router, l.tokenOut, l.fee, l.minOut])]));

/**
 * Every requirement for this exact call, read at one block.
 * aave: { pool, flashEnabled, availableLiquidity|null } from the scanner's reading of the Aave reserve.
 */
async function preflight({ provider, contract, executor, params, aave, flash = null, blockTag = 'latest' }) {
  const v2 = params.v === 2;
  const c = new ethers.Contract(contract, ifaceFor(params), provider);
  const o = { blockTag };
  const routerLegs = params.legs.filter((l) => !v2 || l.v2dex === 0 || l.v2dex === 1);
  const routers = [...new Set(routerLegs.map((l) => ethers.getAddress(v2 ? l.target : l.router)))];
  const factories = v2 ? [...new Set(params.legs.filter((l) => l.v2dex >= 2).map((l) => ethers.getAddress(l.factory)))] : [];
  const balancer = v2 && Number(params.source) === 1;
  const morpho = v2 && Number(params.source) === 2;
  const [code, block, paused, isOp, cap, pool, maxLegs, vault, ...rest] = await Promise.all([
    provider.getCode(contract, blockTag), provider.getBlock(blockTag), c.paused(o), c.operators(executor, o), c.maxLoan(params.asset, o), c.POOL(o), c.MAX_LEGS(o), v2 ? c.VAULT(o) : null,
    ...routers.map((r) => c.allowedRouters(r, o)), ...factories.map((f) => c.allowedFactories(f, o)),
  ]);
  const allowed = rest.slice(0, routers.length), factoryOk = rest.slice(routers.length);
  const amount = BigInt(params.amount);
  const morphoOf = morpho ? await c.MORPHO(o).catch(() => null) : null;
  const lender = morpho
    ? [{ name: 'contract borrows from this Morpho Blue', ok: !!morphoOf && !!flash && String(morphoOf).toLowerCase() === String(flash.vault).toLowerCase() },
      { name: 'Morpho Blue holds enough to lend', ok: !!flash && (flash.available === null || flash.available === undefined || amount <= BigInt(flash.available)) }]
    : balancer
    ? [{ name: 'contract borrows from this Balancer vault', ok: !!vault && !!flash && String(vault).toLowerCase() === String(flash.vault).toLowerCase() },
      { name: 'Balancer has the liquidity to lend', ok: !!flash && (flash.available === null || flash.available === undefined || amount <= BigInt(flash.available)) }]
    : [{ name: 'contract uses this Aave pool', ok: !!aave && String(pool).toLowerCase() === String(aave.pool).toLowerCase() },
      { name: 'Aave reserve active, not frozen/paused, flash loans on', ok: !!(aave && aave.flashEnabled) },
      { name: 'Aave has the liquidity to lend', ok: !aave || aave.availableLiquidity === null || aave.availableLiquidity === undefined || amount <= BigInt(aave.availableLiquidity) }];
  const checks = [
    { name: 'contract deployed at this address', ok: !!code && code !== '0x' },
    { name: 'contract not paused', ok: !paused, fix: 'owner: unpause()' },
    { name: 'executor is an operator', ok: !!isOp, fix: `owner: setOperator(${executor}, true)` },
    { name: 'every router allowed', ok: allowed.every(Boolean), fix: routers.filter((_, i) => !allowed[i]).map((r) => `owner: setRouter(${r}, true)`).join('; ') },
    ...(v2 ? [{ name: 'every pool/pair factory allowed', ok: factoryOk.every(Boolean), fix: factories.filter((_, i) => !factoryOk[i]).map((f) => `owner: setFactory(${f}, true, fee)`).join('; ') }] : []),
    { name: 'amount within maxLoan for the asset', ok: amount <= cap, fix: `owner: setMaxLoan(${params.asset}, ≥ ${amount})` },
    { name: 'legs within MAX_LEGS', ok: params.legs.length <= Number(maxLegs) },
    { name: 'minProfit above zero (reverts instead of losing)', ok: BigInt(params.minProfit) > 0n },
    { name: 'deadline in the future', ok: Number(params.deadline) > Number(block.timestamp) },
    ...lender,
  ];
  return { ok: checks.every((x) => x.ok), checks, block: Number(block.number), timestamp: Number(block.timestamp) };
}

/** execute(...) as an eth_call from the executor: the contract's own profit figure, or its own error. */
async function simulate({ provider, contract, executor, params, blockTag = 'latest' }) {
  const data = encodeExecute(params);
  const tx = { from: executor, to: contract, data };
  let profit;
  try {
    const ret = await provider.call({ ...tx, blockTag });
    profit = ifaceFor(params).decodeFunctionResult('execute', ret)[0];
  } catch (e) { return { ok: false, error: decodeError(e), data }; }
  let gas = null;
  try { gas = await provider.estimateGas(tx); } catch (e) { return { ok: false, error: 'gas estimate failed: ' + decodeError(e), data, profit }; }
  return { ok: true, profit, gas, data };
}

/**
 * One shadow run for one approved candidate: preflight, then the simulation, priced in USD.
 * px: { assetPrice8, decimals, ethPrice8, gasPriceWei }. floorUsd: MIN_NET_PROFIT_USD.
 */
async function run({ provider, contract, executor, cand, aave, px, floorUsd, blockTag }) {
  const at = Date.now();
  const base = { at, route: cand.routeKey || null, asset: cand.runParams.asset, amount: cand.runParams.amount, quotedNetUsd: cand.netUsd };
  let pf;
  try { pf = await preflight({ provider, contract, executor, params: cand.runParams, aave, flash: cand.flash, blockTag }); } catch (e) { return { ...base, ok: false, win: false, stage: 'preflight', error: decodeError(e) }; }
  if (!pf.ok) return { ...base, ok: false, win: false, stage: 'preflight', block: pf.block, failed: pf.checks.filter((c) => !c.ok).map((c) => ({ name: c.name, fix: c.fix || null })) };
  const sim = await simulate({ provider, contract, executor, params: cand.runParams, blockTag });
  if (!sim.ok) return { ...base, ok: false, win: false, stage: 'simulation', block: pf.block, error: sim.error };
  const profitUsd = Number((sim.profit * BigInt(px.assetPrice8)) / 10n ** BigInt(px.decimals)) / 1e8;
  const gasUsd = Number((sim.gas * BigInt(px.gasPriceWei) * BigInt(px.ethPrice8)) / 10n ** 18n) / 1e8;
  const netUsd = profitUsd - gasUsd;
  return { ...base, ok: true, win: netUsd >= floorUsd, stage: 'done', block: pf.block, profit: sim.profit.toString(), profitUsd, gas: sim.gas.toString(), gasUsd, netUsd };
}

module.exports = { preflight, simulate, run, decodeError, encodeExecute, IFACE, IFACE2 };
