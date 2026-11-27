#!/usr/bin/env python3
"""
CHRONOS OS // ENTERPRISE ON-CHAIN SETTLEMENT & RECONCILIATION ENGINE
Strict-Mode Verification, Event Log Audit, and Real Withdrawable PnL
"""

import os
import sys
import json
import sqlite3
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VAULT_DB_PATH = os.path.join(SCRIPT_DIR, "vault_store.db")

STABLECOIN_REGISTRY = {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {"symbol": "USDC", "decimals": 6},
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {"symbol": "USDT", "decimals": 6},
    "0x6b175474e89094c44da98b954eedeac495271d0f": {"symbol": "DAI",  "decimals": 18}
}

ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

def init_ledger():
    conn = sqlite3.connect(VAULT_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA foreign_keys = ON;")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verified_settlements (
            tx_hash TEXT PRIMARY KEY,
            chain_id INTEGER NOT NULL,
            block_number INTEGER NOT NULL,
            settlement_wallet TEXT NOT NULL,
            token_symbol TEXT NOT NULL,
            gross_inflow_usd REAL NOT NULL,
            gas_cost_usd REAL NOT NULL,
            compute_fee_usd REAL NOT NULL,
            tax_reserve_usd REAL NOT NULL,
            net_withdrawable_usd REAL NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('CONFIRMED', 'FINALIZED', 'FAILED')),
            verified_at_utc TEXT NOT NULL
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS onchain_transfer_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_hash TEXT NOT NULL,
            log_index INTEGER NOT NULL,
            contract_address TEXT NOT NULL,
            from_address TEXT NOT NULL,
            to_address TEXT NOT NULL,
            raw_amount TEXT NOT NULL,
            normalized_amount REAL NOT NULL,
            FOREIGN KEY (tx_hash) REFERENCES verified_settlements(tx_hash)
        );
    """)
    conn.commit()
    conn.close()

def execute_rpc(rpc_url: str, method: str, params: list):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8")
    req = urllib.request.Request(rpc_url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "ChronosEngine/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode("utf-8"))
            if "error" in res:
                raise RuntimeError(f"RPC Error [{method}]: {res['error']}")
            return res.get("result")
    except Exception as e:
        raise RuntimeError(f"Network failure executing {method} on {rpc_url}: {str(e)}")

class SettlementVerifier:
    def __init__(self, primary_rpc: str, secondary_rpc: str, settlement_wallet: str):
        self.primary_rpc = primary_rpc
        self.secondary_rpc = secondary_rpc
        self.settlement_wallet = settlement_wallet.lower()

    def audit_transaction(self, tx_hash: str, min_confirmations: int = 12) -> dict:
        receipt_a = execute_rpc(self.primary_rpc, "eth_getTransactionReceipt", [tx_hash])
        receipt_b = execute_rpc(self.secondary_rpc, "eth_getTransactionReceipt", [tx_hash])

        if not receipt_a or not receipt_b:
            raise ValueError(f"Receipt missing on RPC providers for {tx_hash}")

        if int(receipt_a.get("status", "0x0"), 16) != 1 or int(receipt_b.get("status", "0x0"), 16) != 1:
            raise RuntimeError("Transaction execution reverted on-chain.")

        if receipt_a.get("blockHash") != receipt_b.get("blockHash"):
            raise RuntimeError("Consensus fork: blockHash mismatch.")

        block_number = int(receipt_a.get("blockNumber"), 16)
        latest_block = int(execute_rpc(self.primary_rpc, "eth_blockNumber", []), 16)
        confirmations = latest_block - block_number

        if confirmations < min_confirmations:
            raise RuntimeError(f"Insufficient confirmations: {confirmations} < {min_confirmations}")

        gas_used = Decimal(int(receipt_a.get("gasUsed"), 16))
        effective_gas_price = Decimal(int(receipt_a.get("effectiveGasPrice", "0x0"), 16))
        gas_cost_eth = (gas_used * effective_gas_price) / Decimal(10**18)

        logs = receipt_a.get("logs", [])
        verified_transfers = []
        total_inflow_usd = Decimal("0.00")
        detected_symbol = "NONE"

        for idx, log in enumerate(logs):
            topics = log.get("topics", [])
            contract = log.get("address", "").lower()

            if len(topics) == 3 and topics[0].lower() == ERC20_TRANSFER_TOPIC:
                to_addr = "0x" + topics[2][-40:].lower()
                from_addr = "0x" + topics[1][-40:].lower()
                raw_data = int(log.get("data", "0x0"), 16)

                if contract in STABLECOIN_REGISTRY:
                    meta = STABLECOIN_REGISTRY[contract]
                    normalized = Decimal(raw_data) / Decimal(10 ** meta["decimals"])

                    verified_transfers.append({
                        "log_index": idx,
                        "contract": contract,
                        "from": from_addr,
                        "to": to_addr,
                        "raw": str(raw_data),
                        "normalized": float(normalized),
                        "symbol": meta["symbol"]
                    })

                    if to_addr == self.settlement_wallet:
                        total_inflow_usd += normalized
                        detected_symbol = meta["symbol"]

        return {
            "tx_hash": tx_hash,
            "block_number": block_number,
            "confirmations": confirmations,
            "gas_cost_eth": gas_cost_eth,
            "transfers": verified_transfers,
            "gross_inflow_usd": total_inflow_usd,
            "detected_symbol": detected_symbol
        }

def reconcile_and_commit(audit_data: dict, eth_usd_rate: Decimal, compute_fee_usd: Decimal = Decimal("0.00")):
    gross_usd = audit_data["gross_inflow_usd"]
    gas_usd = (audit_data["gas_cost_eth"] * eth_usd_rate).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

    operating_expenses = gas_usd + compute_fee_usd
    if gross_usd <= operating_expenses:
        net_withdrawable_usd = Decimal("0.00")
        tax_reserve_usd = Decimal("0.00")
        status = "FAILED"
    else:
        operating_profit = gross_usd - operating_expenses
        tax_reserve_usd = (operating_profit * Decimal("0.30")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
        net_withdrawable_usd = (operating_profit - tax_reserve_usd).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
        status = "FINALIZED"

    conn = sqlite3.connect(VAULT_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO verified_settlements (
            tx_hash, chain_id, block_number, settlement_wallet, token_symbol,
            gross_inflow_usd, gas_cost_usd, compute_fee_usd, tax_reserve_usd,
            net_withdrawable_usd, status, verified_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        audit_data["tx_hash"],
        1,
        audit_data["block_number"],
        audit_data.get("settlement_wallet", "0xCustody"),
        audit_data["detected_symbol"],
        float(gross_usd),
        float(gas_usd),
        float(compute_fee_usd),
        float(tax_reserve_usd),
        float(net_withdrawable_usd),
        status,
        datetime.now(timezone.utc).isoformat()
    ))

    for log in audit_data["transfers"]:
        cursor.execute("""
            INSERT INTO onchain_transfer_logs (
                tx_hash, log_index, contract_address, from_address, to_address, raw_amount, normalized_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            audit_data["tx_hash"],
            log["log_index"],
            log["contract"],
            log["from"],
            log["to"],
            log["raw"],
            log["normalized"]
        ))

    conn.commit()
    conn.close()

    return {
        "status": status,
        "gross_usd": float(gross_usd),
        "gas_cost_usd": float(gas_usd),
        "tax_reserve_usd": float(tax_reserve_usd),
        "net_withdrawable_usd": float(net_withdrawable_usd)
    }

def run_ledger_completeness_check():
    conn = sqlite3.connect(VAULT_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            COUNT(DISTINCT s.tx_hash) AS verified_tx_count,
            COALESCE(SUM(s.gross_inflow_usd), 0.0) AS total_gross_usd,
            COALESCE(SUM(s.gas_cost_usd), 0.0) AS total_gas_usd,
            COALESCE(SUM(s.tax_reserve_usd), 0.0) AS total_tax_reserves,
            COALESCE(SUM(s.net_withdrawable_usd), 0.0) AS total_withdrawable_usd,
            COUNT(l.id) AS total_logged_transfers
        FROM verified_settlements s
        LEFT JOIN onchain_transfer_logs l ON s.tx_hash = l.tx_hash
        WHERE s.status = 'FINALIZED';
    """)
    row = cursor.fetchone()
    conn.close()

    return {
        "verified_settlements": row[0],
        "total_gross_inflow_usd": round(row[1], 2),
        "total_gas_consumed_usd": round(row[2], 2),
        "total_tax_reserves_held": round(row[3], 2),
        "total_net_withdrawable_cash": round(row[4], 2),
        "total_event_logs_indexed": row[5]
    }

if __name__ == "__main__":
    init_ledger()
    report = run_ledger_completeness_check()
    print(json.dumps(report, indent=2))
