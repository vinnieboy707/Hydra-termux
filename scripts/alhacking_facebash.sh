#!/bin/bash

# ALHacking Facebash
# Facebook brute force tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/facebash"

print_banner "Facebash"
echo ""
log_warning "⚠️  Use this tool responsibly and only on accounts you own!"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing Facebash... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/fu8uk1/facebash
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone Facebash"
        exit 1
    fi
    
    cd "$TOOL_DIR" || exit
    log_info "Running installer..."
    bash install.sh 2>/dev/null || true
    chmod +x facebash.sh 2>/dev/null || true
fi

log_info "Launching Facebash..."
cd "$TOOL_DIR" || exit
./facebash.sh
