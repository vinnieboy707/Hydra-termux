#!/bin/bash

# Hydra-Termux Ultimate Edition Installation Script
# This script automates the complete installation process

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    read -r -p "Continue anyway? (y/n): " continue_install
    if [ "$continue_install" != "y" ]; then
        exit 0
    fi
fi

# VPN Check
print_message "🔒 Security Check" "$CYAN"
print_message "⚠️  IMPORTANT: Always use a VPN when performing security testing!" "$YELLOW"
print_message "   Recommendation: Use ProtonVPN, NordVPN, or Tor" "$BLUE"
echo ""

# Check if running in interactive mode
if [ -t 0 ]; then
    read -r -p "Are you using a VPN? (y/n): " vpn_status
    if [ "$vpn_status" != "y" ]; then
        print_message "⚠️  Warning: Proceeding without VPN is not recommended!" "$RED"
        sleep 3
    fi
else
    print_message "ℹ️  Non-interactive mode detected, skipping VPN prompt" "$BLUE"
    print_message "⚠️  Remember to use a VPN for security testing!" "$YELLOW"
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
echo ""

# Track failed installations
FAILED_PACKAGES=()

while IFS= read -r package || [ -n "$package" ]; do
    # Skip empty lines and comments
    [[ -z "$package" || "$package" =~ ^[[:space:]]*# ]] && continue
    
    print_message "   Installing: $package" "$BLUE"
    
    # Try to install the package
    if pkg install "$package" -y > /dev/null 2>&1; then
        # Verify the package is actually available
        if command -v "$package" &> /dev/null || pkg list-installed 2>/dev/null | grep -q "^$package/"; then
            print_message "   ✓ $package installed successfully" "$GREEN"
        else
            print_message "   ⚠ $package installation completed but command not found" "$YELLOW"
            FAILED_PACKAGES+=("$package")
        fi
    else
        print_message "   ✗ $package installation FAILED" "$RED"
        FAILED_PACKAGES+=("$package")
    fi
done < need.txt

echo ""

# Report on failed packages
if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
    print_message "⚠️  WARNING: Some packages failed to install:" "$YELLOW"
    for pkg_name in "${FAILED_PACKAGES[@]}"; do
        print_message "     - $pkg_name" "$RED"
    done
    echo ""
    
    # Check if hydra failed (critical)
    hydra_failed=false
    for pkg in "${FAILED_PACKAGES[@]}"; do
        if [ "$pkg" = "hydra" ]; then
            hydra_failed=true
            break
        fi
    done
    
    if [ "$hydra_failed" = true ]; then
        print_message "🚨 CRITICAL: Hydra installation FAILED!" "$RED"
        echo ""
        print_message "Hydra is the CORE dependency. Without it, nothing will work." "$YELLOW"
        echo ""
        print_message "═══ TROUBLESHOOTING STEPS ═══" "$CYAN"
        echo ""
        print_message "1. Update package repositories:" "$BLUE"
        print_message "   pkg update && pkg upgrade -y" "$GREEN"
        echo ""
        print_message "2. Try installing hydra manually:" "$BLUE"
        print_message "   pkg install hydra -y" "$GREEN"
        echo ""
        print_message "3. Check for package availability:" "$BLUE"
        print_message "   pkg search hydra" "$GREEN"
        echo ""
        print_message "4. If hydra is not in repositories, compile from source:" "$BLUE"
        print_message "   pkg install git make gcc -y" "$GREEN"
        print_message "   git clone https://github.com/vanhauser-thc/thc-hydra" "$GREEN"
        print_message "   cd thc-hydra && ./configure && make && make install" "$GREEN"
        echo ""
        print_message "════════════════════════════════════════════════════════" "$BLUE"
        echo ""
    fi
fi

# Create directory structure
print_message "📁 Creating directory structure..." "$YELLOW"
mkdir -p logs results wordlists config docs scripts
check_status "Directory creation"

# Set permissions for all scripts
print_message "🔧 Setting script permissions..." "$YELLOW"
chmod +x hydra.sh 2>/dev/null
chmod +x install.sh 2>/dev/null
chmod +x scripts/*.sh 2>/dev/null
chmod +x scripts/check_dependencies.sh 2>/dev/null
check_status "Setting permissions"

# Verify installation
print_message "✓ Verifying installation..." "$YELLOW"
echo ""

# Check hydra (CRITICAL)
HYDRA_OK=false
if command -v hydra &> /dev/null; then
    hydra_version=$(hydra -h 2>&1 | head -1)
    print_message "   ✓ Hydra: $hydra_version" "$GREEN"
    HYDRA_OK=true
else
    print_message "   ✗ Hydra: Not found (CRITICAL)" "$RED"
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
script_count=$(find scripts -name "*_attack.sh" -type f 2>/dev/null | wc -l)
print_message "   ✓ Attack scripts: $script_count installed" "$GREEN"

# Offer to download wordlists
echo ""
print_message "📚 Wordlist Setup" "$CYAN"

# Check if running in interactive mode
if [ -t 0 ]; then
    read -r -p "Download default wordlists now? (y/n): " download_wordlists
    if [ "$download_wordlists" = "y" ]; then
        print_message "   Downloading wordlists..." "$BLUE"
        bash scripts/download_wordlists.sh --all 2>/dev/null || print_message "   ⚠ Failed to download wordlists" "$YELLOW"
    else
        print_message "   Skipped. You can download later using option 9 in the main menu" "$YELLOW"
    fi
else
    print_message "   Skipping wordlist download (non-interactive mode)" "$YELLOW"
    print_message "   You can download later using: bash scripts/download_wordlists.sh --all" "$BLUE"
fi

# Final message
echo ""

# Check if installation was successful
if [ "$HYDRA_OK" = true ]; then
    print_message "╔═══════════════════════════════════════════════════════╗" "$GREEN"
    print_message "║     Installation Complete Successfully! 🎉            ║" "$GREEN"
    print_message "╚═══════════════════════════════════════════════════════╝" "$GREEN"
    echo ""
    print_message "🚀 To start Hydra-Termux Ultimate Edition, run:" "$CYAN"
    print_message "   ./hydra.sh" "$GREEN"
    echo ""
    print_message "🔍 To verify all dependencies, run:" "$CYAN"
    print_message "   bash scripts/check_dependencies.sh" "$GREEN"
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
    
    # Offer to launch main dashboard
    echo ""
    read -r -p "Would you like to launch the Hydra-Termux dashboard now? (y/n): " launch_choice
    
    if [ "$launch_choice" = "y" ] || [ "$launch_choice" = "Y" ] || [ "$launch_choice" = "yes" ]; then
        print_message "🏠 Launching main dashboard..." "$GREEN"
        echo ""
        sleep 1
        
        # Launch main dashboard
        if [ -f "./hydra.sh" ]; then
            exec bash ./hydra.sh
        else
            print_message "⚠️  Main dashboard not found. Run './hydra.sh' manually." "$YELLOW"
        fi
    else
        print_message "Run './hydra.sh' anytime to start the dashboard." "$CYAN"
    fi
    
    exit 0
else
    print_message "╔═══════════════════════════════════════════════════════╗" "$RED"
    print_message "║     Installation Completed with ERRORS! ⚠️            ║" "$RED"
    print_message "╚═══════════════════════════════════════════════════════╝" "$RED"
    echo ""
    print_message "🚨 CRITICAL: Hydra failed to install!" "$RED"
    echo ""
    print_message "Hydra-Termux WILL NOT WORK without the hydra tool installed." "$YELLOW"
    echo ""
    print_message "═══ NEXT STEPS ═══" "$CYAN"
    echo ""
    print_message "1. Read the error messages above carefully" "$BLUE"
    print_message "2. Try the troubleshooting steps provided" "$BLUE"
    print_message "3. Run dependency check for detailed diagnosis:" "$BLUE"
    print_message "   bash scripts/check_dependencies.sh" "$GREEN"
    echo ""
    print_message "4. If issues persist, check documentation:" "$BLUE"
    print_message "   • README.md - Installation troubleshooting section" "$BLUE"
    print_message "   • docs/TERMUX_DEPLOYMENT.md - Termux-specific guide" "$BLUE"
    echo ""
    print_message "5. Open an issue on GitHub with error details:" "$BLUE"
    print_message "   https://github.com/vinnieboy707/Hydra-termux/issues" "$GREEN"
    echo ""
    print_message "════════════════════════════════════════════════════════" "$BLUE"
    echo ""
    exit 1
fi
