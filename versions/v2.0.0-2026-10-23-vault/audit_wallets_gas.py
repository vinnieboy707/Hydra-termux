#!/usr/bin/env python3
"""
CHRONOS OS // MULTI-WALLET GAS & NATIVE BALANCE AUDITOR
Scans EVM (Ethereum/Base/Arbitrum) and Solana wallets for native gas reserves.
"""

import os
import json
import urllib.request
from decimal import Decimal, ROUND_DOWN

# RPC Endpoints with High-Reliability Public Gateways
RPC_ENDPOINTS = {
    "ETH_MAINNET": os.getenv("ETH_RPC_PRIMARY", "https://cloudflare-eth.com"),
    "SOLANA_MAINNET": os.getenv("SOLANA_RPC_PRIMARY", "https://api.mainnet-beta.solana.com"),
    "BASE": "https://mainnet.base.org",
    "ARBITRUM": "https://arb1.arbitrum.io/rpc"
}

def rpc_call(url: str, method: str, params: list):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        if "error" in res:
            raise RuntimeError(res["error"])
        return res["result"]

def check_evm_gas(address: str, chain: str, rpc_url: str):
    try:
        bal_hex = rpc_call(rpc_url, "eth_getBalance", [address, "latest"])
        gas_price_hex = rpc_call(rpc_url, "eth_gasPrice", [])
        
        balance_wei = int(bal_hex, 16)
        gas_price_wei = int(gas_price_hex, 16)
        
        balance_eth = Decimal(balance_wei) / Decimal(10**18)
        gas_price_gwei = Decimal(gas_price_wei) / Decimal(10**9)
        
        # Standard transfer requires 21k gas; DEX contract call requires ~200k gas
        transfers_possible = balance_wei // (21000 * gas_price_wei) if gas_price_wei > 0 else 0
        dex_swaps_possible = balance_wei // (200000 * gas_price_wei) if gas_price_wei > 0 else 0
        
        return {
            "chain": chain,
            "address": address,
            "balance": f"{balance_eth:.6f} ETH",
            "gas_price": f"{gas_price_gwei:.4f} Gwei",
            "transfers_headroom": transfers_possible,
            "swaps_headroom": dex_swaps_possible,
            "status": "OPERATIONAL" if transfers_possible > 5 else "LOW_GAS"
        }
    except Exception as e:
        return {"chain": chain, "address": address, "error": str(e), "status": "RPC_ERROR"}

def check_solana_gas(pubkey: str):
    try:
        res = rpc_call(RPC_ENDPOINTS["SOLANA_MAINNET"], "getBalance", [pubkey])
        lamports = res.get("value", 0)
        sol_bal = Decimal(lamports) / Decimal(10**9)
        
        # Standard transaction = 5,000 lamports
        txs_possible = lamports // 5000
        
        return {
            "chain": "SOLANA",
            "address": pubkey,
            "balance": f"{sol_bal:.6f} SOL",
            "gas_price": "5000 Lamports",
            "transfers_headroom": txs_possible,
            "status": "OPERATIONAL" if sol_bal >= Decimal("0.05") else "LOW_GAS"
        }
    except Exception as e:
        return {"chain": "SOLANA", "address": pubkey, "error": str(e), "status": "RPC_ERROR"}

def main():
    print("========================================================")
    print("🔍 CHRONOS OS // LIVE WALLET GAS INVENTORY AUDIT")
    print("========================================================")

    # Gather registered custody addresses
    evm_addresses = set()
    sol_addresses = set()

    # Read from .env if present
    env_path = os.path.expanduser("~/chronos-infrastructure-core/.env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("PRIMARY_SETTLEMENT_ADDRESS="):
                    addr = line.strip().split("=")[1].strip('"').strip("'")
                    if addr.startswith("0x"): evm_addresses.add(addr)
                elif line.startswith("SOLANA_WALLET_PUBKEY="):
                    addr = line.strip().split("=")[1].strip('"').strip("'")
                    if len(addr) >= 32 and not addr.startswith("0x"): sol_addresses.add(addr)

    # Check fallback/default addresses if empty
    if not evm_addresses:
        evm_addresses.add("0x0000000000000000000000000000000000000000")
    if not sol_addresses:
        sol_addresses.add("11111111111111111111111111111111")

    print(f"[*] Auditing {len(evm_addresses)} EVM Address(es) across Mainnet, Base, Arbitrum...")
    for addr in evm_addresses:
        print(f"\n--- EVM WALLET: {addr} ---")
        for chain_key in ["ETH_MAINNET", "BASE", "ARBITRUM"]:
            res = check_evm_gas(addr, chain_key, RPC_ENDPOINTS[chain_key])
            if "error" in res:
                print(f"  [{res['chain']}] Error: {res['error']}")
            else:
                print(f"  [{res['chain']}] Balance: {res['balance']} | Gas: {res['gas_price']} | Standard Txs: {res['transfers_headroom']:,} | Swaps: {res['swaps_headroom']:,} [{res['status']}]")

    print(f"\n[*] Auditing {len(sol_addresses)} Solana Address(es)...")
    for addr in sol_addresses:
        res = check_solana_gas(addr)
        print(f"\n--- SOLANA WALLET: {addr} ---")
        if "error" in res:
            print(f"  Error: {res['error']}")
        else:
            print(f"  Balance: {res['balance']} | Txs Headroom: {res['transfers_headroom']:,} [{res['status']}]")

    print("\n========================================================")
    print(" GAS HEALTH AUDIT COMPLETE")
    print("========================================================")

if __name__ == "__main__":
    main()
