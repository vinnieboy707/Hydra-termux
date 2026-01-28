#!/bin/bash

# ALHacking BadMod
# Instagram brute force tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/BadMod"

print_banner "BadMod"
echo ""
log_warning "⚠️  Use this tool responsibly and only on accounts you own!"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Install dependencies
if ! command -v php >/dev/null 2>&1; then
    log_info "Installing PHP..."
    pkg install php -y 2>/dev/null || apt-get install php php-curl -y 2>/dev/null || true
fi

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing BadMod... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/MrSqar-Ye/BadMod.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone BadMod"
        exit 1
    fi
    
    cd "$TOOL_DIR" || exit
    chmod u+x INSTALL 2>/dev/null || true
    chmod u+x BadMod.php 2>/dev/null || true
fi

log_info "Launching BadMod..."
cd "$TOOL_DIR" || exit
php BadMod.php
