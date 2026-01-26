#!/bin/bash

# ALHacking dorks-eye
# Google dork scanner

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/dorks-eye"

print_banner "dorks-eye"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing dorks-eye... This may take a moment."
    cd "$TOOLS_DIR" || exit 1
    git clone https://github.com/BullsEye0/dorks-eye.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone dorks-eye"
        exit 1
    fi
    
    cd "$TOOL_DIR" || exit 1
    log_info "Installing Python dependencies..."
    pip install -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt 2>/dev/null || true
fi

log_info "Launching dorks-eye..."
cd "$TOOL_DIR" || exit 1
python3 dorks-eye.py
