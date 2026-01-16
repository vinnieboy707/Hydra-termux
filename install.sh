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

# Special handling for hydra - try multiple approaches
install_hydra() {
    print_message "   Installing: hydra (CRITICAL PACKAGE)" "$BLUE"
    
    # Check if already installed
    if command -v hydra &> /dev/null; then
        print_message "   ✓ hydra already installed" "$GREEN"
        return 0
    fi
    
    # Ensure Termux has access to the repository that provides hydra
    if [ -d "/data/data/com.termux" ]; then
        if ! pkg list-installed 2>/dev/null | grep -q "root-repo"; then
            print_message "   Enabling Termux root repository (hydra is located here)..." "$CYAN"
            if pkg install root-repo -y > /dev/null 2>&1; then
                print_message "   ✓ root repository enabled" "$GREEN"
            else
                print_message "   ⚠ Failed to enable root repository; continuing without it" "$YELLOW"
            fi
        fi
    fi
    
    # Create secure temporary log file
    local hydra_log=$(mktemp)
    
    # Attempt 1: Try standard 'hydra' package
    print_message "   Attempting: pkg install hydra..." "$CYAN"
    if pkg install hydra -y 2>&1 | tee "$hydra_log" | grep -q "Installing\|Setting up\|Unpacking"; then
        sleep 2
        if command -v hydra &> /dev/null; then
            print_message "   ✓ hydra installed successfully" "$GREEN"
            rm -f "$hydra_log"
            return 0
        fi
    fi
    
    # Attempt 2: Try 'thc-hydra' alternative name
    print_message "   Attempting: pkg install thc-hydra..." "$CYAN"
    if pkg install thc-hydra -y 2>&1 | tee -a "$hydra_log" | grep -q "Installing\|Setting up\|Unpacking"; then
        sleep 2
        if command -v hydra &> /dev/null; then
            print_message "   ✓ thc-hydra installed successfully" "$GREEN"
            rm -f "$hydra_log"
            return 0
        fi
    fi
    
    # Attempt 3: Search for available hydra packages
    print_message "   Searching for hydra in repositories..." "$CYAN"
    local available_hydra
    available_hydra=$(pkg search hydra 2>/dev/null | grep -i "^hydra" | head -1 | awk '{print $1}')
    if [ -n "$available_hydra" ]; then
        print_message "   Found: $available_hydra" "$BLUE"
        if pkg install "$available_hydra" -y 2>&1 | tee -a "$hydra_log" | grep -q "Installing\|Setting up\|Unpacking"; then
            sleep 2
            if command -v hydra &> /dev/null; then
                print_message "   ✓ $available_hydra installed successfully" "$GREEN"
                rm -f "$hydra_log"
                return 0
            fi
        fi
    fi
    
    # All attempts failed - show detailed error
    print_message "   ✗ All hydra installation attempts FAILED" "$RED"
    echo ""
    print_message "   Last error output:" "$YELLOW"
    if [ -f "$hydra_log" ]; then
        tail -10 "$hydra_log" | sed 's/^/     /'
        rm -f "$hydra_log"
    fi
    echo ""
    
    return 1
}

# Try to install hydra first (most critical)
if ! install_hydra; then
    FAILED_PACKAGES+=("hydra")
fi

# Install other packages
while IFS= read -r package || [ -n "$package" ]; do
    # Skip empty lines and comments
    [[ -z "$package" || "$package" =~ ^[[:space:]]*# ]] && continue
    
    # Skip hydra (already handled above)
    [ "$package" = "hydra" ] && continue
    
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
        print_message "═══ AUTOMATIC FIX AVAILABLE ═══" "$CYAN"
        echo ""
        print_message "🔧 Run the automatic fixer to try advanced installation methods:" "$BLUE"
        print_message "   bash scripts/auto_fix.sh" "$GREEN"
        echo ""
        print_message "This will attempt:" "$BLUE"
        print_message "  • Multiple package repository updates" "$BLUE"
        print_message "  • Alternative package names (thc-hydra, etc.)" "$BLUE"
        print_message "  • Compilation from source if needed" "$BLUE"
        print_message "  • Pre-built binary downloads" "$BLUE"
        echo ""
        print_message "═══ MANUAL TROUBLESHOOTING STEPS ═══" "$CYAN"
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
        print_message "4. Try alternative package names:" "$BLUE"
        print_message "   pkg install thc-hydra -y" "$GREEN"
        echo ""
        print_message "5. If hydra is not in repositories, install from root repo:" "$BLUE"
        print_message "   pkg install root-repo" "$GREEN"
        print_message "   pkg install hydra -y" "$GREEN"
        echo ""
        print_message "6. Compile from source (advanced):" "$BLUE"
        print_message "   pkg install git make clang libssh2 openssl -y" "$GREEN"
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
    print_message "═══ QUICK FIX (RECOMMENDED) ═══" "$CYAN"
    echo ""
    print_message "🔧 Try the automatic fixer (attempts multiple methods):" "$GREEN"
    print_message "   bash scripts/auto_fix.sh" "$GREEN"
    echo ""
    print_message "Or use the interactive help center:" "$GREEN"
    print_message "   ./fix-hydra.sh" "$GREEN"
    echo ""
    print_message "═══ NEXT STEPS ═══" "$CYAN"
    echo ""
    print_message "1. Review error messages above for specific issues" "$BLUE"
    print_message "2. Run automatic fixer: bash scripts/auto_fix.sh" "$BLUE"
    print_message "3. Run dependency check for detailed diagnosis:" "$BLUE"
    print_message "   bash scripts/check_dependencies.sh" "$GREEN"
    echo ""
    print_message "4. Check system diagnostics (shows health score):" "$BLUE"
    print_message "   bash scripts/system_diagnostics.sh" "$GREEN"
    echo ""
    print_message "5. Review documentation for manual fixes:" "$BLUE"
    print_message "   • README.md - Installation troubleshooting section" "$BLUE"
    print_message "   • docs/TERMUX_DEPLOYMENT.md - Termux-specific guide" "$BLUE"
    echo ""
    print_message "6. Still stuck? Get help on GitHub:" "$BLUE"
    print_message "   https://github.com/vinnieboy707/Hydra-termux/issues" "$GREEN"
    echo ""
    print_message "════════════════════════════════════════════════════════" "$BLUE"
    echo ""
    exit 1
fi
