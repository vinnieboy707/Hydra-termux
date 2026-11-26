'use strict';
// chronos payout: moves the profit your contract holds to your wallets, Policy T1 applied.
//   amounts: the contract's token balances at one block, confirmed by a second independent source (second node at the
//            same block, or the Blockscout index); a token whose sources disagree is not paid out this run
//   net:     profit value − the gas every execution paid since your last payout (each receipt's gasUsed × gasPrice,
//            both succeeded and reverted), valued at the Aave oracle prices of this moment
//   T1:      POLICY_T1_TAX_BPS of net (default 3000 = 30%) goes to TAX_RESERVE_VAULT, rounded up; the rest to
//            PAYOUT_WALLET_ADDRESS. The contract itself can only withdraw to its owner, so each token is
//            withdrawn to your owner wallet first, then sent on.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const BAL = require('./balances.cjs');

const ERC20 = new ethers.Interface(['function transfer(address,uint256) returns (bool)']);
const ARB = new ethers.Interface(['function withdraw(address,uint256)']);
const HASH = /^0x[0-9a-fA-F]{64}$/;

function lastPayoutBlock(dataDir) {
  let b = 0;
  try { for (const l of fs.readFileSync(path.join(dataDir, 'payouts.jsonl'), 'utf8').split('\n')) { try { const j = JSON.parse(l); if (j.state === 'confirmed' && j.block > b) b = j.block; } catch (_) { /* skip */ } } } catch (_) { /* none yet */ }
  return b;
}

/** Gas paid by your executions after `since`, from their receipts (succeeded and reverted). */
async function gasSince(provider, hashes, since) {
  let wei = 0n; let n = 0;
  for (const h of hashes.filter((x) => HASH.test(x))) {
    const r = await provider.getTransactionReceipt(h);
    if (!r || r.blockNumber <= since) continue;
    wei += BigInt(r.gasUsed) * BigInt(r.gasPrice || 0n); n++;
  }
  return { wei, n };
}

/** Contract token balances at one block, kept only where the second source agrees exactly. */
async function verifiedHoldings({ provider, secondary = null, blockscoutUrl = null, fetchImpl = fetch, contract, tokens }) {
  const block = Number(BigInt(await provider.send('eth_blockNumber', [])));
  const a = ethers.getAddress(contract);
  const mine = (await BAL.readAt(provider, block, [a], tokens))[a].tokens;
  let theirs = null, source = null;
  if (secondary) { theirs = (await BAL.readAt(secondary, block, [a], tokens))[a].tokens; source = 'second node, same block'; }
  else if (blockscoutUrl) { const q = await BAL.readBlockscout(blockscoutUrl.replace(/\/+$/, ''), [a], fetchImpl); theirs = (q[a] || {}).tokens || {}; source = 'Blockscout index'; }
  if (!theirs) throw new Error('no second source to confirm balances: set ARB_RPC_URL_2 (another provider) or allow Blockscout');
  const rows = tokens.map((t) => {
    const k = t.address.toLowerCase(); const m = mine[k]; const o = theirs[k] !== undefined ? theirs[k] : (source === 'Blockscout index' && m === 0n ? 0n : null);
    return { ...t, amount: m, verified: m !== null && o !== null && m === o };
  });
  return { block, source, rows };
}

/** The split, in exact integers. price8 = USD × 1e8; ethPrice8 likewise. */
function split({ rows, taxBps, gasWei, ethPrice8 }) {
  const pay = rows.filter((r) => r.verified && r.amount > 0n && r.price8 > 0n);
  const usd8 = (r) => (r.amount * BigInt(r.price8)) / 10n ** BigInt(r.decimals); // USD × 1e8
  const total8 = pay.reduce((s, r) => s + usd8(r), 0n);
  const gas8 = (gasWei * BigInt(ethPrice8)) / 10n ** 18n;
  const net8 = total8 > gas8 ? total8 - gas8 : 0n;
  const tax8 = (net8 * BigInt(taxBps) + 9999n) / 10000n;
  const out = pay.map((r) => {
    // this token's share of the reserve, rounded up so the reserve is never short
    const tax = total8 === 0n ? 0n : (r.amount * tax8 + total8 - 1n) / total8;
    return { ...r, usd8: usd8(r), tax: tax > r.amount ? r.amount : tax, payout: r.amount - (tax > r.amount ? r.amount : tax) };
  });
  return { rows: out, total8, gas8, net8, tax8 };
}

/** Transactions, in order: withdraw to the owner, reserve to the vault, the rest to the payout wallet. */
function txs({ rows, contract, owner, vault, payout }) {
  const list = [];
  for (const r of rows) {
    list.push({ id: 'withdraw:' + r.symbol, title: `withdraw ${ethers.formatUnits(r.amount, r.decimals)} ${r.symbol} to your owner wallet`, tx: { to: contract, data: ARB.encodeFunctionData('withdraw', [r.address, r.amount]) }, kind: 'withdraw', token: r, amount: r.amount, to: owner });
    if (r.tax > 0n) list.push({ id: 'tax:' + r.symbol, title: `T1 reserve ${ethers.formatUnits(r.tax, r.decimals)} ${r.symbol} → ${vault}`, tx: { to: r.address, data: ERC20.encodeFunctionData('transfer', [vault, r.tax]) }, kind: 'tax', token: r, amount: r.tax, to: vault });
    if (r.payout > 0n && payout.toLowerCase() !== owner.toLowerCase()) list.push({ id: 'payout:' + r.symbol, title: `payout ${ethers.formatUnits(r.payout, r.decimals)} ${r.symbol} → ${payout}`, tx: { to: r.address, data: ERC20.encodeFunctionData('transfer', [payout, r.payout]) }, kind: 'payout', token: r, amount: r.payout, to: payout });
  }
  return list;
}
module.exports = { verifiedHoldings, split, txs, gasSince, lastPayoutBlock };
