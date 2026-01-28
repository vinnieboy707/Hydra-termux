#!/bin/bash

# ALHacking Info-Site
# Website information gathering tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/info-site"

print_banner "Info-Site"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Install dependencies
if ! command -v curl >/dev/null 2>&1; then
    log_info "Installing dependencies..."
    pkg install curl -y 2>/dev/null || apt-get install curl -y 2>/dev/null || true
fi

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing info-site... This may take a moment."
    cd "$TOOLS_DIR" || exit
    git clone https://github.com/king-hacking/info-site.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone info-site"
        exit 1
    fi
fi

log_info "Launching info-site..."
cd "$TOOL_DIR" || exit
bash info.sh
