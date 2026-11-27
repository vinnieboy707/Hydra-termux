'use strict';
// Realized profit, from receipts only. A transaction counts when it is confirmed (status 1) and YOUR ChronosFlashArb
// contract emitted Arbitrage(asset, amount, premium, profit) with profit > 0 in it. Gas actually paid (receipt
// gasUsed × effective gas price) is subtracted. Nothing written in a summary, a log or a database can raise this number.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const IFACE = new ethers.Interface(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contract_abi.json'), 'utf8')));
const TOPIC = IFACE.getEvent('Arbitrage').topicHash;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

/**
 * Your deployed contract: CHRONOS_FLASH_ARB_ADDRESS only. CONTRACT_ADDRESS (an older name other tools also use) is
 * never trusted by itself: adoptLegacy() checks it on-chain and, if it really is a Chronos contract, saves it as
 * CHRONOS_FLASH_ARB_ADDRESS.
 */
function contractFrom(get) {
  for (const k of ['CHRONOS_FLASH_ARB_ADDRESS']) {
    const v = get(k);
    if (ADDR.test(v || '')) { try { return { key: k, address: ethers.getAddress(v.toLowerCase()) }; } catch (_) { /* bad checksum */ } }
  }
  return null;
}

/** The executor's own trades (data/executions.jsonl), lowercased. */
function tradeHashes(dataDir) {
  const s = new Set();
  try { for (const l of fs.readFileSync(path.join(dataDir, 'executions.jsonl'), 'utf8').split('\n')) { try { const j = JSON.parse(l); if (HASH.test(j.txHash || '')) s.add(j.txHash.toLowerCase()); } catch (_) { /* skip line */ } } } catch (_) { /* none yet */ }
  return s;
}

/** Candidate transactions: your on-chain record plus any executor log (data/executions.jsonl). */
function candidateHashes(record, dataDir) {
  const s = new Set();
  for (const a of (record && record.actions) || []) if (a.isTx && HASH.test(a.txHash)) s.add(a.txHash.toLowerCase());
  try {
    for (const l of fs.readFileSync(path.join(dataDir, 'executions.jsonl'), 'utf8').split('\n')) {
      try { const j = JSON.parse(l); if (HASH.test(j.txHash || '')) s.add(j.txHash.toLowerCase()); } catch (_) { /* skip line */ }
    }
  } catch (_) { /* no executor log yet */ }
  return [...s];
}

/**
 * tradeHashes: the executor's own trades (data/executions.jsonl). A trade of yours that reverted, or landed without a
 * profit event, is counted as a loss of its gas, so realized profit is never overstated. Other transactions in the
 * list (deployment, setup) are never counted as trades. receipts: { hash: { status: 'success'|'reverted', gasUsd } }.
 */
async function verifyRealized({ provider, contract, hashes, assets, wethAddress, taxBps, tradeHashes = null }) {
  const trades = new Set([...(tradeHashes || [])].map((h) => String(h).toLowerCase()));
  const out = { contract, checked: 0, confirmed: 0, errors: 0, reverted: 0, receipts: {}, executions: [], totalNetUsd: 0, totalProfitUsd: 0, totalGasUsd: 0, taxReserveUsd: null, profiting: false, at: new Date().toISOString() };
  if (!contract) return { ...out, note: 'no contract address set' };
  const price = (addr) => assets.find((a) => a.address === String(addr).toLowerCase());
  const weth = price(wethAddress || '');
  for (const h of hashes) {
    out.checked++;
    let r; try { r = await provider.getTransactionReceipt(h); } catch (_) { out.errors++; continue; }
    if (!r) continue; // not mined yet: checked again next time
    const gasWei0 = BigInt(r.gasUsed) * BigInt(r.gasPrice || r.effectiveGasPrice || 0n);
    const gasUsd0 = weth && weth.price8 ? Number((gasWei0 * weth.price8) / 10n ** 18n) / 1e8 : null;
    const mine = trades.has(String(h).toLowerCase());
    if (mine) out.receipts[String(h).toLowerCase()] = { status: r.status === 1 ? 'success' : 'reverted', gasUsd: gasUsd0 };
    if (r.status !== 1) {
      if (mine) { out.reverted++; out.executions.push({ txHash: h, block: r.blockNumber, status: 'reverted', reverted: true, profitUsd: 0, gasUsd: gasUsd0, netUsd: gasUsd0 !== null ? -gasUsd0 : null }); }
      continue;
    }
    out.confirmed++;
    const evs = [];
    for (const log of r.logs) {
      if (log.address.toLowerCase() !== contract.toLowerCase() || log.topics[0] !== TOPIC) continue;
      try { const ev = IFACE.parseLog(log); if (ev.args.profit > 0n) evs.push(ev.args); } catch (_) { /* not decodable: ignore */ }
    }
    if (!evs.length) { if (mine) out.executions.push({ txHash: h, block: r.blockNumber, status: 'success', noProfitEvent: true, profitUsd: 0, gasUsd: gasUsd0, netUsd: gasUsd0 !== null ? -gasUsd0 : null }); continue; }
    const gasWei = BigInt(r.gasUsed) * BigInt(r.gasPrice || 0n);
    const gasUsd = weth && weth.price8 ? Number((gasWei * weth.price8) / 10n ** 18n) / 1e8 : null;
    for (const [i, e] of evs.entries()) {
      const a = price(e.asset);
      const profitUsd = a && a.price8 && a.decimals !== null ? Number((e.profit * a.price8) / 10n ** BigInt(a.decimals)) / 1e8 : null;
      const g = i === 0 ? gasUsd : 0; // gas is paid once per transaction
      out.executions.push({ txHash: h, block: r.blockNumber, asset: e.asset.toLowerCase(), symbol: a ? a.symbol : e.asset.slice(0, 8), amount: e.amount.toString(), premium: e.premium.toString(), profit: e.profit.toString(), profitUsd, gasUsd: g, netUsd: profitUsd !== null && g !== null ? profitUsd - g : null });
    }
  }
  for (const x of out.executions) { out.totalProfitUsd += x.profitUsd || 0; out.totalGasUsd += x.gasUsd || 0; }
  out.totalNetUsd = out.totalProfitUsd - out.totalGasUsd;
  out.taxReserveUsd = Number.isFinite(taxBps) ? Math.max(0, out.totalNetUsd) * taxBps / 10000 : null; // Policy T1: share of (gross − gas)
  out.profiting = out.executions.length > 0 && out.totalNetUsd > 0;
  return out;
}
/**
 * CHRONOS_FLASH_ARB_ADDRESS unset and CONTRACT_ADDRESS set: is that a Chronos contract (MAX_LEGS 4 and borrowing from
 * the Aave pool)? → its address (the caller saves it as CHRONOS_FLASH_ARB_ADDRESS) or null (another tool's contract:
 * left alone and never used).
 */
async function adoptLegacy(provider, get, aavePool) {
  if (ADDR.test(get('CHRONOS_FLASH_ARB_ADDRESS') || '') || !ADDR.test(get('CONTRACT_ADDRESS') || '')) return null;
  const a = ethers.getAddress(get('CONTRACT_ADDRESS').toLowerCase());
  const I = new ethers.Interface(['function MAX_LEGS() view returns (uint8)', 'function POOL() view returns (address)']);
  try {
    const [l, p] = await Promise.all([provider.call({ to: a, data: I.encodeFunctionData('MAX_LEGS') }), provider.call({ to: a, data: I.encodeFunctionData('POOL') })]);
    const ok = [4, 5].includes(Number(I.decodeFunctionResult('MAX_LEGS', l)[0])) && I.decodeFunctionResult('POOL', p)[0].toLowerCase() === String(aavePool).toLowerCase();
    return ok ? a : null;
  } catch (_) { return null; }
}

module.exports = { tradeHashes, verifyRealized, candidateHashes, contractFrom, adoptLegacy, TOPIC };
