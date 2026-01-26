#!/bin/bash

# ALHacking DDOS Attack (DDoS-Ripper)
# DDoS attack tool (Educational purposes only)

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
    cd "$TOOLS_DIR" || exit 1
    git clone https://github.com/palahsu/DDoS-Ripper.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone DDoS-Ripper"
        exit 1
    fi
fi

log_info "Launching DDoS-Ripper..."
cd "$TOOL_DIR" || exit 1
python3 DRipper.py
