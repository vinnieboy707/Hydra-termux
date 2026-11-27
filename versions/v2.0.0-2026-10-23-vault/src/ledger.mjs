// Append-only JSONL journal + atomically-replaced state snapshot[span_0](start_span)[span_0](end_span)[span_1](start_span)[span_1](end_span).
// Tracks earmarked tax/expense reserve vs. free withdrawable capital[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span).
import fs from "node:fs";
import path from "node:path";

export class Ledger {
  constructor(dir, reserveBps = 3000) {
    if (reserveBps < 0 || reserveBps > 10000) throw new Error("bad reserveBps");
    this.reserveBps = BigInt(reserveBps);
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.journal = path.join(dir, "ledger.jsonl");
    this.statePath = path.join(dir, "state.json");
    this.state = fs.existsSync(this.statePath)
      ? JSON.parse(fs.readFileSync(this.statePath, "utf8"))
      : { tokens: {}, consecutiveFailures: 0, paused: false };
  }

  _bucket(token) {
    const k = token.toLowerCase();
    this.state.tokens[k] ??= { gross: "0", reserve: "0", withdrawable: "0", withdrawn: "0", gasSpent: "0", trades: 0 };
    return this.state.tokens[k];
  }

  _persist(entry) {
    const fd = fs.openSync(this.journal, "a");
    fs.writeSync(fd, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    const tmp = this.statePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.statePath);
  }

  recordProfit({ txHash, token, profit, gasCostToken = 0n }) {
    if (this.hasTx(txHash)) return;
    const p = BigInt(profit);
    const reserve = (p * this.reserveBps) / 10000n;
    const b = this._bucket(token);
    b.gross = (BigInt(b.gross) + p).toString();
    b.reserve = (BigInt(b.reserve) + reserve).toString();
    b.withdrawable = (BigInt(b.withdrawable) + (p - reserve)).toString();
    b.gasSpent = (BigInt(b.gasSpent) + BigInt(gasCostToken)).toString();
    b.trades += 1;
    this.state.consecutiveFailures = 0;
    this._persist({ type: "profit", txHash, token, profit: p.toString(), reserve: reserve.toString() });
  }

  recordFailure(reason, extra = {}) {
    this.state.consecutiveFailures += 1;
    this._persist({ type: "failure", reason, ...extra });
  }

  markPaused() {
    this.state.paused = true;
    this._persist({ type: "paused" });
  }

  recordWithdrawal({ token, amount, txHash = null }) {
    const b = this._bucket(token);
    const a = BigInt(amount);
    if (a > BigInt(b.withdrawable)) throw new Error("withdrawal exceeds withdrawable balance");
    b.withdrawable = (BigInt(b.withdrawable) - a).toString();
    b.withdrawn = (BigInt(b.withdrawn) + a).toString();
    this._persist({ type: "withdrawal", token, amount: a.toString(), txHash });
  }

  hasTx(txHash) {
    if (!fs.existsSync(this.journal)) return false;
    return fs.readFileSync(this.journal, "utf8").includes(`"txHash":"${txHash}"`);
  }

  summary() {
    return this.state;
  }
}
