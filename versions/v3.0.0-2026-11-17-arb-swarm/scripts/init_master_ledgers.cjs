const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve('data', 'vault_store.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log("🔒 [LedgerInit] Connecting to SQLite WAL vault at:", dbPath);
const db = new DatabaseSync(dbPath);

// Enable WAL mode and synchronous safety
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA synchronous = NORMAL;`);

// Create fully relational schema for elite agent swarm
db.exec(`
    -- 1. Execution Logs Table (Tracks all flash loan scan and execution attempts)
    CREATE TABLE IF NOT EXISTS execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        gas_gwei REAL NOT NULL,
        route_path TEXT,
        expected_profit_bps REAL,
        status TEXT NOT NULL -- e.g., 'SCAN_CLEARED', 'EXECUTED', 'THROTTLED_GAS', 'REVERTED'
    );

    -- 2. Vault Ledgers Table (Tracks capital allocation, balances, and operational funds)
    CREATE TABLE IF NOT EXISTS vault_ledgers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        balance_wei TEXT NOT NULL,
        net_profit_wei TEXT DEFAULT '0'
    );

    -- 3. Tax Reserves Table (Enforces Policy T1 30% statutory segregation)
    CREATE TABLE IF NOT EXISTS tax_reserves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        gross_inflow_wei TEXT NOT NULL,
        segregated_tax_wei TEXT NOT NULL,
        status TEXT DEFAULT 'SECURED'
    );

    -- 4. Agent Telemetry Table (Monitors health and heartbeat of swarm nodes)
    CREATE TABLE IF NOT EXISTS agent_telemetry (
        agent_name TEXT PRIMARY KEY,
        last_heartbeat TEXT NOT NULL,
        status TEXT NOT NULL,
        metrics_json TEXT
    );
`);

console.log("✅ [LedgerInit] All relational tables created and indexed successfully.");
db.close();
