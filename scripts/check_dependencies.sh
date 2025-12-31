#!/bin/bash

# Hydra-Termux Dependency Checker
# Validates all required tools and provides helpful installation guidance

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track if any dependencies are missing
MISSING_DEPS=0
MISSING_OPTIONAL=0

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to print banner
print_banner() {
    print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
    printf "${CYAN}║%-60s║${NC}\n" "$(printf "%*s" $(((60+${#1})/2)) "$1")"
    print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
}

# Function to check if command exists
check_command() {
    local cmd="$1"
    local required="$2"
    local description="$3"
    
    if command -v "$cmd" &> /dev/null; then
        print_message "  ✅ $cmd - $description" "$GREEN"
        return 0
    else
        if [ "$required" = "required" ]; then
            print_message "  ❌ $cmd - $description (REQUIRED)" "$RED"
            MISSING_DEPS=$((MISSING_DEPS + 1))
        else
            print_message "  ⚠️  $cmd - $description (OPTIONAL)" "$YELLOW"
            MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
        fi
        return 1
    fi
}

clear
print_banner "Hydra-Termux Dependency Checker"
echo ""

print_message "🔍 Checking Required Dependencies..." "$CYAN"
echo ""

# Check critical tools
check_command "hydra" "required" "THC-Hydra brute-force tool (CORE DEPENDENCY)"
HYDRA_INSTALLED=$?

check_command "bash" "required" "Bash shell"
check_command "git" "required" "Version control for updates"
check_command "jq" "required" "JSON processor for results"

echo ""
print_message "🔍 Checking Optional Tools..." "$CYAN"
echo ""

check_command "nmap" "optional" "Network scanner for target reconnaissance"
check_command "wget" "optional" "Download wordlists"
check_command "curl" "optional" "HTTP requests for web attacks"
check_command "openssl" "optional" "SSL/TLS for encrypted connections"
check_command "figlet" "optional" "ASCII art banners"
check_command "termux-api" "optional" "Termux-specific features"

# Check for script files
echo ""
print_message "🔍 Checking Script Files..." "$CYAN"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$SCRIPT_DIR/logger.sh" ]; then
    print_message "  ✅ logger.sh - Logging utility" "$GREEN"
else
    print_message "  ❌ logger.sh - Logging utility (MISSING)" "$RED"
    MISSING_DEPS=$((MISSING_DEPS + 1))
fi

if [ -f "$PROJECT_ROOT/hydra.sh" ]; then
    print_message "  ✅ hydra.sh - Main launcher" "$GREEN"
else
    print_message "  ❌ hydra.sh - Main launcher (MISSING)" "$RED"
    MISSING_DEPS=$((MISSING_DEPS + 1))
fi

# Count attack scripts
script_count=$(ls "$SCRIPT_DIR"/*_attack.sh 2>/dev/null | wc -l)
if [ "$script_count" -ge 7 ]; then
    print_message "  ✅ Attack scripts - $script_count found" "$GREEN"
else
    print_message "  ⚠️  Attack scripts - Only $script_count found (expected 8)" "$YELLOW"
fi

# Summary
echo ""
print_message "═══════════════════════════════════════════════════════════" "$BLUE"
echo ""

if [ $MISSING_DEPS -eq 0 ]; then
    print_message "✅ SUCCESS! All required dependencies are installed!" "$GREEN"
    echo ""
    print_message "You can now use Hydra-Termux by running:" "$CYAN"
    print_message "  ./hydra.sh" "$GREEN"
    echo ""
    
    if [ $MISSING_OPTIONAL -gt 0 ]; then
        print_message "⚠️  Note: $MISSING_OPTIONAL optional tool(s) missing" "$YELLOW"
        print_message "   Some features may be limited, but core functionality works." "$YELLOW"
        echo ""
    fi
    
    exit 0
else
    print_message "❌ PROBLEM: $MISSING_DEPS required dependency(ies) missing!" "$RED"
    echo ""
    
    # Provide specific fixes
    if [ $HYDRA_INSTALLED -ne 0 ]; then
        print_message "🔧 CRITICAL: Hydra is NOT installed!" "$RED"
        echo ""
        print_message "Hydra is the CORE tool this suite depends on." "$YELLOW"
        print_message "Without hydra, NO attacks will work." "$YELLOW"
        echo ""
        print_message "═══ HOW TO FIX ═══" "$CYAN"
        echo ""
        
        # Check if running on Termux
        if [ -d "/data/data/com.termux" ]; then
            print_message "On Termux (Android), install hydra with:" "$BLUE"
            print_message "  pkg update" "$GREEN"
            print_message "  pkg install hydra -y" "$GREEN"
            echo ""
            print_message "Or run the automated installer:" "$BLUE"
            print_message "  bash install.sh" "$GREEN"
        else
            print_message "On Linux/Unix, install hydra with:" "$BLUE"
            echo ""
            print_message "Debian/Ubuntu:" "$YELLOW"
            print_message "  sudo apt update" "$GREEN"
            print_message "  sudo apt install hydra -y" "$GREEN"
            echo ""
            print_message "Fedora/RHEL:" "$YELLOW"
            print_message "  sudo dnf install hydra -y" "$GREEN"
            echo ""
            print_message "Arch Linux:" "$YELLOW"
            print_message "  sudo pacman -S hydra" "$GREEN"
            echo ""
            print_message "macOS (with Homebrew):" "$YELLOW"
            print_message "  brew install hydra" "$GREEN"
            echo ""
            print_message "Or compile from source:" "$YELLOW"
            print_message "  git clone https://github.com/vanhauser-thc/thc-hydra" "$GREEN"
            print_message "  cd thc-hydra && ./configure && make && sudo make install" "$GREEN"
        fi
        
        echo ""
        print_message "After installing hydra, run this check again:" "$BLUE"
        print_message "  bash scripts/check_dependencies.sh" "$GREEN"
        echo ""
    fi
    
    # Other missing dependencies
    if [ $MISSING_DEPS -gt 1 ]; then
        print_message "═══ OTHER MISSING TOOLS ═══" "$CYAN"
        echo ""
        
        if [ -d "/data/data/com.termux" ]; then
            print_message "Install all missing tools with:" "$BLUE"
            print_message "  bash install.sh" "$GREEN"
            echo ""
            print_message "Or manually:" "$BLUE"
            print_message "  pkg install hydra git jq -y" "$GREEN"
        else
            print_message "Run the installer to fix all issues:" "$BLUE"
            print_message "  bash install.sh" "$GREEN"
        fi
        echo ""
    fi
    
    print_message "═══════════════════════════════════════════════════════════" "$BLUE"
    echo ""
    
    exit 1
fi
