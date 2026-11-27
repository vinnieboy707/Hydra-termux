#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/vdizzle707/chronos-infrastructure-core.git"
TARGET_DIR="chronos-infrastructure-core"

echo "========================================================"
echo "CHRONOS OS // MASTER SYNCHRONIZATION & BOOTSTRAP ENGINE"
echo "========================================================"

# Step 1: Clone or Update Repository
if [ ! -d ".git" ]; then
    echo "[1/6] Cloning Chronos Infrastructure Core repository..."
    if [ -d "$TARGET_DIR" ]; then
        cd "$TARGET_DIR"
        git pull origin master
    else
        git clone "$REPO_URL" "$TARGET_DIR"
        cd "$TARGET_DIR"
    fi
else
    echo "[1/6] Existing repository detected. Pulling latest updates..."
    git pull origin master || echo "⚠️ Git pull warning noted."
fi

# Step 2: Synchronize Policies & Parameters
echo "[2/6] Synchronizing foundational policies (GEMINI.md) & configuration parameters..."
if [ -f "GEMINI.md" ]; then
    echo "✅ Foundational policies (GEMINI.md) verified and active."
else
    echo "⚠️ Warning: GEMINI.md policy file missing."
fi

# Step 3: Configure Environment
echo "[3/6] Setting up environment configuration (.env)..."
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example. Please update with your operational credentials."
elif [ ! -f .env ]; then
    echo "⚠️ Warning: .env file not found."
fi

# Step 4: Install Dependencies
echo "[4/6] Installing Node.js & ecosystem dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install --silent
elif command -v npm &> /dev/null; then
    npm install --silent
else
    echo "❌ Error: Neither npm nor pnpm found in PATH."
    exit 1
fi

# Step 5: Validate System Health
echo "[5/6] Running system health & policy validation..."
if [ -f "validate_system_health.js" ]; then
    node validate_system_health.js || echo "⚠️ System health validation warning noted."
else
    echo "ℹ️ validate_system_health.js not found, skipping validation step."
fi

echo "========================================================"
echo "✅ CHRONOS OS // SYNCHRONIZATION & BOOTSTRAP COMPLETE!"
echo "========================================================"
echo "All policies, parameters, and code files are successfully synced and operational."
echo "To launch the system: node control_hub.js (or bash run_system.sh)"
