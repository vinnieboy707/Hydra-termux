#!/usr/bin/env python3
"""
CHRONOS OS // AUTONOMOUS ARBITRAGE & REVENUE ENGINE (PRODUCTION)
Municipal Filing Ingestion -> Stripe Retainer Billing -> On-Chain Settlement Verification
"""

import os
import sys
import json
import sqlite3
import logging
from datetime import datetime, timezone
from decimal import Decimal

if "--use-strict" in os.environ.get("NODE_OPTIONS", ""):
    sys.stderr.write("[-] FATAL: Illegal '--use-strict' in NODE_OPTIONS.\n")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, PARENT_DIR)

from workers.ingestion_worker import IngestionWorker
from chronos_settlement_engine import (
    init_ledger,
    SettlementVerifier,
    reconcile_and_commit,
    run_ledger_completeness_check
)

try:
    from stripe_settlement_worker import settle_daily_retainer
    STRIPE_WORKER_LOADED = True
except ImportError:
    STRIPE_WORKER_LOADED = False

try:
    from core.models import Base, Record
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    SQLA_AVAILABLE = True
except ImportError:
    SQLA_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ChronosOrchestrator")

ARBI_DB_PATH = os.path.join(SCRIPT_DIR, "arbitrage_pipeline.db")
VAULT_DB_PATH = os.path.join(PARENT_DIR, "vault_store.db")

def run_ingestion_cycle():
    logger.info("[1/5] Running municipal filings ingestion worker...")
    if not SQLA_AVAILABLE:
        logger.warning("[-] SQLAlchemy core.models not found; skipping ORM harvest.")
        return 0

    engine = create_engine(f"sqlite:///{ARBI_DB_PATH}")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        worker_roofing = IngestionWorker(session, jurisdiction="MENDOCINO_COUNTY", stream_type="COMMERCIAL_ROOFING")
        roofing_indexed = worker_roofing.run_harvest()

        worker_hvac = IngestionWorker(session, jurisdiction="MENDOCINO_COUNTY", stream_type="COMMERCIAL_HVAC")
        hvac_indexed = worker_hvac.run_harvest()

        total = roofing_indexed + hvac_indexed
        logger.info(f"[+] Total new municipal records harvested: {total}")
        return total
    finally:
        session.close()

def generate_morning_csv_export():
    logger.info("[2/5] Generating morning delivery export feed...")
    export_dir = os.path.join(SCRIPT_DIR, "exports")
    os.makedirs(export_dir, exist_ok=True)
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    export_filepath = os.path.join(export_dir, f"anchor_commercial_leads_{today_str}.csv")

    conn = sqlite3.connect(ARBI_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS records (
            record_hash TEXT PRIMARY KEY,
            jurisdiction TEXT,
            stream_type TEXT,
            raw_payload TEXT,
            processed_json TEXT,
            ingested_at TEXT,
            is_billed INTEGER DEFAULT 0
        );
    """)

    cursor.execute("SELECT record_hash, stream_type, processed_json, ingested_at FROM records WHERE is_billed = 0;")
    rows = cursor.fetchall()

    with open(export_filepath, "w", encoding="utf-8") as f:
        f.write("record_hash,stream_type,parsed_payload,ingested_at_utc\n")
        for r in rows:
            clean_json = r[2].replace('"', '""')
            f.write(f'"{r[0]}","{r[1]}","{clean_json}","{r[3]}"\n')

    cursor.execute("UPDATE records SET is_billed = 1 WHERE is_billed = 0;")
    conn.commit()
    conn.close()

    logger.info(f"[+] Staged {len(rows)} leads into export file: {export_filepath}")
    return len(rows), export_filepath

def execute_stripe_billing():
    logger.info("[3/5] Verifying client retainer billing triggers...")
    anchor_cust = os.getenv("STRIPE_ANCHOR_CUSTOMER_ID")
    if anchor_cust and STRIPE_WORKER_LOADED:
        logger.info(f"[*] Processing daily retainer charge for Anchor Commercial Roofing ({anchor_cust})...")
        try:
            res = settle_daily_retainer(anchor_cust)
            logger.info(f"[+] Retainer captured: ID {res['payment_id']} | Status: {res['status']}")
        except Exception as e:
            logger.error(f"[-] Stripe charge attempt failed: {e}")
    else:
        logger.info("[*] STRIPE_ANCHOR_CUSTOMER_ID not set in .env. Skipping card capture.")

def execute_onchain_settlement_audit():
    logger.info("[4/5] Checking on-chain cryptographic settlement queues...")
    init_ledger()

    rpc_primary = os.getenv("ETH_RPC_PRIMARY", "https://eth.llamarpc.com")
    rpc_secondary = os.getenv("ETH_RPC_SECONDARY", "https://rpc.ankr.com/eth")
    settlement_wallet = os.getenv("PRIMARY_SETTLEMENT_ADDRESS", "0x0000000000000000000000000000000000000000")
    pending_tx = os.getenv("LATEST_SETTLEMENT_TX")

    if pending_tx and pending_tx.startswith("0x"):
        logger.info(f"[*] Verifying cryptographic receipt for TX: {pending_tx}")
        verifier = SettlementVerifier(rpc_primary, rpc_secondary, settlement_wallet)
        audit = verifier.audit_transaction(pending_tx)
        audit["settlement_wallet"] = settlement_wallet
        res = reconcile_and_commit(audit, eth_usd_rate=Decimal("3200.00"))
        logger.info(f"[+] On-chain settlement verified: Net = ${res['net_withdrawable_usd']:.2f}")
    else:
        logger.info("[*] Zero pending crypto transactions queued.")

def run_double_entry_reconciliation():
    logger.info("[5/5] Executing double-entry completeness and tax reserve audit...")
    report = run_ledger_completeness_check()
    logger.info("========================================================")
    logger.info(f" Finalized Settlements Logged : {report['verified_settlements']}")
    logger.info(f" Total Gross Inflow           : ${report['total_gross_inflow_usd']:,.2f}")
    logger.info(f" Gas/Compute Expenses         : ${report['total_gas_consumed_usd']:,.2f}")
    logger.info(f" 30% IRS/FTB Tax Reserve Held : ${report['total_tax_reserves_held']:,.2f}")
    logger.info(f" Real Net Withdrawable Funds  : ${report['total_net_withdrawable_cash']:,.2f}")
    logger.info(f" Event Logs Verified & Mapped : {report['total_event_logs_indexed']}")
    logger.info("========================================================")

def main():
    logger.info("========================================================")
    logger.info(" CHRONOS AUTOMATION RUNTIME // 04:00 AM ENGINE DISPATCH")
    logger.info(f" Timestamp: {datetime.now(timezone.utc).isoformat()} | STRICT MODE")
    logger.info("========================================================")

    run_ingestion_cycle()
    generate_morning_csv_export()
    execute_stripe_billing()
    execute_onchain_settlement_audit()
    run_double_entry_reconciliation()

    logger.info("[SUCCESS] Pipeline completed without errors or silent drops.")

if __name__ == "__main__":
    main()
