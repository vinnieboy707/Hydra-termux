#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="/data/data/com.termux/files/home/chronos-infrastructure-core"
cd "$ROOT_DIR"

# 1. Update .env with real custody addresses and production RPCs
touch .env

# Remove old placeholders if present
sed -i '/PRIMARY_SETTLEMENT_ADDRESS/d' .env
sed -i '/SOLANA_WALLET_PUBKEY/d' .env
sed -i '/ETH_RPC_PRIMARY/d' .env
sed -i '/ETH_RPC_SECONDARY/d' .env

# Write exact production keys
cat << 'ENV_EOF' >> .env
PRIMARY_SETTLEMENT_ADDRESS="0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0"
SOLANA_WALLET_PUBKEY="ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr"
ETH_RPC_PRIMARY="https://rpc.ankr.com/eth"
ETH_RPC_SECONDARY="https://ethereum-rpc.publicnode.com"
SOLANA_RPC_PRIMARY="https://api.mainnet-beta.solana.com"
SOL_USD_PRICE="175.00"
ENV_EOF

export PRIMARY_SETTLEMENT_ADDRESS="0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0"
export SOLANA_WALLET_PUBKEY="ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr"
export ETH_RPC_PRIMARY="https://rpc.ankr.com/eth"
export ETH_RPC_SECONDARY="https://ethereum-rpc.publicnode.com"

echo "========================================================"
echo "✅ WALLET KEYS ANCHORED INTO CHRONOS OS"
echo "   EVM    : $PRIMARY_SETTLEMENT_ADDRESS"
echo "   SOLANA : $SOLANA_WALLET_PUBKEY"
echo "========================================================"

# 2. Run Live Multi-Chain Gas & Balance Audit
python3 audit_wallets_gas.py

# 3. Run Solana Capital Allocator with Live Wallet
python3 solana_capital_allocator.py

# 4. Run the Master Production Dispatcher
c-execute
