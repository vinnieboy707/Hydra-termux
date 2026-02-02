#!/bin/bash

# ALHacking Subscan
# Subdomain scanner

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
TOOL_DIR="$TOOLS_DIR/subscan"

print_banner "Subscan - Subdomain Scanner"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing subscan... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/zidansec/subscan
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone subscan"
        exit 1
    fi
fi

echo ""
read -p "Enter domain (e.g., example.com): " domain

if [ -z "$domain" ]; then
    log_error "Domain is required"
    exit 1
fi

log_info "Scanning subdomains for $domain..."
cd "$TOOL_DIR" || exit
./subscan "$domain"
