#!/bin/bash

# Hydra-Termux Automatic Fixer
# Attempts to automatically fix common issues

# Color codes
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

# Function to print banner
print_banner() {
    print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
    printf "${CYAN}║%-60s║${NC}\n" "$(printf "%*s" $(((60+${#1})/2)) "$1")"
    print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
}

clear
print_banner "Hydra-Termux Automatic Fixer"
echo ""

print_message "🔧 This tool will attempt to automatically fix common issues" "$CYAN"
print_message "   It will try multiple methods to get Hydra working" "$BLUE"
echo ""

# Detect OS/Environment
IS_TERMUX=false
IS_DEBIAN=false
IS_FEDORA=false
IS_ARCH=false
IS_MACOS=false

if [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=true
    print_message "📱 Detected: Termux on Android" "$GREEN"
elif [ -f "/etc/debian_version" ]; then
    IS_DEBIAN=true
    print_message "🐧 Detected: Debian/Ubuntu Linux" "$GREEN"
elif [ -f "/etc/fedora-release" ] || [ -f "/etc/redhat-release" ]; then
    IS_FEDORA=true
    print_message "🐧 Detected: Fedora/RHEL/CentOS" "$GREEN"
elif [ -f "/etc/arch-release" ]; then
    IS_ARCH=true
    print_message "🐧 Detected: Arch Linux" "$GREEN"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    IS_MACOS=true
    print_message "🍎 Detected: macOS" "$GREEN"
else
    print_message "❓ Unknown OS - will try generic fixes" "$YELLOW"
fi

echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Function to check if hydra is installed
check_hydra() {
    if command -v hydra &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Initial check
if check_hydra; then
    print_message "✅ Hydra is already installed!" "$GREEN"
    hydra_version=$(hydra -h 2>&1 | head -1)
    print_message "   Version: $hydra_version" "$GREEN"
    echo ""
    print_message "No fixes needed. Your installation is working!" "$GREEN"
    echo ""
    
    # Offer to launch main dashboard
    read -r -p "Would you like to launch the main Hydra-Termux dashboard? (y/n): " launch_choice
    
    if [ "$launch_choice" = "y" ] || [ "$launch_choice" = "Y" ] || [ "$launch_choice" = "yes" ]; then
        print_message "🏠 Launching main dashboard..." "$GREEN"
        sleep 1
        
        # Get script directory
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
        
        # Launch main dashboard
        if [ -f "$SCRIPT_DIR/hydra.sh" ]; then
            exec bash "$SCRIPT_DIR/hydra.sh"
        else
            print_message "⚠️  Main dashboard not found at: $SCRIPT_DIR/hydra.sh" "$YELLOW"
            echo ""
        fi
    fi
    
    exit 0
fi

print_message "🔍 Hydra is not installed. Starting automatic fix..." "$YELLOW"
echo ""

# Fix attempts counter
ATTEMPTS=0
MAX_ATTEMPTS=5

# Attempt 1: Update package repositories and install via package manager
ATTEMPTS=$((ATTEMPTS + 1))
print_message "═══ FIX ATTEMPT $ATTEMPTS/$MAX_ATTEMPTS: Update repos and install ═══" "$CYAN"
echo ""

if [ "$IS_TERMUX" = true ]; then
    print_message "📦 Updating Termux repositories..." "$BLUE"
    pkg update -y 2>&1 | grep -i "Reading\|Updating\|packages\|upgraded" || true
    echo ""
    
    print_message "📥 Installing hydra package..." "$BLUE"
    pkg install hydra -y 2>&1 | grep -i "Installing\|Setting\|Unpacking\|hydra" || true
    echo ""
elif [ "$IS_DEBIAN" = true ]; then
    print_message "📦 Updating apt repositories..." "$BLUE"
    sudo apt update 2>&1 | grep -i "Reading\|Hit\|Get" | head -10 || true
    echo ""
    
    print_message "📥 Installing hydra package..." "$BLUE"
    sudo apt install hydra -y 2>&1 | grep -i "Installing\|Setting\|Unpacking\|hydra" || true
    echo ""
elif [ "$IS_FEDORA" = true ]; then
    print_message "📥 Installing hydra with dnf..." "$BLUE"
    sudo dnf install hydra -y 2>&1 | grep -i "Installing\|hydra" || true
    echo ""
elif [ "$IS_ARCH" = true ]; then
    print_message "📥 Installing hydra with pacman..." "$BLUE"
    sudo pacman -S --noconfirm hydra 2>&1 | grep -i "Installing\|hydra" || true
    echo ""
elif [ "$IS_MACOS" = true ]; then
    if command -v brew &> /dev/null; then
        print_message "📥 Installing hydra with Homebrew..." "$BLUE"
        brew install hydra 2>&1 | grep -i "Installing\|hydra" || true
        echo ""
    else
        print_message "⚠️  Homebrew not found. Installing Homebrew first..." "$YELLOW"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        brew install hydra
        echo ""
    fi
fi

if check_hydra; then
    print_message "✅ SUCCESS! Hydra installed via package manager!" "$GREEN"
    echo ""
    hydra -h 2>&1 | head -3
    echo ""
    exit 0
fi

print_message "⚠️  Package manager installation failed. Trying alternative methods..." "$YELLOW"
echo ""

# Attempt 2: Try alternative package names
ATTEMPTS=$((ATTEMPTS + 1))
print_message "═══ FIX ATTEMPT $ATTEMPTS/$MAX_ATTEMPTS: Try alternative package names ═══" "$CYAN"
echo ""

if [ "$IS_TERMUX" = true ]; then
    print_message "📦 Searching for hydra alternatives..." "$BLUE"
    pkg search hydra 2>&1 | head -10
    echo ""
    
    # Try THC-Hydra specifically
    print_message "📥 Trying 'thc-hydra' package name..." "$BLUE"
    pkg install thc-hydra -y 2>&1 | grep -i "Installing\|hydra" || true
    echo ""
elif [ "$IS_DEBIAN" = true ]; then
    print_message "📥 Trying 'hydra-gtk' package..." "$BLUE"
    sudo apt install hydra-gtk -y 2>&1 | grep -i "Installing\|hydra" || true
    echo ""
fi

if check_hydra; then
    print_message "✅ SUCCESS! Hydra installed with alternative package!" "$GREEN"
    echo ""
    exit 0
fi

# Attempt 3: Compile from source
ATTEMPTS=$((ATTEMPTS + 1))
print_message "═══ FIX ATTEMPT $ATTEMPTS/$MAX_ATTEMPTS: Compile from source ═══" "$CYAN"
echo ""

print_message "📦 Installing build dependencies..." "$BLUE"
echo ""

if [ "$IS_TERMUX" = true ]; then
    pkg install git make clang libssh2 openssl libssl -y 2>&1 | grep -i "Installing\|Setting" | head -10 || true
elif [ "$IS_DEBIAN" = true ]; then
    sudo apt install git build-essential libssh-dev libssl-dev libpq-dev libmariadb-dev -y 2>&1 | grep -i "Installing\|Setting" | head -10 || true
elif [ "$IS_FEDORA" = true ]; then
    sudo dnf install git make gcc libssh-devel openssl-devel postgresql-devel mariadb-devel -y 2>&1 | grep -i "Installing" | head -10 || true
elif [ "$IS_ARCH" = true ]; then
    sudo pacman -S --noconfirm git make gcc libssh openssl postgresql-libs mariadb-libs 2>&1 | grep -i "Installing" | head -10 || true
fi

echo ""
print_message "📥 Cloning THC-Hydra from GitHub..." "$BLUE"

# Create temporary directory
TEMP_DIR="/tmp/hydra-build-$$"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

if git clone https://github.com/vanhauser-thc/thc-hydra.git 2>&1 | grep -i "Cloning\|Receiving\|done"; then
    echo ""
    cd thc-hydra || exit 1
    
    print_message "🔧 Configuring build..." "$BLUE"
    if ./configure 2>&1 | grep -i "checking\|found" | tail -10; then
        echo ""
        print_message "🔨 Compiling (this may take 2-5 minutes)..." "$BLUE"
        
        if make -j"$(nproc 2>/dev/null || echo 2)" 2>&1 | grep -i "CC\|LD\|built"; then
            echo ""
            print_message "📦 Installing hydra..." "$BLUE"
            
            if [ "$IS_TERMUX" = true ]; then
                make install 2>&1 | grep -i "install" || true
            else
                sudo make install 2>&1 | grep -i "install" || true
            fi
            
            echo ""
            
            # Update PATH if needed
            if [ "$IS_TERMUX" = true ]; then
                export PATH="$PREFIX/bin:$PATH"
            else
                export PATH="/usr/local/bin:$PATH"
            fi
            
            if check_hydra; then
                print_message "✅ SUCCESS! Hydra compiled and installed from source!" "$GREEN"
                echo ""
                hydra -h 2>&1 | head -3
                echo ""
                
                # Cleanup
                cd /
                rm -rf "$TEMP_DIR"
                exit 0
            fi
        fi
    fi
fi

print_message "⚠️  Source compilation failed. Trying final methods..." "$YELLOW"
echo ""

# Attempt 4: Try downloading pre-built binary
ATTEMPTS=$((ATTEMPTS + 1))
print_message "═══ FIX ATTEMPT $ATTEMPTS/$MAX_ATTEMPTS: Download pre-built binary ═══" "$CYAN"
echo ""

if [ "$IS_TERMUX" = true ]; then
    print_message "📥 Attempting to download pre-built ARM binary..." "$BLUE"
    
    # Try to find a pre-built binary
    HYDRA_BIN_URL="https://github.com/vanhauser-thc/thc-hydra/releases/latest/download/hydra"
    
    mkdir -p "$PREFIX/bin"
    if wget -q --show-progress "$HYDRA_BIN_URL" -O "$PREFIX/bin/hydra" 2>&1; then
        chmod +x "$PREFIX/bin/hydra"
        
        if check_hydra; then
            print_message "✅ SUCCESS! Pre-built binary downloaded!" "$GREEN"
            echo ""
            exit 0
        fi
    fi
fi

print_message "⚠️  Pre-built binary download failed." "$YELLOW"
echo ""

# Attempt 5: Manual troubleshooting guide
ATTEMPTS=$((ATTEMPTS + 1))
print_message "═══ FIX ATTEMPT $ATTEMPTS/$MAX_ATTEMPTS: Manual intervention needed ═══" "$CYAN"
echo ""

print_message "❌ Automatic fixes unsuccessful" "$RED"
echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

print_message "🆘 MANUAL STEPS REQUIRED:" "$YELLOW"
echo ""

if [ "$IS_TERMUX" = true ]; then
    print_message "For Termux, try these manual steps:" "$CYAN"
    echo ""
    echo "1. Check if hydra is in the repository:"
    print_message "   pkg search hydra" "$GREEN"
    echo ""
    echo "2. Try updating your Termux installation:"
    print_message "   pkg upgrade" "$GREEN"
    echo ""
    echo "3. Try installing from different repository:"
    print_message "   pkg install root-repo" "$GREEN"
    print_message "   pkg install hydra" "$GREEN"
    echo ""
    echo "4. Check Termux mirrors are working:"
    print_message "   termux-change-repo" "$GREEN"
    echo ""
    echo "5. As last resort, try older Termux version or different Android device"
    echo ""
else
    print_message "Try these manual installation methods:" "$CYAN"
    echo ""
    echo "1. Check your distribution's package search:"
    if [ "$IS_DEBIAN" = true ]; then
        print_message "   apt search hydra" "$GREEN"
        print_message "   apt-cache policy hydra" "$GREEN"
    elif [ "$IS_FEDORA" = true ]; then
        print_message "   dnf search hydra" "$GREEN"
    fi
    echo ""
    echo "2. Try enabling additional repositories"
    echo ""
    echo "3. Check if you have sufficient permissions (try with sudo)"
    echo ""
    echo "4. Visit THC-Hydra GitHub for manual compilation:"
    print_message "   https://github.com/vanhauser-thc/thc-hydra" "$GREEN"
    echo ""
fi

print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

print_message "📚 Additional Resources:" "$CYAN"
echo "  • Run: bash scripts/check_dependencies.sh"
echo "  • Read: docs/TROUBLESHOOTING.md"
echo "  • Visit: https://github.com/vinnieboy707/Hydra-termux/issues"
echo ""

print_message "💡 TIP: Copy error messages and search online for solutions" "$BLUE"
echo ""

# Cleanup
cd /
rm -rf "$TEMP_DIR" 2>/dev/null || true

# Offer to return to main menu
echo ""
print_message "═══════════════════════════════════════════════════════════" "$CYAN"
echo ""
read -r -p "Would you like to return to the main Hydra-Termux dashboard? (y/n): " return_choice

if [ "$return_choice" = "y" ] || [ "$return_choice" = "Y" ] || [ "$return_choice" = "yes" ]; then
    print_message "🏠 Returning to main dashboard..." "$GREEN"
    sleep 1
    
    # Get script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    
    # Launch main dashboard
    if [ -f "$SCRIPT_DIR/hydra.sh" ]; then
        exec bash "$SCRIPT_DIR/hydra.sh"
    else
        print_message "⚠️  Main dashboard not found at: $SCRIPT_DIR/hydra.sh" "$YELLOW"
        echo ""
    fi
else
    print_message "Exiting. Run './hydra.sh' to access the main dashboard anytime." "$BLUE"
fi

exit 1
