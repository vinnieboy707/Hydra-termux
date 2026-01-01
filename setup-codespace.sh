#!/bin/bash

# Hydra-Termux Codespace Setup Script
# Optimized for GitHub Codespaces environment
# This script automates the complete setup process for development in Codespaces

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC} $1"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}"
}

# Print banner
clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗  ██╗██╗   ██╗██████╗ ██████╗  █████╗                  ║
║   ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔══██╗                 ║
║   ███████║ ╚████╔╝ ██║  ██║██████╔╝███████║                 ║
║   ██╔══██║  ╚██╔╝  ██║  ██║██╔══██╗██╔══██║                 ║
║   ██║  ██║   ██║   ██████╔╝██║  ██║██║  ██║                 ║
║   ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝                 ║
║                                                               ║
║             GitHub Codespaces Setup                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
log_info "Starting Hydra-Termux Codespace setup..."
sleep 1

# Detect environment
log_section "Environment Detection"
if [ -n "$CODESPACES" ]; then
    log_success "GitHub Codespaces environment detected"
    CODESPACE_NAME="$CODESPACE_NAME"
else
    log_warning "Not running in Codespaces, but continuing setup..."
fi

# Update system packages
log_section "System Package Update"
log_info "Updating package lists..."
if sudo apt-get update -y > /dev/null 2>&1; then
    log_success "Package lists updated"
else
    log_warning "Package update had some issues, continuing..."
fi

# Install system dependencies
log_section "Installing System Dependencies"
PACKAGES=(
    "hydra"
    "nmap"
    "curl"
    "wget"
    "git"
    "jq"
    "figlet"
    "openssl"
    "netcat"
    "dnsutils"
)

log_info "Installing required packages..."
for package in "${PACKAGES[@]}"; do
    log_info "Installing: $package"
    if sudo apt-get install -y "$package" > /dev/null 2>&1; then
        log_success "$package installed"
    else
        log_warning "$package installation failed (may already be installed or unavailable)"
    fi
done

# Verify critical installations
log_section "Verifying Critical Dependencies"

# Check Hydra
if command -v hydra &> /dev/null; then
    HYDRA_VERSION=$(hydra -h 2>&1 | head -1 || echo "Hydra")
    log_success "Hydra: $HYDRA_VERSION"
else
    log_error "Hydra not found! This is critical for the tool to work."
    log_info "Attempting alternative installation method..."
    
    # Try to build from source
    if [ ! -d "/tmp/thc-hydra" ]; then
        log_info "Cloning THC-Hydra from source..."
        git clone https://github.com/vanhauser-thc/thc-hydra /tmp/thc-hydra || true
    fi
    
    if [ -d "/tmp/thc-hydra" ]; then
        log_info "Building Hydra from source..."
        cd /tmp/thc-hydra
        sudo apt-get install -y libssl-dev libssh-dev libidn11-dev libpcre3-dev \
             libgtk2.0-dev libmysqlclient-dev libpq-dev libsvn-dev \
             firebird-dev libmemcached-dev libgpg-error-dev \
             libgcrypt20-dev libgcrypt11-dev 2>/dev/null || true
        ./configure && make && sudo make install || log_warning "Source build failed"
        cd -
    fi
fi

# Check Node.js
if command -v node &> /dev/null; then
    log_success "Node.js: $(node --version)"
else
    log_error "Node.js not found!"
fi

# Check npm
if command -v npm &> /dev/null; then
    log_success "npm: $(npm --version)"
else
    log_error "npm not found!"
fi

# Check nmap
if command -v nmap &> /dev/null; then
    log_success "nmap: $(nmap --version | head -1)"
else
    log_warning "nmap not installed"
fi

# Check jq
if command -v jq &> /dev/null; then
    log_success "jq: $(jq --version)"
else
    log_warning "jq not installed (needed for JSON processing)"
fi

# Create directory structure
log_section "Creating Directory Structure"
DIRECTORIES=(
    "logs"
    "results"
    "wordlists"
    "config"
    "docs"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log_success "Created directory: $dir"
    else
        log_info "Directory already exists: $dir"
    fi
done

# Set script permissions
log_section "Setting Script Permissions"
log_info "Making scripts executable..."
chmod +x hydra.sh 2>/dev/null && log_success "hydra.sh is executable"
chmod +x install.sh 2>/dev/null && log_success "install.sh is executable"
chmod +x fix-hydra.sh 2>/dev/null && log_success "fix-hydra.sh is executable"
chmod +x scripts/*.sh 2>/dev/null && log_success "All scripts in scripts/ are executable"
chmod +x Library/*.sh 2>/dev/null && log_success "All quick scripts in Library/ are executable"

# Setup Full-Stack Application
log_section "Full-Stack Application Setup"

# Backend setup
if [ -d "fullstack-app/backend" ]; then
    log_info "Setting up backend..."
    cd fullstack-app/backend
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log_info "Installing backend dependencies..."
        npm install --silent || npm install
        log_success "Backend dependencies installed"
    else
        log_info "Backend dependencies already installed"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_info "Creating backend .env file..."
        cat > .env << 'ENV_EOF'
# Database Configuration
DB_TYPE=sqlite
DB_PATH=../database.sqlite

# Server Configuration
PORT=3000
NODE_ENV=development

# Security - JWT Secret (auto-generated)
JWT_SECRET=$(openssl rand -hex 32)

# Paths
SCRIPTS_PATH=../../scripts
LOGS_PATH=../../logs
CONFIG_PATH=../../config

# 2FA Configuration
TOTP_ISSUER=Hydra-Termux

# Development Settings
DEBUG=true
ENV_EOF
        log_success "Backend .env created"
    else
        log_info "Backend .env already exists"
    fi
    
    cd ../..
else
    log_warning "Backend directory not found"
fi

# Frontend setup
if [ -d "fullstack-app/frontend" ]; then
    log_info "Setting up frontend..."
    cd fullstack-app/frontend
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install --silent || npm install
        log_success "Frontend dependencies installed"
    else
        log_info "Frontend dependencies already installed"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_info "Creating frontend .env file..."
        echo "PORT=3001" > .env
        echo "REACT_APP_API_URL=http://localhost:3000" >> .env
        log_success "Frontend .env created"
    else
        log_info "Frontend .env already exists"
    fi
    
    cd ../..
else
    log_warning "Frontend directory not found"
fi

# Download sample wordlists (optional)
log_section "Wordlist Setup"
log_info "Checking for wordlists..."
if [ -d "wordlists" ] && [ "$(ls -A wordlists)" ]; then
    log_info "Wordlists already present"
else
    log_info "Wordlists directory is empty"
    log_info "You can download wordlists later using: bash scripts/download_wordlists.sh"
fi

# Setup default configuration if needed
log_section "Configuration Setup"
if [ ! -f "config/hydra.conf" ]; then
    log_info "Default configuration will be created on first run"
else
    log_success "Configuration file exists"
fi

# Create helpful aliases
log_section "Setting Up Convenience Features"
log_info "Adding helpful aliases to .bashrc..."

# Check if aliases already exist
if ! grep -q "# Hydra-Termux Aliases" ~/.bashrc; then
    cat >> ~/.bashrc << 'ALIAS_EOF'

# Hydra-Termux Aliases
alias hydra-start='./hydra.sh'
alias hydra-web='cd fullstack-app && bash start.sh'
alias hydra-backend='cd fullstack-app/backend && npm start'
alias hydra-frontend='cd fullstack-app/frontend && npm start'
alias hydra-fix='./fix-hydra.sh'
alias hydra-check='bash scripts/check_dependencies.sh'
ALIAS_EOF
    log_success "Aliases added to .bashrc"
else
    log_info "Aliases already exist in .bashrc"
fi

# Create a quick start guide
log_section "Creating Quick Start Guide"
cat > CODESPACE_QUICKSTART.md << 'QUICKSTART_EOF'
# 🚀 Codespace Quick Start Guide

Welcome to your Hydra-Termux Codespace! Everything is set up and ready to go.

## Quick Commands

### Start the CLI Tool
```bash
./hydra.sh
```

### Start the Web Application
```bash
# Option 1: Use the start script
cd fullstack-app
bash start.sh

# Option 2: Start both services manually
cd fullstack-app/backend && npm start &
cd fullstack-app/frontend && npm start
```

### Useful Aliases
```bash
hydra-start       # Start main CLI tool
hydra-web         # Start full-stack web app
hydra-backend     # Start backend API only
hydra-frontend    # Start frontend UI only
hydra-fix         # Fix common issues
hydra-check       # Check dependencies
```

## Access Points

- **Backend API**: http://localhost:3000
- **Frontend UI**: http://localhost:3001
- **Default Login**: admin / admin (change immediately!)

## Quick Library Scripts

The fastest way to get started:

```bash
# Edit target and run
bash Library/ssh_quick.sh
bash Library/ftp_quick.sh
bash Library/web_quick.sh
```

## Important Files

- `README.md` - Main documentation
- `docs/USAGE.md` - Detailed usage guide
- `Library.md` - Quick script documentation
- `fullstack-app/README.md` - Web app documentation

## Troubleshooting

If you encounter issues:

```bash
./fix-hydra.sh                        # Interactive problem solver
bash scripts/check_dependencies.sh    # Check what's installed
bash scripts/system_diagnostics.sh    # Full system check
```

## Security Reminder

⚠️ **IMPORTANT**: This tool is for educational and authorized testing ONLY.
- Always get written permission before testing any systems
- Use a VPN when performing security testing
- Comply with all applicable laws and regulations

## Need Help?

- Check the documentation in `docs/`
- Read the troubleshooting section in README.md
- Open an issue on GitHub

Happy testing! 🐍
QUICKSTART_EOF

log_success "Created CODESPACE_QUICKSTART.md"

# Final summary
log_section "Setup Complete!"
echo ""
log_success "✅ Hydra-Termux is ready to use in your Codespace!"
echo ""
echo -e "${CYAN}📚 Quick Start Options:${NC}"
echo ""
echo -e "${GREEN}1. CLI Tool:${NC}"
echo -e "   ${BLUE}./hydra.sh${NC}"
echo ""
echo -e "${GREEN}2. Web Application:${NC}"
echo -e "   ${BLUE}cd fullstack-app && bash start.sh${NC}"
echo -e "   Access at: http://localhost:3001"
echo ""
echo -e "${GREEN}3. Quick Scripts:${NC}"
echo -e "   ${BLUE}bash Library/ssh_quick.sh${NC}  (edit TARGET first)"
echo ""
echo -e "${CYAN}📖 Documentation:${NC}"
echo -e "   ${BLUE}cat CODESPACE_QUICKSTART.md${NC}  - Quick start guide"
echo -e "   ${BLUE}cat README.md${NC}                - Full documentation"
echo ""
echo -e "${CYAN}🔧 Helpful Commands:${NC}"
echo -e "   ${BLUE}hydra-check${NC}      - Verify dependencies"
echo -e "   ${BLUE}hydra-fix${NC}        - Fix common issues"
echo -e "   ${BLUE}hydra-start${NC}      - Launch main tool"
echo ""
echo -e "${YELLOW}⚠️  Legal Reminder:${NC}"
echo -e "   This tool is for ${RED}authorized testing ONLY${NC}"
echo -e "   Always get written permission before testing"
echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create a marker file to indicate setup is complete
touch .codespace-setup-complete
log_info "Setup marker created"

exit 0
