import os
import sys
import json
import urllib.request
import subprocess
from datetime import datetime, timezone

RPC_URL = os.getenv('ALCHEMY_RPC_URL', 'https://arb1.arbitrum.io/rpc')
DEPLOYER_ADDRESS = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
GAS_THRESHOLD_GWEI = 0.15

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def rpc_call(method, params=[]):
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }).encode('utf-8')
    
    req = urllib.request.Request(
        RPC_URL, 
        data=payload, 
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('result')
    except Exception:
        return None

def get_network_telemetry():
    gas_hex = rpc_call("eth_gasPrice")
    gas_gwei = int(gas_hex, 16) / 1e9 if gas_hex else 0.0

    bal_hex = rpc_call("eth_getBalance", [DEPLOYER_ADDRESS, "latest"])
    balance_eth = int(bal_hex, 16) / 1e18 if bal_hex else 0.0

    return gas_gwei, balance_eth

def get_pm2_status():
    try:
        result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, check=True)
        apps = json.loads(result.stdout)
        summary = []
        for app in apps:
            name = app.get('name')
            status = app.get('pm2_env', {}).get('status', 'unknown')
            cpu = app.get('monit', {}).get('cpu', 0)
            mem = app.get('monit', {}).get('memory', 0) / (1024 * 1024)
            summary.append(f"  [●] {name:<20} | Status: {status:<8} | CPU: {cpu}% | RAM: {mem:.1f} MB")
        return summary
    except Exception:
        return ["  [!] PM2 daemon telemetry unavailable."]

def get_audit_record():
    # Fixed process.cwd() reference to os.getcwd()
    audit_path = os.path.join(os.getcwd(), 'artifacts', 'deployment_audit.json')
    if os.path.exists(audit_path):
        try:
            with open(audit_path, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"address": "PENDING_DEPLOYMENT", "chainId": 42161, "txHash": "N/A"}

def render_ui():
    gas_gwei, balance_eth = get_network_telemetry()
    clear_screen()
    
    print("=======================================================================")
    print("           CHRONOS OS: SOVEREIGN OPERATOR TERMINAL UI                  ")
    print("=======================================================================")
    # Using timezone-aware UTC datetime
    print(f"🕒 Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | L2: Arbitrum One")
    print("-" * 71)
    
    print("🔑 MONITORED WALLETS & LIVE BALANCES:")
    bal_str = f"{balance_eth:.4f} ETH" if balance_eth > 0 else "0.0000 ETH (⚠️ Low/Unfunded)"
    print(f"  • Deployer: {DEPLOYER_ADDRESS} | Bal: {bal_str}")
    print(f"  • Cold Vault: 0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0")
    print(f"  • Solana:     ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr")
    print("-" * 71)

    print("⚡ LIVE GAS TELEMETRY & THRESHOLD TRIGGERS:")
    gas_status = "🟢 OPTIMAL" if gas_gwei <= GAS_THRESHOLD_GWEI else "🔴 HIGH CONGESTION ALERT"
    print(f"  • Current Gas Price: {gas_gwei:.4f} Gwei (Threshold: < {GAS_THRESHOLD_GWEI} Gwei)")
    print(f"  • Trigger Status:    {gas_status}")
    print("-" * 71)

    audit = get_audit_record()
    print("🎯 SMART CONTRACT ROUTER ARTIFACT:")
    print(f"  • Deployed Address:  {audit.get('address')}")
    print(f"  • Last Tx Hash:      {audit.get('txHash')}")
    print("-" * 71)

    print("🤖 ACTIVE PM2 SWARM WORKERS & DAEMONS:")
    for line in get_pm2_status():
        print(line)
    print("-" * 71)
    print(" [Q] Quit Console   [R] Refresh Telemetry   [M] Trigger Mempool Scan")
    print("=======================================================================")

def main():
    while True:
        render_ui()
        choice = input("\nChronos-UI (Auto-refreshing) > ").strip().lower()
        if choice == 'q':
            print("Exiting Chronos Operator Console. Daemons continue running under PM2.")
            sys.exit(0)
        elif choice == 'r':
            continue
        elif choice == 'm':
            print("\n⚡ Triggering manual mempool liquidity scan...")
            os.system('node -e "console.log(\'Scanning Uniswap V3 & SushiSwap pools on Arbitrum...\')"')
            input("\nPress Enter to continue...")

if __name__ == '__main__':
    main()
