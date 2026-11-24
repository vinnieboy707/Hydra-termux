#!/usr/bin/env python3
"""
CHRONOS OS // STRIPE REVENUE DISPATCHER & FIAT SETTLEMENT WORKER
Processes commercial lead retainers, validates processor fees, and locks 30% tax reserves.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
VAULT_DB_PATH = os.path.join(PARENT_DIR, "vault_store.db")

def init_stripe_ledger():
    conn = sqlite3.connect(VAULT_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fiat_settlements (
            payment_id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            gross_amount_usd REAL NOT NULL,
            processor_fee_usd REAL NOT NULL,
            net_operating_revenue_usd REAL NOT NULL,
            tax_reserve_usd REAL NOT NULL,
            net_withdrawable_cash_usd REAL NOT NULL,
            currency TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('CLEARED', 'HELD', 'FAILED')),
            settled_at_utc TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()

def stripe_api_request(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        raise ValueError("Missing STRIPE_SECRET_KEY in production environment.")

    url = f"https://api.stripe.com/v1/{endpoint.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "User-Agent": "ChronosEngine/1.0"
    }

    encoded_data = None
    if data:
        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        raise RuntimeError(f"Stripe API HTTP {e.code}: {error_body}")
    except Exception as e:
        raise RuntimeError(f"Stripe Connection Failure: {str(e)}")

def settle_daily_retainer(customer_id: str, client_name: str = "Anchor Commercial Roofing", amount_cents: int = 15000):
    init_stripe_ledger()
    gross_usd = Decimal(amount_cents) / Decimal(100)
    processor_fee_usd = (gross_usd * Decimal("0.029") + Decimal("0.30")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    net_operating_revenue = gross_usd - processor_fee_usd

    tax_reserve_usd = (net_operating_revenue * Decimal("0.30")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    net_withdrawable_cash = (net_operating_revenue - tax_reserve_usd).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

    payment_payload = {
        "amount": str(amount_cents),
        "currency": "usd",
        "customer": customer_id,
        "description": f"Daily Municipal Building Permit Lead Retainer: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "confirm": "true",
        "off_session": "true"
    }

    try:
        charge_resp = stripe_api_request("payment_intents", method="POST", data=payment_payload)
        payment_id = charge_resp.get("id")
        charge_status = charge_resp.get("status")
        status_verdict = "CLEARED" if charge_status == "succeeded" else "HELD"

        conn = sqlite3.connect(VAULT_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO fiat_settlements (
                payment_id, customer_name, gross_amount_usd, processor_fee_usd,
                net_operating_revenue_usd, tax_reserve_usd, net_withdrawable_cash_usd,
                currency, status, settled_at_utc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            payment_id,
            client_name,
            float(gross_usd),
            float(processor_fee_usd),
            float(net_operating_revenue),
            float(tax_reserve_usd),
            float(net_withdrawable_cash),
            "usd",
            status_verdict,
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
        conn.close()

        return {
            "payment_id": payment_id,
            "status": status_verdict,
            "gross_amount_usd": float(gross_usd),
            "processor_fee_usd": float(processor_fee_usd),
            "tax_reserve_usd": float(tax_reserve_usd),
            "net_withdrawable_cash_usd": float(net_withdrawable_cash)
        }
    except Exception as e:
        sys.stderr.write(f"[-] Stripe charge failure: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    cust_id = os.getenv("STRIPE_ANCHOR_CUSTOMER_ID")
    if not cust_id:
        print("[-] STRIPE_ANCHOR_CUSTOMER_ID is not configured in .env.")
        sys.exit(0)
    result = settle_daily_retainer(cust_id)
    print(f"[+] Succeeded: {json.dumps(result, indent=2)}")
