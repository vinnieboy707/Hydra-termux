#!/bin/bash

# ALHacking WebCam Hack (CamPhish)
# Camera phishing tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/CamPhish"

print_banner "WebCam Hack (CamPhish)"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing CamPhish... This may take a moment."
    cd "$TOOLS_DIR" || exit 1
    git clone https://github.com/techchipnet/CamPhish
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone CamPhish"
        exit 1
    fi
fi

log_info "Launching CamPhish..."
cd "$TOOL_DIR" || exit 1
bash camphish.sh
