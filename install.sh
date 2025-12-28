#!/bin/bash

# Hydra-Termux Ultimate Edition Installation Script
# This script automates the complete installation process

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to check if a command was successful
check_status() {
    if [ $? -eq 0 ]; then
        print_message "✅ $1 successful" "$GREEN"
    else
        print_message "❌ $1 failed" "$RED"
        exit 1
    fi
}

# Banner
clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🐍 HYDRA-TERMUX ULTIMATE EDITION 🐍                ║
║                  Installation Script                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo ""

# Check if running on Termux
if [ ! -d "/data/data/com.termux" ]; then
    print_message "⚠️  Warning: This tool is optimized for Termux on Android" "$YELLOW"
    read -p "Continue anyway? (y/n): " continue_install
    if [ "$continue_install" != "y" ]; then
        exit 0
    fi
fi

# VPN Check
print_message "🔒 Security Check" "$CYAN"
print_message "⚠️  IMPORTANT: Always use a VPN when performing security testing!" "$YELLOW"
print_message "   Recommendation: Use ProtonVPN, NordVPN, or Tor" "$BLUE"
echo ""
read -p "Are you using a VPN? (y/n): " vpn_status
if [ "$vpn_status" != "y" ]; then
    print_message "⚠️  Warning: Proceeding without VPN is not recommended!" "$RED"
    sleep 3
fi
echo ""

# Update package lists
print_message "📦 Updating package lists..." "$YELLOW"
pkg update -y > /dev/null 2>&1
check_status "Package update"

# Upgrade existing packages
print_message "⬆️  Upgrading packages..." "$YELLOW"
pkg upgrade -y > /dev/null 2>&1
check_status "Package upgrade"

# Check if need.txt exists
if [ ! -f "need.txt" ]; then
    print_message "⚠️  need.txt not found. Creating package list..." "$YELLOW"
    cat > need.txt << EOF
hydra
git
wget
curl
openssl
nmap
termux-api
figlet
jq
EOF
    print_message "✅ Created need.txt with required packages" "$GREEN"
fi

# Install required packages
print_message "📥 Installing required packages..." "$YELLOW"
while IFS= read -r package || [ -n "$package" ]; do
    # Skip empty lines and comments
    [[ -z "$package" || "$package" =~ ^[[:space:]]*# ]] && continue
    
    print_message "   Installing: $package" "$BLUE"
    pkg install "$package" -y > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_message "   ✓ $package installed" "$GREEN"
    else
        print_message "   ⚠ Warning: $package installation may have issues" "$YELLOW"
    fi
done < need.txt

# Create directory structure
print_message "📁 Creating directory structure..." "$YELLOW"
mkdir -p logs results wordlists config docs scripts
check_status "Directory creation"

# Set permissions for all scripts
print_message "🔧 Setting script permissions..." "$YELLOW"
chmod +x hydra.sh 2>/dev/null
chmod +x install.sh 2>/dev/null
chmod +x scripts/*.sh 2>/dev/null
check_status "Setting permissions"

# Verify installation
print_message "✓ Verifying installation..." "$YELLOW"
echo ""

# Check hydra
if command -v hydra &> /dev/null; then
    print_message "   ✓ Hydra: $(hydra -h 2>&1 | head -1)" "$GREEN"
else
    print_message "   ✗ Hydra: Not found" "$RED"
fi

# Check nmap
if command -v nmap &> /dev/null; then
    print_message "   ✓ Nmap: $(nmap --version | head -1)" "$GREEN"
else
    print_message "   ✗ Nmap: Not found" "$RED"
fi

# Check jq
if command -v jq &> /dev/null; then
    print_message "   ✓ jq: JSON processor installed" "$GREEN"
else
    print_message "   ✗ jq: Not found" "$RED"
fi

# Check main script
if [ -f "hydra.sh" ]; then
    print_message "   ✓ Main launcher: hydra.sh" "$GREEN"
else
    print_message "   ✗ Main launcher: Not found" "$RED"
fi

# Count attack scripts
script_count=$(ls scripts/*_attack.sh 2>/dev/null | wc -l)
print_message "   ✓ Attack scripts: $script_count installed" "$GREEN"

# Offer to download wordlists
echo ""
print_message "📚 Wordlist Setup" "$CYAN"
read -p "Download default wordlists now? (y/n): " download_wordlists
if [ "$download_wordlists" = "y" ]; then
    print_message "   Downloading wordlists..." "$BLUE"
    bash scripts/download_wordlists.sh --all 2>/dev/null || print_message "   ⚠ Failed to download wordlists" "$YELLOW"
else
    print_message "   Skipped. You can download later using option 9 in the main menu" "$YELLOW"
fi

# Final message
echo ""
print_message "╔═══════════════════════════════════════════════════════╗" "$GREEN"
print_message "║     Installation Complete Successfully! 🎉            ║" "$GREEN"
print_message "╚═══════════════════════════════════════════════════════╝" "$GREEN"
echo ""
print_message "🚀 To start Hydra-Termux Ultimate Edition, run:" "$CYAN"
print_message "   ./hydra.sh" "$GREEN"
echo ""
print_message "📖 Documentation:" "$BLUE"
print_message "   • README.md - Getting started guide" "$BLUE"
print_message "   • docs/USAGE.md - Detailed usage instructions" "$BLUE"
print_message "   • docs/EXAMPLES.md - Real-world examples" "$BLUE"
echo ""
print_message "⚠️  LEGAL REMINDER:" "$RED"
print_message "   This tool is for educational and authorized testing ONLY." "$YELLOW"
print_message "   Always get written permission before testing." "$YELLOW"
echo ""
print_message "💡 Performance Tips:" "$CYAN"
print_message "   • Use WiFi for better performance" "$BLUE"
print_message "   • Close other apps to free memory" "$BLUE"
print_message "   • Keep Termux running in foreground" "$BLUE"
echo ""
