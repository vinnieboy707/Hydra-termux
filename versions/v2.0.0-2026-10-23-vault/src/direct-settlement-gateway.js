'use strict';
/**
 * direct-settlement-gateway.js
 *
 * Core of the settlement trio:
 *   - Ledger: append-only, hash-chained JSONL, fsync'd, single-writer per file.
 *   - SettlementGateway: idempotent Stripe payouts. Intent written before Stripe call.
 *   - Kill switch + structured logger helpers.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const ComplianceEngine = require('./enterprise-compliance-engine');

const GENESIS = '0'.repeat(64);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined)
    .map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

function createLogger(name) {
  const w = (level) => (msg, extra = {}) =>
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, name, msg, ...extra }) + '\n');
  return { info: w('info'), warn: w('warn'), error: w('error') };
}
const silentLog = { info() {}, warn() {}, error() {} };

class Ledger {
  constructor({ file, log = silentLog }) {
    this.file = file; this.log = log;
    this.entries = []; this.byKey = new Map();
    this.lastHash = GENESIS; this.q = Promise.resolve(); this.fh = null;
  }

  async init() {
    await fsp.mkdir(path.dirname(path.resolve(this.file)), { recursive: true });
    const v = await Ledger.verifyFile(this.file);
    if (!v.ok) throw new Error(`Ledger integrity failure at seq ${v.brokenAt}: ${v.reason}`);
    v.entries.forEach((e) => this._index(e));
    this.fh = await fsp.open(this.file, 'a');
    return this;
  }

  static async verifyFile(file) {
    let text = '';
    try { text = await fsp.readFile(file, 'utf8'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const entries = []; let prev = GENESIS; let n = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); }
      catch { return { ok: false, brokenAt: n, reason: 'unparseable line', entries }; }
      const { hash, ...body } = e;
      if (e.seq !== n) return { ok: false, brokenAt: n, reason: 'sequence gap', entries };
      if (e.prevHash !== prev) return { ok: false, brokenAt: n, reason: 'prevHash mismatch', entries };
      if (sha256(stable(body)) !== hash) return { ok: false, brokenAt: n, reason: 'hash mismatch (tampered)', entries };
      entries.push(e); prev = hash; n++;
    }
    return { ok: true, entries, lastHash: prev };
  }

  async verifyChain() {
    const { ok, brokenAt, reason } = await Ledger.verifyFile(this.file);
    return { ok, brokenAt, reason };
  }

  _index(e) {
    this.entries.push(e);
    if (e.dedupeKey) this.byKey.set(e.dedupeKey, e);
    this.lastHash = e.hash;
  }

  append(type, data, dedupeKey = null) {
    const run = this.q.then(async () => {
      if (dedupeKey && this.byKey.has(dedupeKey)) {
        return { duplicate: true, entry: this.byKey.get(dedupeKey) };
      }
      const body = {
        seq: this.entries.length, ts: new Date().toISOString(),
        type, data, dedupeKey, prevHash: this.lastHash,
      };
      const entry = { ...body, hash: sha256(stable(body)) };
      await this.fh.appendFile(JSON.stringify(entry) + '\n');
      await this.fh.sync();
      this._index(entry);
      return { duplicate: false, entry };
    });
    this.q = run.catch(() => {});
    return run;
  }

  async close() {
    await this.q;
    if (this.fh) await this.fh.close();
    this.fh = null;
  }
}

function createKillSwitch({ file = process.env.KILL_SWITCH_FILE || './KILL_SWITCH', log = silentLog } = {}) {
  return {
    isTripped: () => process.env.KILL_SWITCH === '1' || fs.existsSync(file),
    trip(reason) {
      fs.writeFileSync(file, `${new Date().toISOString()} ${reason}\n`);
      log.error('KILL SWITCH TRIPPED', { reason, file });
    },
    reset: () => fs.rmSync(file, { force: true }),
  };
}

class KillSwitchError extends Error {
  constructor(m = 'kill switch is tripped; money movement halted') { super(m); this.name = 'KillSwitchError'; }
}

function isRetryable(err) {
  return ['StripeConnectionError', 'StripeRateLimitError', 'StripeAPIError'].includes(err.type)
    || err.statusCode >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code);
}

class SettlementGateway {
  constructor({
    stripe, ledger, killSwitch, dryRun = false, log = silentLog,
    retry = { attempts: 4, baseMs: 500 },
    idempotencyWindowHours = 23,
  }) {
    if (!stripe || !ledger || !killSwitch) throw new Error('stripe, ledger and killSwitch are required');
    Object.assign(this, { stripe, ledger, killSwitch, dryRun, log, retry, idempotencyWindowHours });
    this.inflight = new Map();
  }

  async availableBalance(currency) {
    const b = await this.stripe.balance.retrieve();
    const row = b.available.find((x) => x.currency === currency);
    
    // Enterprise Audit: Verify ATM Standard for available funds
    const isATMReady = ComplianceEngine.verifyATMStandard('FIAT', { 
        status: 'cleared', 
        onHold: false, 
        rawBalance: b 
    });
    
    if (!isATMReady) {
        ComplianceEngine.failClosed('Funds in Stripe balance do not meet the ATM Standard (not cleared or on hold)');
    }

    return row ? row.amount : 0;
  }

  async payout({ key, amount, currency = 'usd', description }) {
    if (typeof key !== 'string' || !key) throw new Error('key (idempotency key) is required');
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive integer in minor units');
    
    if (this.killSwitch.isTripped()) {
        ComplianceEngine.failClosed('Settlement attempted while KILL SWITCH is tripped');
    }

    const done = this.ledger.byKey.get(`result:${key}`);
    if (done) return { ...done.data, status: done.data.status || done.type, replayed: true };
    if (this.inflight.has(key)) return this.inflight.get(key);

    const p = this._execute({ key, amount, currency, description }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  async _execute(req) {
    const available = await this.availableBalance(req.currency);
    if (available < req.amount) {
      throw new Error(`insufficient available balance: ${available} < ${req.amount} ${req.currency}`);
    }
    if (this.dryRun) {
      this.log.info('dry-run payout (nothing sent, nothing recorded)', req);
      return { dryRun: true, ...req };
    }
    await this.ledger.append('payout_intent', req, `intent:${req.key}`);
    return this._submit(req);
  }

  async _submit(req) {
    let po; let lastErr;
    for (let i = 1; i <= this.retry.attempts; i++) {
      if (this.killSwitch.isTripped()) throw new KillSwitchError();
      try {
        require('./send-guard').assertLiveAllowed('stripe payout (gateway)');
        po = await this.stripe.payouts.create(
          { amount: req.amount, currency: req.currency, description: req.description,
            metadata: { idempotency_key: req.key } },
          { idempotencyKey: req.key },
        );
        break;
      } catch (err) {
        if (!isRetryable(err)) {
          await this.ledger.append('payout_failed',
            { key: req.key, amount: req.amount, currency: req.currency, error: err.message, code: err.code },
            `result:${req.key}`);
          this.log.error('payout rejected by Stripe', { key: req.key, error: err.message });
          throw err;
        }
        lastErr = err;
        this.log.warn('retryable payout error', { key: req.key, attempt: i, error: err.message });
        if (i < this.retry.attempts) await sleep(this.retry.baseMs * 2 ** (i - 1) + Math.random() * this.retry.baseMs);
      }
    }
    if (!po) {
      throw new Error(`payout ${req.key} outcome unknown after ${this.retry.attempts} attempts (${lastErr && lastErr.message}); pending recovery`);
    }
    const res = { key: req.key, payoutId: po.id, status: po.status, amount: req.amount, currency: req.currency };
    await this.ledger.append('payout_result', res, `result:${req.key}`);
    this.log.info('payout recorded', res);
    return res;
  }

  pending() {
    return this.ledger.entries.filter(
      (e) => e.type === 'payout_intent' && !this.ledger.byKey.has(`result:${e.data.key}`));
  }

  async recover() {
    const out = [];
    for (const e of this.pending()) {
      const ageH = (Date.now() - Date.parse(e.ts)) / 36e5;
      if (ageH > this.idempotencyWindowHours) {
        await this.ledger.append('payout_needs_review',
          { key: e.data.key, amount: e.data.amount, currency: e.data.currency, reason: 'idempotency window expired; verify in Stripe dashboard' },
          `result:${e.data.key}`);
        this.log.error('payout needs manual review', { key: e.data.key });
        out.push({ key: e.data.key, status: 'needs_review' });
        continue;
      }
      try { out.push(await this._submit(e.data)); }
      catch (err) { out.push({ key: e.data.key, status: 'still_pending', error: err.message }); }
    }
    return out;
  }
}

module.exports = {
  Ledger, SettlementGateway, KillSwitchError, createKillSwitch, createLogger,
  stable, sha256, GENESIS,
};
