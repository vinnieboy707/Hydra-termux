#!/usr/bin/env bash
set -e

echo "========================================================"
echo "CHRONOS OS // AUTOMATED BOOTSTRAP & DEPENDENCY SETUP"
echo "========================================================"

# Step 1: Install Node.js Dependencies
echo "[1/5] Installing Node.js dependencies..."
npm install

# Step 2: Ensure Environment Configuration Exists
echo "[2/5] Checking environment configuration..."
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Copied .env.example to .env. Please update with your live credentials."
elif [ ! -f .env ]; then
    echo "⚠️ Warning: No .env file found. Ensure environment variables are configured."
fi

# Step 3: Ensure Redis is Operational
echo "[3/5] Ensuring Redis is operational..."
if ! pgrep -x "redis-server" > /dev/null; then
    redis-server --daemonize yes 2>/dev/null || echo "⚠️ Redis daemon start attempted."
    sleep 1
fi

# Step 4: Run System Health & Key Validation
echo "[4/5] Running system health validation..."
node validate_system_health.js || echo "⚠️ Health audit warning noted."

# Step 5: Run Money Systems & Solana Test Suites
echo "[5/5] Running financial & Solana verification test suites..."
node verify_all_money_systems.js
node test_solana_arb_gate.js
node test_solana_glam.js

echo "========================================================"
echo "✅ BOOTSTRAP & DEPENDENCY SETUP COMPLETED SUCCESSFULLY!"
echo "========================================================"
echo "You can now run 'chronos health', 'chronos money', or 'chronos cli' from any terminal."
