#!/bin/bash

# ALHacking Requirements & Update Script
# Installs and updates dependencies for ALHacking tools

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

print_banner "ALHacking Requirements & Update"
echo ""

log_info "Installing and updating system packages..."
echo ""

# Update and install requirements
pkg install git -y 2>/dev/null || apt-get install git -y 2>/dev/null || true
pkg install python python3 -y 2>/dev/null || apt-get install python3 -y 2>/dev/null || true
pkg install pip pip3 -y 2>/dev/null || apt-get install python3-pip -y 2>/dev/null || true
pkg install curl -y 2>/dev/null || apt-get install curl -y 2>/dev/null || true

log_info "Updating package lists..."
if command -v pkg >/dev/null 2>&1; then
    pkg update -y
    pkg upgrade -y
elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get upgrade -y
fi

echo ""
log_success "Requirements installation and update completed!"
echo ""
