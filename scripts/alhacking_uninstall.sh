#!/bin/bash

# ALHacking Uninstall Tools
# Removes all downloaded ALHacking tools

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"

print_banner "Uninstall ALHacking Tools"
echo ""

if [ ! -d "$TOOLS_DIR" ]; then
    log_info "No tools directory found. Nothing to uninstall."
    exit 0
fi

log_warning "This will remove all downloaded ALHacking tools!"
echo ""
read -r -p "Are you sure you want to continue? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    log_info "Removing tools directory..."
    rm -rf "$TOOLS_DIR"
    log_success "All ALHacking tools have been removed!"
else
    log_info "Uninstall cancelled."
fi

echo ""
