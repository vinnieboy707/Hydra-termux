'use strict';
// chronos deploy: puts YOUR ChronosFlashArb on Arbitrum One and sets it up for the engine, from this phone.
//   1. deploy the contract (skipped when the address in .env already holds it, owned by you)
//   2. setOperator(executor)       only if not set yet
//   3. setRouter(router) for every executable venue that passed its on-chain check, only if not allowed yet
//   4. setMaxLoan(asset, cap) for every flash-loanable asset the scanner can trade, only where the cap is still 0;
//      cap = your largest SIZE_LADDER_USD × (1 + MAX_LOAN_HEADROOM_PCT) at the Aave oracle price right now
//   5. send the executor the ETH it lacks to reach EXEC_GAS_TOPUP_ETH (only the shortfall)
//   6. write CHRONOS_FLASH_ARB_ADDRESS to .env and restart the engine
// Every number shown comes from the chain at that moment (gas estimates, fee data, balances, oracle prices).
// Nothing is sent without your typed YES. Run it again at any time: it only sends what is still missing.
// chronos deploy --v2 deploys contract v2 (ChronosFlashArbV2: Aave or Balancer loans, direct pool/pair swaps) and also
//   3b. setFactory(factory, true, fee) for every executable venue's factory: V3 factories with fee 0, V2 factories with
//       their swap fee measured on-chain and rounded UP (a fee set too low makes every pair swap revert; too high only
//       keeps a little less). A v1 address in .env is kept as CHRONOS_FLASH_ARB_V1_ADDRESS (withdraw from it any time).
// Your owner key is read from .env (if you keep one there) or typed hidden; it is never written or shown.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const ROOT = path.join(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'contract', 'ChronosFlashArb.json');
const ARTIFACT_V2 = path.join(ROOT, 'contract', 'ChronosFlashArbV2.json');
const IFACE = new ethers.Interface([
  'function owner() view returns (address)', 'function POOL() view returns (address)', 'function MAX_LEGS() view returns (uint8)',
  'function operators(address) view returns (bool)', 'function allowedRouters(address) view returns (bool)', 'function maxLoan(address) view returns (uint256)',
  'function setOperator(address,bool)', 'function setRouter(address,bool)', 'function setMaxLoan(address,uint256)',
  'function VAULT() view returns (address)', 'function allowedFactories(address) view returns (bool)', 'function v2FeeBps(address) view returns (uint16)',
  'function setFactory(address,bool,uint16)',
  'function allowedCurvePools(address) view returns (bool)', 'function setCurvePool(address,bool)',
]);
const DEPLOY_POLICY = [
  { key: 'MAX_LOAN_HEADROOM_PCT', def: 20, min: 0, max: 200, what: 'per-asset loan cap above your largest ladder size, so a price move does not block the largest trade' },
  { key: 'EXEC_GAS_TOPUP_ETH', def: 0.005, min: 0.001, max: 0.1, what: 'ETH the executor should hold for gas; only the shortfall is sent' },
];
function readDeployPolicy(get) {
  const p = {}; const problems = [];
  for (const s of DEPLOY_POLICY) {
    const raw = get(s.key);
    if (raw === undefined || raw === null || String(raw).trim() === '') { p[s.key] = s.def; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < s.min || n > s.max) { p[s.key] = s.def; problems.push(`${s.key}=${raw} outside ${s.min}–${s.max}; using ${s.def}`); } else p[s.key] = n;
  }
  return { policy: p, problems };
}

/** The shipped build of your Drive contract; refuses to load if the bytecode does not match its recorded hash. */
function loadArtifact(file = ARTIFACT) {
  const a = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sha = crypto.createHash('sha256').update(a.bytecode).digest('hex');
  if (sha !== a.bytecodeSha256) throw new Error('contract artifact bytecode does not match its recorded sha256; reinstall');
  const src = path.join(path.dirname(file), path.basename(a.source || ''));
  if (fs.existsSync(src) && crypto.createHash('sha256').update(fs.readFileSync(src, 'utf8')).digest('hex') !== a.sourceSha256) throw new Error('contract source does not match the artifact; reinstall');
  return a;
}

const call = async (provider, to, fn, args = []) => IFACE.decodeFunctionResult(fn, await provider.call({ to, data: IFACE.encodeFunctionData(fn, args) }))[0];

/** cap in asset units: ceil(maxUsd × (100 + headroom)/100 × 10^decimals / price), price8 = USD × 1e8 */
function capFor({ maxUsd, headroomPct, decimals, price8 }) {
  const usdMicros = BigInt(Math.round(maxUsd * (100 + headroomPct) * 1e4)); // USD × 1e6
  const num = usdMicros * 100n * 10n ** BigInt(decimals); // × 1e8 / 1e6 = × 100
  return (num + BigInt(price8) - 1n) / BigInt(price8);
}

/**
 * What is already in place on-chain, and what still has to be sent. Pure reads.
 * a: { provider, owner, aavePool, contract (or null), executor (or null), routers[], assets[{address,symbol,decimals,price8}],
 *      maxLadderUsd, headroomPct, topUpEth }
 */
async function plan(a) {
  const { provider, owner, aavePool } = a;
  const out = { contract: a.contract || null, deploy: false, steps: [], kept: [], notes: [] };
  if (out.contract) {
    const code = await provider.getCode(out.contract);
    if (!code || code === '0x') throw new Error(`CHRONOS_FLASH_ARB_ADDRESS ${out.contract} has no contract on Arbitrum One. Remove CHRONOS_FLASH_ARB_ADDRESS from .env to deploy a new one (nothing was sent).`);
    let o, p, legs;
    try { [o, p, legs] = await Promise.all([call(provider, out.contract, 'owner'), call(provider, out.contract, 'POOL'), call(provider, out.contract, 'MAX_LEGS')]); }
    catch (_) { throw new Error(`${out.contract} is not a ChronosFlashArb (owner/POOL/MAX_LEGS unreadable). Remove CHRONOS_FLASH_ARB_ADDRESS from .env to deploy yours (nothing was sent).`); }
    if (![4, 5].includes(Number(legs))) throw new Error(`${out.contract} is not this ChronosFlashArb build (MAX_LEGS ${legs})`); // v1/v2: 4 · v2.2: 5
    if (o.toLowerCase() !== owner.toLowerCase()) throw new Error(`${out.contract} is owned by ${o}, not by the wallet you unlocked (${owner}). Use that wallet's key.`);
    if (p.toLowerCase() !== aavePool.toLowerCase()) throw new Error(`${out.contract} borrows from ${p}, not the Aave V3 pool ${aavePool}.`);
    if (a.v2) {
      let vault = null; try { vault = await call(provider, out.contract, 'VAULT'); } catch (_) { /* v1 */ }
      if (vault === null) { out.notes.push(`${out.contract} is contract v1; a new v2 is deployed and v1 stays yours at CHRONOS_FLASH_ARB_V1_ADDRESS`); out.replaces = out.contract; out.contract = null; out.deploy = true; }
      else if (vault.toLowerCase() !== a.v2.vault.toLowerCase()) throw new Error(`${out.contract} borrows from Balancer vault ${vault}, not ${a.v2.vault}.`);
    }
  } else out.deploy = true;

  const has = !out.deploy;
  const c = out.contract;
  if (a.executor) {
    if (has && await call(provider, c, 'operators', [a.executor])) out.kept.push(`executor ${a.executor} is already an operator`);
    else out.steps.push({ id: 'operator', title: `setOperator(${a.executor}, true)`, why: 'lets your HSM executor call execute()', fn: 'setOperator', args: [a.executor, true] });
  } else out.notes.push('No executor yet (CHRONOS_EXECUTOR_ADDRESS not set): run cloud/gcp-setup.sh, put the address it prints in .env, then run chronos deploy again.');
  for (const r of a.routers) {
    if (has && await call(provider, c, 'allowedRouters', [r.address])) out.kept.push(`${r.id} router already allowed`);
    else out.steps.push({ id: 'router:' + r.id, title: `setRouter(${r.address}, true)`, why: `${r.id} router (passed its on-chain check)`, fn: 'setRouter', args: [r.address, true] });
  }
  for (const f of (a.v2 && a.v2.factories) || []) {
    const [ok, fee] = has ? await Promise.all([call(provider, c, 'allowedFactories', [f.address]), call(provider, c, 'v2FeeBps', [f.address])]) : [false, 0n];
    if (ok && Number(fee) === f.fee) out.kept.push(`${f.id} factory already allowed${f.fee ? ` (fee ${f.fee} bps)` : ''}`);
    else out.steps.push({ id: 'factory:' + f.id, title: `setFactory(${f.address}, true, ${f.fee})`, why: f.fee ? `${f.id} pairs swapped directly; fee ${f.fee} bps (measured on-chain, rounded up)${ok ? `, was ${fee}` : ''}` : `${f.id} pools swapped directly`, fn: 'setFactory', args: [f.address, true, f.fee] });
  }
  // v2.3: the Curve stable pools that passed their on-chain check (coins at their indexes) and are in the token universe
  for (const p of (a.v2 && a.v2.curvePools) || []) {
    if (has && await call(provider, c, 'allowedCurvePools', [p.address])) out.kept.push(`${p.id} Curve pool already allowed`);
    else out.steps.push({ id: 'curve:' + p.id, title: `setCurvePool(${p.address}, true)`, why: `${p.id}: a Curve stable pool whose coins were checked on chain`, fn: 'setCurvePool', args: [p.address, true] });
  }
  for (const as of a.assets) {
    const cap = capFor({ maxUsd: a.maxLadderUsd, headroomPct: a.headroomPct, decimals: as.decimals, price8: as.price8 });
    const cur = has ? await call(provider, c, 'maxLoan', [as.address]) : 0n;
    if (cur === 0n) out.steps.push({ id: 'cap:' + as.symbol, title: `setMaxLoan(${as.symbol}, ${ethers.formatUnits(cap, as.decimals)})`, why: `$${a.maxLadderUsd.toLocaleString('en-US')} largest size + ${a.headroomPct}% at $${(Number(as.price8) / 1e8).toLocaleString('en-US', { maximumFractionDigits: 6 })}`, fn: 'setMaxLoan', args: [as.address, cap] });
    else if (cur < cap) out.kept.push(`${as.symbol} cap ${ethers.formatUnits(cur, as.decimals)} kept (yours; below the ${ethers.formatUnits(cap, as.decimals)} the largest size needs, so those trades are refused)`);
    else out.kept.push(`${as.symbol} cap ${ethers.formatUnits(cur, as.decimals)} already set`);
  }
  if (a.executor) {
    const bal = await provider.getBalance(a.executor);
    const target = ethers.parseEther(String(a.topUpEth));
    if (bal < target) out.steps.push({ id: 'gas', title: `send ${ethers.formatEther(target - bal)} ETH to the executor`, why: `it holds ${ethers.formatEther(bal)} ETH; target ${a.topUpEth} ETH for gas`, value: target - bal, to: a.executor });
    else out.kept.push(`executor holds ${ethers.formatEther(bal)} ETH (target ${a.topUpEth})`);
  }
  return out;
}

/** Transaction request for one step (contract address known). */
function txFor(step, contract) {
  if (step.to) return { to: step.to, value: step.value };
  return { to: contract, data: IFACE.encodeFunctionData(step.fn, step.args) };
}

/** Gas and cost for a list of tx requests, from the chain right now. ethUsd from the Aave oracle (USD × 1e8). */
async function price(provider, from, txs, ethPrice8) {
  const fee = await provider.getFeeData();
  const maxFee = fee.maxFeePerGas || fee.gasPrice;
  if (!maxFee) throw new Error('the node returned no fee data; not sending');
  let gasTotal = 0n; const each = [];
  for (const tx of txs) {
    const g = await provider.estimateGas({ ...tx, from });
    const limit = (g * 120n) / 100n; // 20% above the node's estimate; unused gas is not charged
    each.push(limit); gasTotal += limit;
  }
  const worstWei = gasTotal * maxFee;
  const usd = (wei) => (ethPrice8 ? Number((wei * BigInt(ethPrice8)) / 10n ** 18n) / 1e8 : null);
  return { each, gasTotal, maxFee, worstWei, worstUsd: usd(worstWei) };
}

// the node's pending nonce, read directly (ethers reuses identical requests for 250 ms, which would hand back a stale one)
async function freshNonce(wallet) { return Number(BigInt(await wallet.provider.send('eth_getTransactionCount', [await wallet.getAddress(), 'pending']))); }

async function sendAll(wallet, txs, limits, record) {
  const done = [];
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    if (typeof wallet.label === 'function') wallet.label(t.title, t.why); // MetaMask shows what you are approving and why
    const sent = await wallet.sendTransaction({ ...t.tx, gasLimit: limits[i], nonce: await freshNonce(wallet) });
    record({ step: t.id, txHash: sent.hash, at: new Date().toISOString(), state: 'sent' });
    const r = await sent.wait();
    record({ step: t.id, txHash: sent.hash, block: r.blockNumber, gasUsed: r.gasUsed.toString(), status: r.status, at: new Date().toISOString(), state: 'confirmed' });
    if (r.status !== 1) throw new Error(`${t.title} reverted (tx ${sent.hash}); stopped here. Nothing after it was sent.`);
    done.push({ ...t, hash: sent.hash, block: r.blockNumber, gasUsed: r.gasUsed, effectiveGasPrice: r.gasPrice });
  }
  return done;
}

/** Deploy the artifact; verify owner and pool on-chain afterwards. */
/**
 * The constructor arguments for this artifact, decided by the artifact's own constructor: v1 (pool), v2 (pool, vault),
 * v2.2 (pool, vault, morpho), v2.3 (pool, vault, morpho, Uniswap V4 PoolManager). A lender left unset is the zero
 * address, which the contract treats as "not used". The price shown before YES and the deployment use this same list.
 */
function ctorArgs(art, aavePool, { vault = null, morpho = null, v4 = null } = {}) {
  const n = ((art.abi.find((x) => x.type === 'constructor') || {}).inputs || []).length;
  const Z = ethers.ZeroAddress;
  if (n > 4) throw new Error(`this contract's constructor takes ${n} arguments; this engine knows up to 4 (update Chronos)`);
  return n === 4 ? [aavePool, vault || Z, morpho || Z, v4 || Z] : n === 3 ? [aavePool, vault || Z, morpho || Z] : n === 2 ? [aavePool, vault || Z] : [aavePool];
}

async function deployContract(wallet, art, aavePool, gasLimit, record, vault = null, morpho = null, v4 = null) {
  const f = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const args = ctorArgs(art, aavePool, { vault, morpho, v4 });
  if (typeof wallet.label === 'function') wallet.label(`Deploy ${art.contract}`, 'your flash-loan contract; you become its owner');
  const c = await f.deploy(...args, { gasLimit, nonce: await freshNonce(wallet) });
  const tx = c.deploymentTransaction();
  record({ step: 'deploy', txHash: tx.hash, at: new Date().toISOString(), state: 'sent' });
  const r = await tx.wait();
  if (r.status !== 1) throw new Error(`deployment reverted (tx ${tx.hash})`);
  const address = r.contractAddress;
  record({ step: 'deploy', txHash: tx.hash, contract: address, block: r.blockNumber, gasUsed: r.gasUsed.toString(), status: r.status, at: new Date().toISOString(), state: 'confirmed' });
  const p = wallet.provider;
  const [o, pool] = await Promise.all([call(p, address, 'owner'), call(p, address, 'POOL')]);
  if (o.toLowerCase() !== (await wallet.getAddress()).toLowerCase() || pool.toLowerCase() !== aavePool.toLowerCase()) throw new Error(`deployed ${address} but owner/pool read back wrong (owner ${o}, pool ${pool}); do not use it`);
  if (vault) { const v = await call(p, address, 'VAULT'); if (v.toLowerCase() !== vault.toLowerCase()) throw new Error(`deployed ${address} but its Balancer vault reads back as ${v}; do not use it`); }
  return { address, hash: tx.hash, block: r.blockNumber, gasUsed: r.gasUsed, effectiveGasPrice: r.gasPrice };
}

/**
 * contract v2 factory settings from the venues that passed their on-chain check: V3 factories fee 0; V2 factories their
 * swap fee measured from a real quote (cycles.v2FeeFromQuote never overstates, so +1 never understates). A V2 venue
 * whose fee could not be measured is left out (its pairs still trade through its router).
 */
function v2Factories(venues, okIds, v2Fees) {
  const out = [], skipped = [];
  for (const v of venues.filter((x) => okIds.has(x.id) && x.executable && x.factory)) {
    if (v.kind === 'v3') out.push({ id: v.id, address: ethers.getAddress(v.factory.toLowerCase()), fee: 0 });
    else if (Number.isFinite(v2Fees[v.id])) out.push({ id: v.id, address: ethers.getAddress(v.factory.toLowerCase()), fee: Math.min(9999, v2Fees[v.id] + 1) });
    else skipped.push(v.id);
  }
  return { factories: out, skipped };
}

module.exports = { plan, txFor, price, sendAll, deployContract, ctorArgs, loadArtifact, capFor, readDeployPolicy, v2Factories, DEPLOY_POLICY, IFACE, ARTIFACT, ARTIFACT_V2 };
