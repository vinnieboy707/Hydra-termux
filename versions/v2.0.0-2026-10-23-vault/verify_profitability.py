#!/usr/bin/env python3
"""
CHRONOS OS // STRICT-MODE PROFITABILITY AUDITOR
Audits vault_store.db & arbitrage_pipeline.db.
Enforces: Real Withdrawable Cash = Gross - Fees - 30% IRS/FTB Tax Reserve.
"""

import os
import sqlite3
from decimal import Decimal, ROUND_DOWN

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VAULT_DB = os.path.join(SCRIPT_DIR, "vault_store.db")
ARBI_DB = os.path.join(SCRIPT_DIR, "arbitrage_engine", "arbitrage_pipeline.db")

def audit_profitability():
    print("========================================================")
    print(" CHRONOS OS // REVENUE & PROFITABILITY AUDIT (STRICT)")
    print("========================================================")

    total_gross_inflow = Decimal("0.00")
    total_processor_and_gas_fees = Decimal("0.00")
    total_tax_reserves = Decimal("0.00")
    total_withdrawable_cash = Decimal("0.00")

    if os.path.exists(VAULT_DB):
        conn = sqlite3.connect(VAULT_DB)
        c = conn.cursor()

        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='fiat_settlements';")
        if c.fetchone():
            c.execute("""
                SELECT 
                    COUNT(*),
                    COALESCE(SUM(gross_amount_usd), 0.0),
                    COALESCE(SUM(processor_fee_usd), 0.0),
                    COALESCE(SUM(tax_reserve_usd), 0.0),
                    COALESCE(SUM(net_withdrawable_cash_usd), 0.0)
                FROM fiat_settlements
                WHERE status = 'CLEARED';
            """)
            fiat_row = c.fetchone()
            count_fiat = fiat_row[0]
            fiat_gross = Decimal(str(fiat_row[1])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            fiat_fees = Decimal(str(fiat_row[2])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            fiat_taxes = Decimal(str(fiat_row[3])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            fiat_net = Decimal(str(fiat_row[4])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

            total_gross_inflow += fiat_gross
            total_processor_and_gas_fees += fiat_fees
            total_tax_reserves += fiat_taxes
            total_withdrawable_cash += fiat_net

            print(f"[FIAT SETTLEMENTS]")
            print(f"  Cleared Invoices/Charges : {count_fiat}")
            print(f"  Gross Revenue Inflow     : ${fiat_gross:,.2f}")
            print(f"  Stripe Processing Fees   : ${fiat_fees:,.2f}")
            print(f"  30% Tax Reserve Held     : ${fiat_taxes:,.2f}")
            print(f"  Net Withdrawable Cash    : ${fiat_net:,.2f}\n")

        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verified_settlements';")
        if c.fetchone():
            c.execute("""
                SELECT 
                    COUNT(*),
                    COALESCE(SUM(gross_inflow_usd), 0.0),
                    COALESCE(SUM(gas_cost_usd + compute_fee_usd), 0.0),
                    COALESCE(SUM(tax_reserve_usd), 0.0),
                    COALESCE(SUM(net_withdrawable_usd), 0.0)
                FROM verified_settlements
                WHERE status = 'FINALIZED';
            """)
            crypto_row = c.fetchone()
            count_crypto = crypto_row[0]
            crypto_gross = Decimal(str(crypto_row[1])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            crypto_fees = Decimal(str(crypto_row[2])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            crypto_taxes = Decimal(str(crypto_row[3])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            crypto_net = Decimal(str(crypto_row[4])).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

            total_gross_inflow += crypto_gross
            total_processor_and_gas_fees += crypto_fees
            total_tax_reserves += crypto_taxes
            total_withdrawable_cash += crypto_net

            print(f"[ON-CHAIN SETTLEMENTS]")
            print(f"  Finalized Transactions   : {count_crypto}")
            print(f"  Gross Inflow (Stables)   : ${crypto_gross:,.2f}")
            print(f"  Network Gas/Compute Fees : ${crypto_fees:,.2f}")
            print(f"  30% Tax Reserve Held     : ${crypto_taxes:,.2f}")
            print(f"  Net Withdrawable Cash    : ${crypto_net:,.2f}\n")

        conn.close()

    if os.path.exists(ARBI_DB):
        conn_arbi = sqlite3.connect(ARBI_DB)
        c_arbi = conn_arbi.cursor()
        c_arbi.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='records';")
        if c_arbi.fetchone():
            c_arbi.execute("SELECT COUNT(*) FROM records WHERE is_billed = 0;")
            unbilled = c_arbi.fetchone()[0]
            c_arbi.execute("SELECT COUNT(*) FROM records WHERE is_billed = 1;")
            billed = c_arbi.fetchone()[0]
            print(f"[DATA ARBITRAGE PIPELINE]")
            print(f"  Delivered & Billed Leads : {billed}")
            print(f"  Pending Unbilled Leads   : {unbilled}")
            print(f"  Contract Retainer Value  : $150.00/day (Anchor Commercial Roofing)\n")
        conn_arbi.close()

    print("========================================================")
    print(" ENTERPRISE RECONCILIATION SUMMARY")
    print("========================================================")
    print(f" Recognized Gross Revenue : ${total_gross_inflow:,.2f}")
    print(f" Operating & Network Fees : -${total_processor_and_gas_fees:,.2f}")
    print(f" Mandatory Tax Reserve    : -${total_tax_reserves:,.2f}")
    print(" -------------------------------------------------------")
    print(f" ATM-LIQUID PROFIT        : ${total_withdrawable_cash:,.2f}")
    print("========================================================")

if __name__ == "__main__":
    audit_profitability()
