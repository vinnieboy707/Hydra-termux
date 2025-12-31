#!/bin/bash

# Hydra-Termux Setup Wizard
# Interactive first-time setup guide

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_message() {
    echo -e "${2}${1}${NC}"
}

print_banner() {
    print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
    printf "${CYAN}║%-60s║${NC}\n" "$(printf "%*s" $(((60+${#1})/2)) "$1")"
    print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
}

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
║              🐍 SETUP WIZARD 🐍                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
print_message "Welcome to Hydra-Termux Ultimate Edition Setup!" "$CYAN"
print_message "This wizard will help you get started in 3 simple steps." "$BLUE"
echo ""

# Check if already set up
if command -v hydra &> /dev/null; then
    print_message "✅ Hydra is already installed!" "$GREEN"
    echo ""
    read -p "Do you want to re-run setup anyway? (y/n): " rerun
    if [ "$rerun" != "y" ]; then
        print_message "Setup cancelled. Run ./hydra.sh to start using the tool." "$CYAN"
        exit 0
    fi
    echo ""
fi

print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Step 1: System Check
print_message "📋 STEP 1/3: System Compatibility Check" "$MAGENTA"
echo ""

print_message "Analyzing your system..." "$BLUE"
sleep 1

# Run quick diagnostics
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -d "/data/data/com.termux" ]; then
    print_message "✅ Detected: Termux on Android" "$GREEN"
    IS_TERMUX=true
else
    print_message "✅ Detected: Linux/Unix system" "$GREEN"
    IS_TERMUX=false
fi

# Check basic requirements
echo ""
print_message "Checking basic requirements..." "$BLUE"
sleep 1

if command -v bash &> /dev/null; then
    print_message "  ✅ Bash shell" "$GREEN"
else
    print_message "  ❌ Bash shell (CRITICAL)" "$RED"
    echo ""
    print_message "Error: Bash is required but not found." "$RED"
    exit 1
fi

if command -v git &> /dev/null; then
    print_message "  ✅ Git" "$GREEN"
else
    print_message "  ⚠️  Git (optional but recommended)" "$YELLOW"
fi

echo ""
read -p "Press Enter to continue to installation..."
clear

# Step 2: Installation
print_banner "STEP 2/3: Install Hydra & Dependencies"
echo ""

if command -v hydra &> /dev/null; then
    print_message "✅ Hydra is already installed!" "$GREEN"
    hydra -h 2>&1 | head -1
    echo ""
    read -p "Skip installation? (Y/n): " skip_install
    
    if [ "$skip_install" = "n" ] || [ "$skip_install" = "N" ]; then
        skip_install="no"
    else
        skip_install="yes"
    fi
else
    print_message "⚠️  Hydra is not installed." "$YELLOW"
    echo ""
    print_message "Hydra is the core tool needed for all attacks." "$BLUE"
    echo ""
    skip_install="no"
fi

if [ "$skip_install" = "no" ]; then
    print_message "Choose installation method:" "$CYAN"
    echo ""
    echo "  1) Automatic installation (recommended)"
    echo "  2) Run auto-fix script (tries multiple methods)"
    echo "  3) Manual installation (I'll do it myself)"
    echo ""
    read -p "Enter choice [1-3]: " install_choice
    
    case $install_choice in
        1)
            print_message "🚀 Running automatic installer..." "$BLUE"
            echo ""
            bash "$PROJECT_ROOT/install.sh"
            ;;
        2)
            print_message "🔧 Running auto-fix script..." "$BLUE"
            echo ""
            bash "$SCRIPT_DIR/auto_fix.sh"
            ;;
        3)
            print_message "📖 Manual Installation Instructions:" "$CYAN"
            echo ""
            
            if [ "$IS_TERMUX" = true ]; then
                print_message "On Termux, run:" "$BLUE"
                print_message "  pkg update" "$GREEN"
                print_message "  pkg install hydra -y" "$GREEN"
            else
                print_message "On Debian/Ubuntu:" "$BLUE"
                print_message "  sudo apt update" "$GREEN"
                print_message "  sudo apt install hydra -y" "$GREEN"
            fi
            
            echo ""
            read -p "After installing manually, press Enter to continue..."
            ;;
        *)
            print_message "Invalid choice. Skipping installation." "$RED"
            ;;
    esac
fi

echo ""
read -p "Press Enter to continue to verification..."
clear

# Step 3: Verification
print_banner "STEP 3/3: Verify Installation"
echo ""

print_message "🔍 Running comprehensive diagnostics..." "$BLUE"
echo ""
sleep 1

# Run diagnostics
bash "$SCRIPT_DIR/system_diagnostics.sh"

echo ""
echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Final check
if command -v hydra &> /dev/null; then
    print_message "╔════════════════════════════════════════════════════════════╗" "$GREEN"
    print_message "║          ✅ SETUP COMPLETE! YOU'RE READY! ✅               ║" "$GREEN"
    print_message "╚════════════════════════════════════════════════════════════╝" "$GREEN"
    echo ""
    
    print_message "🎉 Congratulations! Hydra-Termux is ready to use!" "$GREEN"
    echo ""
    
    print_message "═══ QUICK START GUIDE ═══" "$CYAN"
    echo ""
    
    print_message "📱 Launch the main menu:" "$BLUE"
    print_message "   ./hydra.sh" "$GREEN"
    echo ""
    
    print_message "⚡ Quick attacks (easiest method):" "$BLUE"
    print_message "   1. Edit ONE line: nano Library/ssh_quick.sh" "$GREEN"
    print_message "   2. Change TARGET=\"your-target-ip\"" "$GREEN"
    print_message "   3. Run: bash Library/ssh_quick.sh" "$GREEN"
    echo ""
    
    print_message "📖 Documentation:" "$BLUE"
    print_message "   • QUICKSTART.md - 5-minute guide" "$BLUE"
    print_message "   • Library.md - One-line-change scripts" "$BLUE"
    print_message "   • docs/USAGE.md - Detailed usage" "$BLUE"
    echo ""
    
    print_message "🔍 System diagnostics (anytime):" "$BLUE"
    print_message "   bash scripts/system_diagnostics.sh" "$GREEN"
    echo ""
    
    print_message "⚠️  LEGAL REMINDER:" "$RED"
    print_message "   • Only use on authorized systems" "$YELLOW"
    print_message "   • Get written permission first" "$YELLOW"
    print_message "   • Use VPN for anonymity" "$YELLOW"
    echo ""
    
    print_message "Ready to start? Launch now:" "$CYAN"
    echo ""
    read -p "Run ./hydra.sh now? (Y/n): " run_now
    
    if [ "$run_now" != "n" ] && [ "$run_now" != "N" ]; then
        echo ""
        exec "$PROJECT_ROOT/hydra.sh"
    else
        echo ""
        print_message "Setup complete! Run ./hydra.sh when ready." "$GREEN"
        echo ""
    fi
else
    print_message "╔════════════════════════════════════════════════════════════╗" "$RED"
    print_message "║          ⚠️  SETUP INCOMPLETE ⚠️                           ║" "$RED"
    print_message "╚════════════════════════════════════════════════════════════╝" "$RED"
    echo ""
    
    print_message "❌ Hydra is still not installed." "$RED"
    echo ""
    
    print_message "═══ TROUBLESHOOTING OPTIONS ═══" "$CYAN"
    echo ""
    
    print_message "1️⃣  Try automatic fix:" "$BLUE"
    print_message "   bash scripts/auto_fix.sh" "$GREEN"
    echo ""
    
    print_message "2️⃣  Read troubleshooting guide:" "$BLUE"
    print_message "   cat docs/TROUBLESHOOTING.md" "$GREEN"
    echo ""
    
    print_message "3️⃣  Check dependencies:" "$BLUE"
    print_message "   bash scripts/check_dependencies.sh" "$GREEN"
    echo ""
    
    print_message "4️⃣  Get help on GitHub:" "$BLUE"
    print_message "   https://github.com/vinnieboy707/Hydra-termux/issues" "$GREEN"
    echo ""
    
    print_message "════════════════════════════════════════════════════════════" "$BLUE"
    echo ""
    
    exit 1
fi
