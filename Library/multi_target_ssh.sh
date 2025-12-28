#!/bin/bash

# Multi-Target SSH Attack Wrapper
# Super simple script for attacking multiple targets with VPN protection

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION - EDIT THIS SECTION ONLY
# ═══════════════════════════════════════════════════════════════════

# TARGET OPTIONS (Choose ONE):
# Option 1: Single IP
TARGET="192.168.1.100"

# Option 2: CIDR Range (uncomment to use)
# TARGET="192.168.1.0/24"         # Scans 254 hosts
# TARGET="10.0.0.0/16"             # Scans 65,534 hosts

# Option 3: Target list file (uncomment to use)
# TARGET="targets.txt"             # One IP per line

# OPTIONAL SETTINGS
PORT=22                             # SSH port
THREADS=16                          # Parallel connections
TIMEOUT=30                          # Connection timeout (seconds)

# ═══════════════════════════════════════════════════════════════════
# DO NOT EDIT BELOW THIS LINE
# ═══════════════════════════════════════════════════════════════════

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Banner
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}     Multi-Target SSH Attack - Quick Launch${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Execute the attack
bash "$PROJECT_ROOT/scripts/ssh_admin_attack.sh" \
    -t "$TARGET" \
    -p "$PORT" \
    -T "$THREADS" \
    -o "$TIMEOUT" \
    -v

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Attack complete! Check logs for results.${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
