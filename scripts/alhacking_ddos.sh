#!/bin/bash

# ALHacking DDOS Attack (DDoS-Ripper)
# DDoS attack tool (Educational purposes only)

# ⚠️  SECURITY WARNING ⚠️
# This script downloads and executes third-party code from an external GitHub repository
# without version pinning or integrity verification. This poses security risks:
# - The repository owner could push malicious updates
# - The repository could be compromised
# - Network traffic could be intercepted (man-in-the-middle attacks)
#
# RECOMMENDATIONS:
# 1. Review the third-party code before running this script
# 2. Consider pinning to a specific commit or tag
# 3. Use this tool only in isolated/sandboxed environments
# 4. Never run with elevated privileges unless absolutely necessary

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/DDoS-Ripper"

print_banner "DDOS Attack (DDoS-Ripper)"
echo ""
log_warning "⚠️  Use this tool responsibly! Hide your IP before using!"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing DDoS-Ripper... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/palahsu/DDoS-Ripper.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone DDoS-Ripper"
        exit 1
    fi
fi

log_info "Launching DDoS-Ripper..."
cd "$TOOL_DIR" || exit
python3 DRipper.py
