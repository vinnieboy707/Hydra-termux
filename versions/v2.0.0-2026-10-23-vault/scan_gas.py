#!/usr/bin/env python3
"""
CHRONOS OS // LIVE ETHEREUM GAS TELEMETRY
Failover RPC Engine: Queries standard endpoints to avoid 525 handshake errors.
"""

import json
import urllib.request
import urllib.error
from decimal import Decimal

RPC_POOL = [
    "https://cloudflare-eth.com",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com"
]

def rpc_post(url: str, method: str, params: list):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        if "error" in data:
            raise RuntimeError(data["error"])
        return data["result"]

def fetch_gas_metrics():
    last_err = None
    for endpoint in RPC_POOL:
        try:
            gas_price_hex = rpc_post(endpoint, "eth_gasPrice", [])
            block_hex = rpc_post(endpoint, "eth_getBlockByNumber", ["latest", False])

            gas_price_wei = int(gas_price_hex, 16)
            base_fee_wei = int(block_hex.get("baseFeePerGas", gas_price_hex), 16)

            gas_price_gwei = Decimal(gas_price_wei) / Decimal(10**9)
            base_gwei = Decimal(base_fee_wei) / Decimal(10**9)

            print("========================================================")
            print("⛽ LIVE ETHEREUM MAINNET GAS TELEMETRY")
            print("========================================================")
            print(f" Connected RPC      : {endpoint}")
            print(f" Base Fee           : {base_gwei:.4f} Gwei")
            print(f" Effective GasPrice : {gas_price_gwei:.4f} Gwei")
            print("--------------------------------------------------------")
            print(f" Standard Send (21k) : ~${(Decimal(21000) * gas_price_wei * Decimal(3200) / Decimal(10**18)):.4f} USD")
            print(f" Uniswap Swap (~185k): ~${(Decimal(185000) * gas_price_wei * Decimal(3200) / Decimal(10**18)):.4f} USD")
            print(f" 2-Hop Flash Arb     : ~${(Decimal(280000) * gas_price_wei * Decimal(3200) / Decimal(10**18)):.4f} USD")
            print("========================================================")
            return
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All RPC endpoints failed. Last error: {last_err}")

if __name__ == "__main__":
    fetch_gas_metrics()
