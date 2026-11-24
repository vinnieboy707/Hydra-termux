-- Chronos OS SQLite Database Schema Initialization
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS revenue_streams_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_identifier TEXT UNIQUE NOT NULL,
    stream_name TEXT NOT NULL,
    category TEXT NOT NULL,
    allocation_weight REAL NOT NULL,
    status TEXT DEFAULT 'ACTIVE_24_7',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unified_ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT UNIQUE NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    stream_id TEXT NOT NULL,
    stream_name TEXT NOT NULL,
    category TEXT NOT NULL,
    revenue_usd REAL NOT NULL,
    treasury_allocation REAL NOT NULL,
    spendable_tap_to_pay_allocation REAL NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tap_to_pay_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT UNIQUE NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    spend_amount_usd REAL NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    audit_event TEXT NOT NULL,
    compliance_status TEXT NOT NULL,
    ledger_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS failure_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_signature TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    resolution_action TEXT NOT NULL,
    status TEXT DEFAULT 'RESOLVED'
);
