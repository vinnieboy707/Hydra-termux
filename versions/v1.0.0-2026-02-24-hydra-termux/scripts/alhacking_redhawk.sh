#!/bin/bash

# ALHacking RED_HAWK
# Information gathering tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/RED_HAWK"

print_banner "RED_HAWK"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing RED_HAWK... This may take a moment."
    cd "$TOOLS_DIR" || exit 1
    if ! git clone https://github.com/Tuhinshubhra/RED_HAWK; then
        log_error "Failed to clone RED_HAWK"
        exit 1
    fi
fi

log_info "Launching RED_HAWK..."
cd "$TOOL_DIR" || exit 1
php rhawk.php
