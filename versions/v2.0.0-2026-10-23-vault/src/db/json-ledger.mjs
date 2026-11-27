import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
fs.mkdirSync(dir, { recursive: true });
const FILE = path.join(dir, "ledger_v2.jsonl");
const M = 1e6;
const COUNTED = new Set(["onchain", "stripe_live"]);
const usd = (m) => m / M;
export const toMicro = (v) => Math.round(Number(v) * M);

function readAll() {
  let text = "";
  try { text = fs.readFileSync(FILE, "utf8"); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
  const seen = new Set(), rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (seen.has(r.ref)) continue;
    seen.add(r.ref); rows.push(r);
  }
  return rows;
}

// revenue/cost are integer micro-USD. profit = revenue - cost (derived, never stored)
export function addEntry(e) {
  if (!e.ref || !e.kind || !e.source) throw new Error("ref, kind, source required");
  if (!Number.isInteger(e.revenue) || !Number.isInteger(e.cost))
    throw new Error("revenue/cost must be integer micro-USD");
  if (readAll().some((r) => r.ref === e.ref)) return { changes: 0, duplicate: true };
  fs.appendFileSync(FILE, JSON.stringify({ ...e, ts: e.ts ?? Math.floor(Date.now() / 1000) }) + "\n");
  return { changes: 1 };
}

export function summary() {
  const by = {};
  for (const r of readAll()) {
    const b = (by[r.source] ??= { entries: 0, revenue: 0, cost: 0 });
    b.entries++; b.revenue += r.revenue; b.cost += r.cost;
  }
  const out = {}; let rev = 0, cost = 0, n = 0;
  for (const [s, b] of Object.entries(by)) {
    out[s] = { entries: b.entries, revenue_usd: usd(b.revenue), cost_usd: usd(b.cost),
               profit_usd: usd(b.revenue - b.cost), counted: COUNTED.has(s) };
    if (COUNTED.has(s)) { rev += b.revenue; cost += b.cost; n += b.entries; }
  }
  return { counted: { entries: n, revenue_usd: usd(rev), cost_usd: usd(cost), net_profit_usd: usd(rev - cost) },
           by_source: out };
}

export function recent(limit = 50) {
  return readAll().sort((a, b) => b.ts - a.ts).slice(0, limit)
    .map((r) => ({ ...r, revenue_usd: usd(r.revenue), cost_usd: usd(r.cost), profit_usd: usd(r.revenue - r.cost) }));
}

// Legacy shim: old INSERT callers land as "unverified" and never count toward totals
export default {
  prepare(sql) {
    return {
      run(...p) {
        if (!/INSERT INTO verified_revenue_ledger/i.test(sql)) return { changes: 0 };
        return addEntry({ ref: String(p[0]), kind: "legacy", source: "unverified", asset: p[1],
                          borrowed: String(p[2]), revenue: toMicro(p[3]), cost: 0, ts: p[4] });
      },
    };
  },
  exec() { return true; },
};
