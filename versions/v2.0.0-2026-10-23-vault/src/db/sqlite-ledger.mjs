import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbDir = path.resolve("data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, "chronos_production.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS verified_revenue_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    token TEXT NOT NULL,
    net_profit_usd REAL NOT NULL,
    gas_spent_eth TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhook_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export default db;
