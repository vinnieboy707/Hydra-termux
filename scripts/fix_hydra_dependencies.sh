#!/bin/bash

# Hydra Dependencies Fix Script
# Resolves compilation issues for THC-Hydra on Termux/Linux
# Addresses: PostgreSQL, MySQL, MongoDB, SMB, and GUI library issues

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect platform
detect_platform() {
    if [ -d "/data/data/com.termux" ]; then
        PLATFORM="termux"
    elif [ -f "/etc/debian_version" ]; then
        PLATFORM="debian"
    elif [ -f "/etc/redhat-release" ]; then
        PLATFORM="redhat"
    elif [ -f "/etc/arch-release" ]; then
        PLATFORM="arch"
    else
        PLATFORM="unknown"
    fi
}

# Print banner
print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║           🔧 HYDRA DEPENDENCIES FIX UTILITY 🔧                ║
║                                                               ║
║     Resolves compilation issues for THC-Hydra                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Install build dependencies for Termux
install_termux_deps() {
    echo -e "${YELLOW}📦 Installing Hydra build dependencies for Termux...${NC}"
    
    # Core build tools
    pkg install -y clang make autoconf automake libtool pkg-config 2>&1 | grep -v "^Reading"
    
    # SSL/TLS support
    pkg install -y openssl openssl-tool 2>&1 | grep -v "^Reading"
    
    # PostgreSQL support
    pkg install -y postgresql libpq 2>&1 | grep -v "^Reading"
    
    # MySQL/MariaDB support
    pkg install -y mariadb 2>&1 | grep -v "^Reading"
    
    # SSH support
    pkg install -y libssh 2>&1 | grep -v "^Reading"
    
    # Other protocol support
    pkg install -y libpcre zlib libidn2 2>&1 | grep -v "^Reading"
    
    # SVN support
    pkg install -y subversion 2>&1 | grep -v "^Reading"
    
    echo -e "${GREEN}✅ Termux dependencies installed${NC}"
}

# Install build dependencies for Debian/Ubuntu
install_debian_deps() {
    echo -e "${YELLOW}📦 Installing Hydra build dependencies for Debian/Ubuntu...${NC}"
    
    sudo apt-get update -qq
    
    # Core build tools
    sudo apt-get install -y build-essential autoconf automake libtool pkg-config 2>&1 | grep -v "^Reading"
    
    # SSL/TLS support
    sudo apt-get install -y libssl-dev 2>&1 | grep -v "^Reading"
    
    # PostgreSQL support
    sudo apt-get install -y libpq-dev postgresql-client 2>&1 | grep -v "^Reading"
    
    # MySQL support
    sudo apt-get install -y libmysqlclient-dev default-libmysqlclient-dev 2>&1 | grep -v "^Reading"
    
    # MongoDB support
    sudo apt-get install -y libmongoc-dev libbson-dev 2>&1 | grep -v "^Reading"
    
    # SMB support
    sudo apt-get install -y libsmbclient-dev 2>&1 | grep -v "^Reading"
    
    # SSH support
    sudo apt-get install -y libssh-dev 2>&1 | grep -v "^Reading"
    
    # Other protocol support
    sudo apt-get install -y libpcre3-dev zlib1g-dev libidn2-dev libsvn-dev 2>&1 | grep -v "^Reading"
    
    echo -e "${GREEN}✅ Debian/Ubuntu dependencies installed${NC}"
}

# Install build dependencies for Red Hat/CentOS/Fedora
install_redhat_deps() {
    echo -e "${YELLOW}📦 Installing Hydra build dependencies for Red Hat/CentOS/Fedora...${NC}"
    
    # Core build tools
    sudo yum install -y gcc make autoconf automake libtool pkgconfig 2>&1 | grep -v "^Loading"
    
    # SSL/TLS support
    sudo yum install -y openssl-devel 2>&1 | grep -v "^Loading"
    
    # PostgreSQL support
    sudo yum install -y postgresql-devel 2>&1 | grep -v "^Loading"
    
    # MySQL support
    sudo yum install -y mysql-devel 2>&1 | grep -v "^Loading"
    
    # SMB support
    sudo yum install -y libsmbclient-devel 2>&1 | grep -v "^Loading"
    
    # SSH support
    sudo yum install -y libssh-devel 2>&1 | grep -v "^Loading"
    
    # Other protocol support
    sudo yum install -y pcre-devel zlib-devel libidn2-devel subversion-devel 2>&1 | grep -v "^Loading"
    
    echo -e "${GREEN}✅ Red Hat/CentOS/Fedora dependencies installed${NC}"
}

# Install build dependencies for Arch Linux
install_arch_deps() {
    echo -e "${YELLOW}📦 Installing Hydra build dependencies for Arch Linux...${NC}"
    
    # Core build tools
    sudo pacman -S --noconfirm base-devel autoconf automake libtool pkg-config 2>&1 | grep -v "^::"
    
    # SSL/TLS support
    sudo pacman -S --noconfirm openssl 2>&1 | grep -v "^::"
    
    # PostgreSQL support
    sudo pacman -S --noconfirm postgresql-libs 2>&1 | grep -v "^::"
    
    # MySQL support
    sudo pacman -S --noconfirm mariadb-libs 2>&1 | grep -v "^::"
    
    # MongoDB support
    sudo pacman -S --noconfirm mongo-c-driver 2>&1 | grep -v "^::"
    
    # SMB support
    sudo pacman -S --noconfirm smbclient 2>&1 | grep -v "^::"
    
    # SSH support
    sudo pacman -S --noconfirm libssh 2>&1 | grep -v "^::"
    
    # Other protocol support
    sudo pacman -S --noconfirm pcre zlib libidn2 subversion 2>&1 | grep -v "^::"
    
    echo -e "${GREEN}✅ Arch Linux dependencies installed${NC}"
}

# Compile Hydra from source with all features
compile_hydra() {
    echo -e "${CYAN}🔨 Compiling THC-Hydra from source...${NC}"
    
    # Create temp directory
    TEMP_DIR="/tmp/hydra_build_$$"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR" || exit 1
    
    # Clone latest Hydra
    echo -e "${YELLOW}📥 Downloading THC-Hydra source...${NC}"
    git clone --depth 1 https://github.com/vanhauser-thc/thc-hydra.git > /dev/null 2>&1
    
    if [ ! -d "thc-hydra" ]; then
        echo -e "${RED}❌ Failed to download Hydra source${NC}"
        return 1
    fi
    
    cd thc-hydra || exit 1
    
    # Configure with maximum compatibility
    echo -e "${YELLOW}⚙️  Configuring build (this may take a minute)...${NC}"
    ./configure --prefix=/usr/local 2>&1 | grep -E "Checking|found|enabled|disabled" | tail -20
    
    # Compile
    echo -e "${YELLOW}🔨 Compiling (this may take 2-5 minutes)...${NC}"
    make -j$(nproc 2>/dev/null || echo 2) > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Compilation failed${NC}"
        echo -e "${YELLOW}ℹ️  Showing last 20 lines of errors:${NC}"
        make 2>&1 | tail -20
        return 1
    fi
    
    # Install
    echo -e "${YELLOW}📦 Installing Hydra...${NC}"
    if [ "$PLATFORM" = "termux" ]; then
        make install > /dev/null 2>&1
    else
        sudo make install > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Hydra successfully compiled and installed${NC}"
        
        # Verify installation
        if command -v hydra &> /dev/null; then
            echo -e "${GREEN}✅ Hydra is now available: $(which hydra)${NC}"
            hydra -h 2>&1 | head -5
            return 0
        fi
    fi
    
    echo -e "${RED}❌ Installation verification failed${NC}"
    return 1
}

# Install pre-built Hydra binary (fallback)
install_prebuilt() {
    echo -e "${CYAN}📦 Installing pre-built Hydra package...${NC}"
    
    case "$PLATFORM" in
        termux)
            pkg install -y hydra 2>&1 | grep -v "^Reading"
            ;;
        debian)
            sudo apt-get install -y hydra 2>&1 | grep -v "^Reading"
            ;;
        redhat)
            sudo yum install -y hydra 2>&1 | grep -v "^Loading"
            ;;
        arch)
            sudo pacman -S --noconfirm hydra 2>&1 | grep -v "^::"
            ;;
        *)
            echo -e "${RED}❌ Unknown platform, cannot install pre-built package${NC}"
            return 1
            ;;
    esac
    
    if command -v hydra &> /dev/null; then
        echo -e "${GREEN}✅ Hydra installed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to install Hydra package${NC}"
        return 1
    fi
}

# Main execution
main() {
    clear
    print_banner
    
    # Detect platform
    detect_platform
    echo -e "${BLUE}🖥️  Detected platform: ${PLATFORM}${NC}"
    echo ""
    
    # Check if Hydra is already installed
    if command -v hydra &> /dev/null; then
        echo -e "${GREEN}✅ Hydra is already installed: $(which hydra)${NC}"
        hydra -h 2>&1 | head -3
        echo ""
        read -r -p "Do you want to reinstall/upgrade? (y/n): " reinstall
        if [ "$reinstall" != "y" ]; then
            echo -e "${BLUE}ℹ️  Exiting without changes${NC}"
            exit 0
        fi
        echo ""
    fi
    
    # Install dependencies based on platform
    case "$PLATFORM" in
        termux)
            install_termux_deps
            ;;
        debian)
            install_debian_deps
            ;;
        redhat)
            install_redhat_deps
            ;;
        arch)
            install_arch_deps
            ;;
        *)
            echo -e "${RED}❌ Unsupported platform: $PLATFORM${NC}"
            echo -e "${YELLOW}ℹ️  Please install dependencies manually${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    
    # Ask user for installation method
    echo -e "${CYAN}📋 Select installation method:${NC}"
    echo -e "  ${GREEN}1${NC}) Compile from source (recommended, all features)"
    echo -e "  ${YELLOW}2${NC}) Install pre-built package (faster, may have fewer features)"
    echo -e "  ${RED}3${NC}) Skip installation"
    echo ""
    read -r -p "Enter choice (1-3): " install_choice
    
    case "$install_choice" in
        1)
            compile_hydra
            ;;
        2)
            install_prebuilt
            ;;
        3)
            echo -e "${BLUE}ℹ️  Skipping Hydra installation${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    
    # Final verification
    if command -v hydra &> /dev/null; then
        echo -e "${GREEN}"
        cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                    ✅ SUCCESS! ✅                              ║
║                                                               ║
║          Hydra is now installed and ready to use!            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
        echo -e "${NC}"
        
        echo -e "${CYAN}📊 Hydra Information:${NC}"
        echo -e "  Location: ${GREEN}$(which hydra)${NC}"
        echo -e "  Version:  ${GREEN}$(hydra -h 2>&1 | grep -i "hydra" | head -1)${NC}"
        echo ""
        echo -e "${CYAN}🚀 Next Steps:${NC}"
        echo -e "  1. Run: ${YELLOW}./hydra.sh${NC} to start the main menu"
        echo -e "  2. Try: ${YELLOW}hydra -h${NC} to see all options"
        echo -e "  3. Test: ${YELLOW}bash scripts/check_dependencies.sh${NC} to verify setup"
        
    else
        echo -e "${RED}"
        cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                    ❌ INSTALLATION FAILED ❌                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
        echo -e "${NC}"
        
        echo -e "${YELLOW}📚 Troubleshooting Resources:${NC}"
        echo -e "  1. Visit: ${BLUE}https://github.com/vanhauser-thc/thc-hydra${NC}"
        echo -e "  2. Check: ${BLUE}https://github.com/vinnieboy707/Hydra-termux/issues${NC}"
        echo -e "  3. Read: ${BLUE}docs/TROUBLESHOOTING.md${NC}"
        echo ""
        echo -e "${YELLOW}💡 Manual Installation:${NC}"
        echo -e "  ${CYAN}# Termux:${NC}"
        echo -e "    pkg install hydra"
        echo -e "  ${CYAN}# Debian/Ubuntu:${NC}"
        echo -e "    sudo apt-get install hydra"
        echo -e "  ${CYAN}# Red Hat/CentOS:${NC}"
        echo -e "    sudo yum install hydra"
        exit 1
    fi
}

# Run main function
main "$@"
