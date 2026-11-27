-- Chronos OS Complete Database Schema Initialization (Updated for 10-Stream Fortification & Tap-to-Pay)
-- Tables: revenue_streams_registry, unified_ledger_entries, tap_to_pay_transactions, compliance_audit, failure_ledger

CREATE DATABASE chronos_ledger;

\c chronos_ledger;

CREATE TABLE IF NOT EXISTS revenue_streams_registry (
    id SERIAL PRIMARY KEY,
    stream_identifier VARCHAR(50) UNIQUE NOT NULL,
    stream_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    allocation_weight NUMERIC(5, 4) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE_24_7',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unified_ledger_entries (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(100) UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    stream_id VARCHAR(50) NOT NULL,
    stream_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    revenue_usd NUMERIC(12, 2) NOT NULL,
    treasury_allocation NUMERIC(12, 2) NOT NULL,
    spendable_tap_to_pay_allocation NUMERIC(12, 2) NOT NULL,
    status VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS tap_to_pay_transactions (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(100) UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    spend_amount_usd NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_audit (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    audit_event VARCHAR(255) NOT NULL,
    compliance_status VARCHAR(50) NOT NULL,
    ledger_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS failure_ledger (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    error_signature TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    resolution_action TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'RESOLVED'
);
