#!/bin/bash

# ALHacking HackerPro
# All-in-one hacking tool

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/hackerpro"

print_banner "HackerPro"
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
    log_info "Installing HackerPro... This may take a moment."
    cd "$TOOLS_DIR"
    git clone https://github.com/jaykali/hackerpro.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone HackerPro"
        exit 1
    fi
    
    cd "$TOOL_DIR"
    log_info "Running installer..."
    bash install.sh 2>/dev/null || true
fi

log_info "Launching HackerPro..."
cd "$TOOL_DIR"
python2 hackerpro.py 2>/dev/null || python hackerpro.py
