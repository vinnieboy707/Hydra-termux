#!/bin/bash
# Network Range Attack - Attacks entire subnet!
# Just replace TARGET with your network range and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.0/24"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting NETWORK RANGE ATTACK on $TARGET..."
echo "⚠️  Warning: This will scan and attack the entire network!"
echo "🔍 Scanning network range..."
echo "💥 Attacking all discovered hosts..."
echo "📊 Generating comprehensive report..."
echo ""
bash scripts/admin_auto_attack.sh -t "$TARGET" -s full -r -v
echo ""
echo "✅ Network attack complete! Check results/"
