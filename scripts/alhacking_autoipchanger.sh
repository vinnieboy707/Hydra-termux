#!/bin/bash

# ALHacking AUTO-IP-CHANGER
# Automatic Tor IP changer

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/Auto_Tor_IP_changer"

print_banner "AUTO-IP-CHANGER"
echo ""
log_warning "⚠️  This tool requires ROOT access and Tor!"
echo ""

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Install dependencies
if ! command -v tor >/dev/null 2>&1; then
    log_info "Installing Tor..."
    pkg install tor -y 2>/dev/null || apt-get install tor -y 2>/dev/null || true
fi

if ! command -v pip3 >/dev/null 2>&1; then
    log_info "Installing pip3..."
    pkg install python3 -y 2>/dev/null || apt-get install python3-pip -y 2>/dev/null || true
fi

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing Auto_Tor_IP_changer... This may take a moment."
    cd "$TOOLS_DIR"
    
    # Install Python dependencies
    pip3 install requests 2>/dev/null || true
    
    git clone https://github.com/FDX100/Auto_Tor_IP_changer.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone Auto_Tor_IP_changer"
        exit 1
    fi
    
    cd "$TOOL_DIR"
    log_info "Running installer..."
    python3 install.py 2>/dev/null || true
fi

log_info "Important: Configure your browser's proxy to 127.0.0.1:9050 (SOCKS proxy)"
echo ""
sleep 3

log_info "Launching Auto IP Changer..."
cd "$TOOL_DIR"
# Try multiple possible commands
if [ -f "Auto_IP_changer.py" ]; then
    python3 Auto_IP_changer.py 2>/dev/null
elif command -v aut >/dev/null 2>&1; then
    aut 2>/dev/null
else
    log_warning "Could not find Auto_IP_changer executable. Try running python3 Auto_IP_changer.py manually."
fi
