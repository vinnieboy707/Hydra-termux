#!/bin/bash
# Full Auto Attack - Scans and attacks all services!
# Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting FULL AUTO ATTACK on $TARGET..."
echo "🔍 Step 1: Scanning for open ports..."
echo "🎯 Step 2: Identifying services..."
echo "💥 Step 3: Attacking all found services..."
echo "📊 Step 4: Generating HTML report..."
echo ""
bash scripts/admin_auto_attack.sh -t "$TARGET" -s fast -r -v
echo ""
echo "✅ Attack complete! Check results/"
