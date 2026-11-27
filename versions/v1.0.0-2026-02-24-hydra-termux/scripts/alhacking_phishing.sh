#!/bin/bash

# ALHacking Phishing Tool (zphisher)
# Advanced phishing tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/zphisher"

print_banner "Phishing Tool (zphisher)"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing zphisher... This may take a moment."
    cd "$TOOLS_DIR" || exit 1
    if ! git clone https://github.com/htr-tech/zphisher; then
        log_error "Failed to clone zphisher"
        exit 1
    fi
fi

log_info "Launching zphisher..."
cd "$TOOL_DIR" || exit 1
bash zphisher.sh
