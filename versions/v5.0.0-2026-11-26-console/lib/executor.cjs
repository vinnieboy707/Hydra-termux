'use strict';
// Live executor. Sends ChronosFlashArb.execute(...) only when, at that moment:
//   the mode controller says LIVE · nothing else is in flight · the route is out of cooldown ·
//   every contract and flash-loan requirement passes (shadow preflight) · a fresh simulation from the executor
//   shows net profit ≥ your floor after the flash fee, gas and the priority-fee bid · gas is under your ceiling.
// The contract's minProfit makes the transaction revert instead of losing money if the market moves first; the
// only thing a revert costs is its gas, which is capped per day. The executor key never leaves Cloud KMS.
// Every sent transaction is written to data/executions.jsonl before waiting for it, so realized profit is
// verified from its receipt even if this process stops.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const SH = require('./shadow.cjs');
const { utcDay } = require('./mode.cjs');

const GWEI = 10n ** 9n;
const usdToWei = (usd, ethPrice8) => (BigInt(Math.floor(usd * 1e8)) * 10n ** 18n) / BigInt(ethPrice8);
const weiToUsd = (wei, ethPrice8) => Number((BigInt(wei) * BigInt(ethPrice8)) / 10n ** 18n) / 1e8;

class Executor {
  /** spend: the daily spending cap (lib/spend.cjs): a send whose worst-case revert would not fit is not made */
  constructor({ provider, broadcast = [], signer, contract, policy, cfg, dataDir, log = () => {}, spend = null }) {
    Object.assign(this, { provider, broadcast, signer, contract, policy, cfg, dataDir, log, spend });
    this.inFlight = null; this.routeLast = new Map();
    this.stateFile = path.join(dataDir, 'exec_state.json');
    try { this.stats = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch (_) { this.stats = null; }
    this._roll();
  }
  _roll() { const d = utcDay(Date.now()); if (!this.stats || this.stats.day !== d) this.stats = { day: d, gasUsd: 0, lossGasUsd: 0, netUsd: 0, sent: 0, succeeded: 0, reverted: 0, consecutiveReverts: this.stats ? this.stats.consecutiveReverts : 0, pending: this.stats && Array.isArray(this.stats.pending) ? this.stats.pending : [] }; if (!Array.isArray(this.stats.pending)) this.stats.pending = []; }
  /**
   * A trade that had no receipt within 120 s, settled later from its receipt (lib/realized.cjs): a revert is counted
   * exactly as if it had been seen at once (reverts in a row, today's gas loss, your daily spending cap).
   * → true when this settled one of its pending trades
   */
  settle(txHash, { status, gasUsd }) {
    this._roll(); const h = String(txHash).toLowerCase(); const i = this.stats.pending.indexOf(h); if (i < 0) return false;
    this.stats.pending.splice(i, 1); const g = Number.isFinite(gasUsd) ? gasUsd : 0;
    this.stats.gasUsd += g;
    if (status === 'reverted') { this.stats.reverted++; this.stats.consecutiveReverts++; this.stats.netUsd -= g; this.stats.lossGasUsd += g; if (this.spend) this.spend.record('gas-loss', g); }
    else { this.stats.succeeded++; this.stats.consecutiveReverts = 0; }
    this._save(); return true;
  }
  _save() { try { fs.mkdirSync(this.dataDir, { recursive: true }); fs.writeFileSync(this.stateFile + '.tmp', JSON.stringify(this.stats), { mode: 0o600 }); fs.renameSync(this.stateFile + '.tmp', this.stateFile); } catch (_) { /* stats also live in memory */ } }
  /** the engine reconnected (failover, re-initialise): every read, simulation and send moves to the new node */
  rebind(provider) { if (!provider || provider === this.provider) return; this.provider = provider; if (this.signer && typeof this.signer.connect === 'function') this.signer = this.signer.connect(provider); }
  resetReverts() { this._roll(); this.stats.consecutiveReverts = 0; this._save(); }
  today() { this._roll(); return { ...this.stats }; }

  /** Ready to send? KMS key reachable, executor is an operator on your contract, enough ETH for gas. */
  async readiness() {
    try {
      const address = await this.signer.getAddress();
      const c = new ethers.Contract(this.contract, SH.IFACE, this.provider);
      const [isOp, bal] = await Promise.all([c.operators(address), this.provider.getBalance(address)]);
      const gasEth = Number(ethers.formatEther(bal));
      if (!isOp) return { ready: false, why: `executor ${address} is not an operator: owner must call setOperator`, address, gasEth };
      if (gasEth < this.policy.EXEC_MIN_GAS_ETH) return { ready: false, why: `executor has ${gasEth.toFixed(5)} ETH; needs ≥ ${this.policy.EXEC_MIN_GAS_ETH}`, address, gasEth };
      return { ready: true, why: null, address, gasEth };
    } catch (e) { return { ready: false, why: 'executor key not reachable: ' + SH.decodeError(e) }; }
  }

  /**
   * Try to send one opportunity. cand: approved candidate with runParams and routeKey. aave: { pool, flashEnabled,
   * availableLiquidity }. px: { assetPrice8, decimals, ethPrice8 }. Returns what happened (never throws).
   */
  async execute({ cand, aave, px }) {
    const P = this.policy;
    if (this.inFlight) return { sent: false, reason: 'another transaction is in flight' };
    const key = cand.routeKey || JSON.stringify(cand.runParams.legs.map((l) => l.router));
    if (Date.now() - (this.routeLast.get(key) || 0) < P.EXEC_ROUTE_COOLDOWN_SEC * 1000) return { sent: false, reason: 'route cooling down' };
    this.inFlight = key;
    try {
      const from = await this.signer.getAddress();
      // direct calls (no 250 ms request reuse): a stale block, base fee or nonce must never reach a signature
      const raw0 = await this.provider.send('eth_getBlockByNumber', ['latest', false]);
      const block = { number: Number(BigInt(raw0.number)), timestamp: Number(BigInt(raw0.timestamp)) };
      const baseFee = raw0.baseFeePerGas ? BigInt(raw0.baseFeePerGas) : BigInt(await this.provider.send('eth_gasPrice', []));
      if (baseFee > BigInt(Math.round(this.cfg.GAS_CEILING_GWEI * 1e9))) return { sent: false, reason: `base fee ${ethers.formatUnits(baseFee, 'gwei')} gwei above GAS_CEILING_GWEI` };
      const params = { ...cand.runParams, deadline: Number(block.timestamp) + this.cfg.DEADLINE_SECONDS };
      const pf = await SH.preflight({ provider: this.provider, contract: this.contract, executor: from, params, aave, flash: cand.flash });
      if (!pf.ok) return { sent: false, reason: 'requirement not met: ' + pf.checks.filter((c) => !c.ok).map((c) => c.name).join(', ') };
      const sim = await SH.simulate({ provider: this.provider, contract: this.contract, executor: from, params });
      if (!sim.ok) return { sent: false, reason: 'fresh simulation failed: ' + sim.error };
      const gasLimit = (sim.gas * 12n) / 10n > BigInt(P.EXEC_MAX_GAS_UNITS) ? BigInt(P.EXEC_MAX_GAS_UNITS) : (sim.gas * 12n) / 10n;
      if (sim.gas > BigInt(P.EXEC_MAX_GAS_UNITS)) return { sent: false, reason: `needs ${sim.gas} gas > EXEC_MAX_GAS_UNITS` };
      const profitUsd = Number((sim.profit * BigInt(px.assetPrice8)) / 10n ** BigInt(px.decimals)) / 1e8;
      const baseCostUsd = weiToUsd(sim.gas * baseFee, px.ethPrice8);
      const netBeforeTip = profitUsd - baseCostUsd;
      const floor = require('./engine.cjs').floorUsd(this.cfg, baseCostUsd); // your minimum, or 2× this send's own gas
      if (netBeforeTip < floor) return { sent: false, reason: `fresh net $${netBeforeTip.toFixed(4)} below floor $${floor}` };
      // Priority-fee bid (Arbitrum orders each 125 ms round by priority fee): a share of the surplus above your floor,
      // so a won trade still nets ≥ floor, and never more than what a revert could cost inside today's loss cap.
      this._roll();
      const remaining = P.MAX_DAILY_GAS_USD - this.stats.lossGasUsd;
      const worstBaseUsd = weiToUsd(gasLimit * baseFee * 2n, px.ethPrice8);
      if (worstBaseUsd > remaining) return { sent: false, reason: 'MAX_DAILY_GAS_USD: a revert now could exceed today\'s gas-loss cap' };
      if (this.spend) { const a = this.spend.allow('gas-loss', worstBaseUsd); if (!a.ok) return { sent: false, reason: a.why }; }
      const tipBudgetUsd = Math.max(0, Math.min(((netBeforeTip - floor) * P.EXEC_TIP_SHARE_BPS) / 10000, remaining - worstBaseUsd, this.spend ? this.spend.room() - worstBaseUsd : Infinity)); // a reverted send pays its bid too
      const tipPerGas = gasLimit > 0n ? usdToWei(tipBudgetUsd, px.ethPrice8) / gasLimit : 0n;
      // The contract's minProfit came from the scan; the bid comes from this fresher simulation. Before signing, the
      // on-chain minimum is raised to cover this send's worst-case cost (gas limit at the max fee, bid included) plus
      // your floor, and the call is simulated again at that minimum: a trade that lands can never net less than the
      // floor after its own gas and bid. If it cannot guarantee that, nothing is sent.
      const worstPaidUsd = weiToUsd(gasLimit * (baseFee * 2n + tipPerGas), px.ethPrice8);
      const needRaw = BigInt(Math.ceil(((worstPaidUsd + floor) * 10 ** Number(px.decimals) * 1e8) / Number(px.assetPrice8)));
      if (needRaw > BigInt(params.minProfit)) {
        params.minProfit = needRaw.toString();
        const sim2 = await SH.simulate({ provider: this.provider, contract: this.contract, executor: from, params });
        if (!sim2.ok) return { sent: false, reason: `fresh profit cannot guarantee gas + bid + floor ($${(worstPaidUsd + floor).toFixed(4)}) on-chain: ${sim2.error}` };
        sim.data = sim2.data;
      }
      const net = await this.provider.getNetwork();
      const nonce = Number(BigInt(await this.provider.send('eth_getTransactionCount', [from, 'pending'])));
      const tx = { type: 2, chainId: net.chainId, nonce, to: this.contract, data: sim.data, value: 0n, gasLimit, maxPriorityFeePerGas: tipPerGas, maxFeePerGas: baseFee * 2n + tipPerGas };
      const raw = await this.signer.signTransaction(tx);
      const hash = ethers.keccak256(raw);
      // record first, then broadcast to every configured node (same signed bytes; duplicates are harmless)
      const rec = { txHash: hash, at: new Date().toISOString(), route: key, expectedNetUsd: +(netBeforeTip - tipBudgetUsd).toFixed(6), tipGwei: ethers.formatUnits(tipPerGas, 'gwei'), gasLimit: gasLimit.toString(), block: Number(block.number) };
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.appendFileSync(path.join(this.dataDir, 'executions.jsonl'), JSON.stringify(rec) + '\n', { mode: 0o600 });
      this.routeLast.set(key, Date.now());
      const sends = [this.provider, ...this.broadcast].map((p) => p.broadcastTransaction(raw).then(() => true));
      try { await Promise.any(sends); } catch (e) { return { sent: false, reason: 'no node accepted the transaction: ' + SH.decodeError(e.errors ? e.errors[0] : e), txHash: hash }; }
      this.stats.sent++; this._save();
      this.log(`sent ${hash} ${key} expected net $${rec.expectedNetUsd}`);
      const rc = await this.provider.waitForTransaction(hash, 1, 120000).catch(() => null);
      if (!rc) { this.stats.pending.push(hash.toLowerCase()); this._save(); return { sent: true, txHash: hash, status: 'pending', reason: 'no receipt within 120 s (it is recorded; its receipt is checked later and a revert still counts against your caps)' }; }
      const gasUsd = weiToUsd(BigInt(rc.gasUsed) * BigInt(rc.gasPrice || rc.effectiveGasPrice || 0n), px.ethPrice8);
      this.stats.gasUsd += gasUsd;
      if (rc.status === 1) {
        const ev = rc.logs.filter((l) => l.address.toLowerCase() === this.contract.toLowerCase()).map((l) => { try { return SH.IFACE.parseLog(l); } catch (_) { return null; } }).find((x) => x && x.name === 'Arbitrage');
        const pUsd = ev ? Number((ev.args.profit * BigInt(px.assetPrice8)) / 10n ** BigInt(px.decimals)) / 1e8 : 0;
        this.stats.succeeded++; this.stats.consecutiveReverts = 0; this.stats.netUsd += pUsd - gasUsd; this._save();
        return { sent: true, txHash: hash, status: 'success', profitUsd: pUsd, gasUsd, netUsd: pUsd - gasUsd };
      }
      this.stats.reverted++; this.stats.consecutiveReverts++; this.stats.netUsd -= gasUsd; this.stats.lossGasUsd += gasUsd; this._save();
      if (this.spend) this.spend.record('gas-loss', gasUsd);
      return { sent: true, txHash: hash, status: 'reverted', gasUsd, netUsd: -gasUsd, reason: 'reverted on-chain (market moved first; only gas was spent)' };
    } catch (e) {
      return { sent: false, reason: 'executor error: ' + SH.decodeError(e) };
    } finally { this.inFlight = null; }
  }
}

module.exports = { Executor, usdToWei, weiToUsd, GWEI };
