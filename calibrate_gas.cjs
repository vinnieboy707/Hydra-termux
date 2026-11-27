#!/usr/bin/env node
'use strict';
// Turns your real confirmed transactions into measured gas numbers. Usage: node calibrate_gas.cjs 0xHASH [0xHASH ...]
const path = require('path');
const { ethers } = require('ethers');
const { loadConfig } = require('./lib/config.cjs');
const C = require('./lib/chain.cjs');
(async () => {
  const hashes = process.argv.slice(2).filter((h) => /^0x[0-9a-fA-F]{64}$/.test(h));
  if (!hashes.length) { console.error('give one or more 0x tx hashes'); process.exit(2); }
  const cfg = loadConfig(require('./lib/live.cjs').findEnvFile());
  if (!cfg.rpcUrl) { console.error('no RPC url in .env'); process.exit(2); }
  const provider = await C.connect(cfg);
  for (const h of hashes) {
    const r = await provider.getTransactionReceipt(h);
    if (!r) { console.log(h.slice(0, 12) + '  not found'); continue; }
    const ethCost = Number(ethers.formatEther(r.gasUsed * r.gasPrice));
    console.log(`${h.slice(0, 12)}  status ${r.status}  block ${r.blockNumber}  gasUsed ${r.gasUsed}  gasPrice ${(Number(r.gasPrice) / 1e9).toFixed(5)} gwei  fee ${ethCost.toFixed(8)} ETH`);
  }
  console.log('\nUse the biggest gasUsed from a comparable swap as a floor for GAS_UNITS_ASSUMED. A flash loan plus two swaps costs more than one swap, so run the readiness estimateGas before trusting any number.');
})().catch((e) => { console.error('FAIL-CLOSED:', require('./lib/safety.cjs').redact(e.shortMessage || e.message)); process.exit(1); });
