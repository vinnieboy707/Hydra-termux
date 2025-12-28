#!/bin/bash
# Web Admin Quick Attack - Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="example.com"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting Web Admin Attack on $TARGET..."
echo "📝 Auto-detecting admin panels"
echo "🔍 Checking: /admin, /login, /wp-admin, /administrator"
echo ""
bash scripts/web_admin_attack.sh -t "$TARGET" -s -v
