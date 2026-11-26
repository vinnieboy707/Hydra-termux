'use strict';
// Reads your on-chain record (data/verified_mainnet_actions.json). Only entries with a real tx hash count as transactions.
const fs = require('fs');
const path = require('path');
const { clean } = require('./safety.cjs');
function readRecord(workspace) {
  const file = path.join(workspace, 'data', 'verified_mainnet_actions.json');
  let d; try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return { found: false, file }; }
  const actions = Object.entries(d.actions || {}).map(([key, v]) => ({ key: clean(key, 48), txHash: v.txHash, block: Number.isInteger(v.blockNumber) ? v.blockNumber : null, summary: clean(v.summary, 200), isTx: /^0x[0-9a-fA-F]{64}$/.test(String(v.txHash || '')) }));
  const txs = actions.filter((a) => a.isTx);
  return { found: true, file, payoutWallet: /^0x[0-9a-fA-F]{40}$/.test(d.payoutWallet || '') ? d.payoutWallet : null, actions, txCount: txs.length, flashExecutions: txs.filter((a) => /flash/i.test(a.key)).length };
}
module.exports = { readRecord };
