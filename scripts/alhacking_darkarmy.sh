#!/bin/bash

# ALHacking DARKARMY
# Multi-purpose hacking tool

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
TOOL_DIR="$TOOLS_DIR/DARKARMY"

print_banner "DARKARMY"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Install dependencies
if ! command -v python2 >/dev/null 2>&1; then
    log_info "Installing Python 2..."
    pkg install python2 -y 2>/dev/null || apt-get install python2 -y 2>/dev/null || true
fi

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing DARKARMY... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/D4RK-4RMY/DARKARMY
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone DARKARMY"
        exit 1
    fi
    
    cd "$TOOL_DIR" || exit
    chmod +x darkarmy.py 2>/dev/null || true
fi

log_info "Launching DARKARMY..."
cd "$TOOL_DIR" || exit
log_warning "⚠️  Note: This tool uses Python 2 (deprecated and unmaintained)"
log_warning "Security updates are no longer available for Python 2"
echo ""
python2 darkarmy.py 2>/dev/null || python darkarmy.py
