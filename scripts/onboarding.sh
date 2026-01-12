#!/bin/bash

# Hydra-Termux Onboarding Script
# Step-by-step guide for new users

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Welcome banner
show_welcome() {
    clear
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            🎓 WELCOME TO HYDRA-TERMUX 🎓                     ║
║                  Ultimate Edition                             ║
║                                                               ║
║               Step-by-Step Onboarding Guide                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo ""
    print_message "          Let's get you started! 🚀" "$CYAN"
    echo ""
    sleep 2
}

# Step 1: Introduction
step_introduction() {
    clear
    print_banner "Step 1: Introduction"
    echo ""
    
    print_message "What is Hydra-Termux?" "$CYAN"
    echo ""
    echo "Hydra-Termux is a powerful ethical hacking toolkit that includes:"
    echo ""
    echo "  ✓ Network attack tools (SSH, FTP, RDP, SMB, etc.)"
    echo "  ✓ Web application security testing"
    echo "  ✓ Database penetration testing"
    echo "  ✓ Additional hacking tools from ALHacking suite"
    echo "  ✓ Wordlist management and generation"
    echo "  ✓ Comprehensive reporting and logging"
    echo ""
    
    print_message "⚠️  IMPORTANT LEGAL NOTICE ⚠️" "$RED"
    echo ""
    echo "This tool is for EDUCATIONAL and AUTHORIZED TESTING ONLY!"
    echo ""
    echo "  • Only use on systems you own or have permission to test"
    echo "  • Unauthorized access to computer systems is ILLEGAL"
    echo "  • You are responsible for your actions"
    echo "  • The developers assume NO liability for misuse"
    echo ""
    
    read -p "Do you understand and agree? (yes/no): " agree
    
    if [[ ! "$agree" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_error "You must agree to the terms to continue."
        exit 1
    fi
    
    log_success "Great! Let's continue..."
    sleep 2
}

# Step 2: System Check
step_system_check() {
    clear
    print_banner "Step 2: System Check"
    echo ""
    
    log_info "Checking your system..."
    echo ""
    
    # Check OS
    if [ -d "/data/data/com.termux" ]; then
        log_success "✓ Running on Termux (Android)"
    else
        log_success "✓ Running on Linux/Unix"
    fi
    
    # Check critical dependencies
    local missing_deps=()
    
    if ! command -v hydra >/dev/null 2>&1; then
        missing_deps+=("hydra")
    fi
    
    if ! command -v git >/dev/null 2>&1; then
        missing_deps+=("git")
    fi
    
    if ! command -v python3 >/dev/null 2>&1; then
        missing_deps+=("python3")
    fi
    
    if [ ${#missing_deps[@]} -eq 0 ]; then
        log_success "✓ All critical dependencies installed!"
    else
        log_warning "⚠ Missing dependencies: ${missing_deps[*]}"
        echo ""
        read -p "Would you like to install missing dependencies now? (y/n): " install_deps
        
        if [[ "$install_deps" =~ ^[Yy]$ ]]; then
            log_info "Installing dependencies..."
            bash "$SCRIPT_DIR/../install.sh"
        else
            log_warning "Please install dependencies manually later."
        fi
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Step 3: Tool Categories
step_tool_categories() {
    clear
    print_banner "Step 3: Understanding Tool Categories"
    echo ""
    
    print_message "Hydra-Termux has 4 main categories:" "$CYAN"
    echo ""
    
    print_message "1️⃣  ATTACK SCRIPTS (Options 1-8)" "$GREEN"
    echo "   • SSH, FTP, Web, RDP, MySQL, PostgreSQL, SMB attacks"
    echo "   • Multi-protocol auto attack"
    echo "   • Uses THC-Hydra for brute-force attacks"
    echo ""
    
    print_message "2️⃣  UTILITIES (Options 9-12)" "$GREEN"
    echo "   • Download and manage wordlists"
    echo "   • Generate custom wordlists"
    echo "   • Scan targets for open ports"
    echo "   • View attack results"
    echo ""
    
    print_message "3️⃣  MANAGEMENT (Options 13-17)" "$GREEN"
    echo "   • View configuration and logs"
    echo "   • Generate attack reports"
    echo "   • Export results"
    echo "   • Update the tool"
    echo ""
    
    print_message "4️⃣  ALHACKING TOOLS (Options 20-37)" "$GREEN"
    echo "   • Phishing tools"
    echo "   • DDoS attack tools"
    echo "   • Information gathering"
    echo "   • Social media tools"
    echo "   • IP tracking and manipulation"
    echo ""
    
    read -p "Press Enter to continue..."
}

# Step 4: First Time Setup
step_first_setup() {
    clear
    print_banner "Step 4: First Time Setup"
    echo ""
    
    log_info "Let's set up your environment..."
    echo ""
    
    # Create necessary directories
    log_info "Creating directory structure..."
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/reports"
    mkdir -p "$PROJECT_ROOT/results"
    mkdir -p "$PROJECT_ROOT/Tools"
    mkdir -p "$HOME/wordlists"
    
    log_success "✓ Directories created"
    echo ""
    
    # Offer to download wordlists
    print_message "Wordlists Setup" "$CYAN"
    echo ""
    echo "Wordlists are essential for brute-force attacks."
    echo "They contain common usernames and passwords."
    echo ""
    read -p "Would you like to download popular wordlists now? (y/n): " download_wl
    
    if [[ "$download_wl" =~ ^[Yy]$ ]]; then
        log_info "This may take a few minutes..."
        bash "$PROJECT_ROOT/scripts/download_wordlists.sh" --all
    else
        log_info "You can download wordlists later from option 9."
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Step 5: How to Use
step_how_to_use() {
    clear
    print_banner "Step 5: How to Use Hydra-Termux"
    echo ""
    
    print_message "📖 Basic Usage Guide" "$CYAN"
    echo ""
    
    print_message "Example 1: SSH Attack" "$GREEN"
    echo "  1. Select option 1 from main menu"
    echo "  2. Enter target IP (e.g., 192.168.1.100)"
    echo "  3. Tool will use default wordlists"
    echo "  4. Results are saved automatically"
    echo ""
    
    print_message "Example 2: Web Admin Attack" "$GREEN"
    echo "  1. Select option 3 from main menu"
    echo "  2. Enter target URL or IP"
    echo "  3. Tool tests common admin panels"
    echo "  4. Check reports folder for results"
    echo ""
    
    print_message "Example 3: Target Scanning" "$GREEN"
    echo "  1. Select option 11 (Scan Target)"
    echo "  2. Enter target IP or range"
    echo "  3. View open ports and services"
    echo "  4. Use results to choose attack type"
    echo ""
    
    print_message "💡 Pro Tips" "$YELLOW"
    echo "  • Always scan targets first (option 11)"
    echo "  • Download wordlists before attacking (option 9)"
    echo "  • Check logs regularly (option 14)"
    echo "  • View attack reports (option 15)"
    echo "  • Use custom wordlists for better results (option 10)"
    echo ""
    
    read -p "Press Enter to continue..."
}

# Step 6: ALHacking Tools Guide
step_alhacking_guide() {
    clear
    print_banner "Step 6: ALHacking Tools Guide"
    echo ""
    
    print_message "📚 ALHacking Tools Overview" "$CYAN"
    echo ""
    
    echo "The ALHacking suite includes 18 specialized tools:"
    echo ""
    
    print_message "🎣 Phishing & Social Engineering:" "$GREEN"
    echo "  • Option 21: Phishing Tool (zphisher)"
    echo "  • Option 22: WebCam Hack (CamPhish)"
    echo "  • Option 33: Facebash (Facebook brute force)"
    echo "  • Option 32: BadMod (Instagram brute force)"
    echo ""
    
    print_message "🔍 Information Gathering:" "$GREEN"
    echo "  • Option 26: IP Info (track IP addresses)"
    echo "  • Option 23: Subscan (subdomain scanner)"
    echo "  • Option 27: dorks-eye (Google dorking)"
    echo "  • Option 29: RED_HAWK (website recon)"
    echo "  • Option 31: Info-Site (site information)"
    echo ""
    
    print_message "⚔️ Attack Tools:" "$GREEN"
    echo "  • Option 25: DDOS Attack (DDoS-Ripper)"
    echo "  • Option 24: Gmail Bomber"
    echo "  • Option 28: HackerPro (multi-tool)"
    echo "  • Option 34: DARKARMY (multi-tool)"
    echo ""
    
    print_message "🛠️ Utilities:" "$GREEN"
    echo "  • Option 20: Requirements & Update"
    echo "  • Option 35: AUTO-IP-CHANGER"
    echo "  • Option 36: Usage Help"
    echo "  • Option 37: Uninstall Tools"
    echo ""
    
    print_message "⚠️  First Time Use:" "$YELLOW"
    echo "  1. Run option 20 first to install dependencies"
    echo "  2. Each tool auto-downloads on first use"
    echo "  3. Tools are saved in Tools/ directory"
    echo ""
    
    read -p "Press Enter to continue..."
}

# Step 7: Best Practices
step_best_practices() {
    clear
    print_banner "Step 7: Best Practices & Safety"
    echo ""
    
    print_message "🛡️ Security Best Practices" "$CYAN"
    echo ""
    
    print_message "1. Use VPN or Proxy" "$YELLOW"
    echo "   • Hide your real IP address"
    echo "   • Use option 35 (AUTO-IP-CHANGER) for Tor"
    echo "   • Never attack without protection"
    echo ""
    
    print_message "2. Test on Your Own Systems" "$YELLOW"
    echo "   • Set up a test lab"
    echo "   • Use virtual machines"
    echo "   • Practice legally"
    echo ""
    
    print_message "3. Keep Records" "$YELLOW"
    echo "   • Document all activities"
    echo "   • Save authorization letters"
    echo "   • Keep attack reports (option 15)"
    echo ""
    
    print_message "4. Stay Updated" "$YELLOW"
    echo "   • Run option 17 regularly"
    echo "   • Update wordlists (option 9)"
    echo "   • Check for new features"
    echo ""
    
    print_message "5. Responsible Disclosure" "$YELLOW"
    echo "   • Report vulnerabilities ethically"
    echo "   • Give time to patch"
    echo "   • Don't exploit for harm"
    echo ""
    
    read -p "Press Enter to continue..."
}

# Step 8: Quick Start
step_quick_start() {
    clear
    print_banner "Step 8: Quick Start Checklist"
    echo ""
    
    print_message "✅ Before Your First Attack:" "$CYAN"
    echo ""
    
    echo "  ☐ Ensure you have legal authorization"
    echo "  ☐ Install dependencies (option 20 for ALHacking)"
    echo "  ☐ Download wordlists (option 9)"
    echo "  ☐ Scan your target (option 11)"
    echo "  ☐ Choose appropriate attack type"
    echo "  ☐ Check results (option 12)"
    echo "  ☐ Review reports (option 15)"
    echo ""
    
    print_message "📚 Additional Resources:" "$CYAN"
    echo ""
    echo "  • Help & Documentation: Option 18"
    echo "  • ALHacking Tutorial: Option 36"
    echo "  • README.md in project root"
    echo "  • docs/ folder for detailed guides"
    echo ""
    
    print_message "🎯 Recommended First Steps:" "$GREEN"
    echo ""
    echo "  1. Run option 20 (Requirements & Update)"
    echo "  2. Run option 9 (Download Wordlists)"
    echo "  3. Try option 11 (Scan Target) on your own system"
    echo "  4. Review the results and logs"
    echo ""
}

# Final step
step_completion() {
    clear
    print_banner "🎉 Onboarding Complete!"
    echo ""
    
    log_success "You're all set up and ready to go!"
    echo ""
    
    print_message "Remember:" "$YELLOW"
    echo "  • Always act legally and ethically"
    echo "  • Test only on authorized systems"
    echo "  • Keep learning and stay curious"
    echo "  • Use these tools responsibly"
    echo ""
    
    print_message "Need Help?" "$CYAN"
    echo "  • Option 18: Help & Documentation"
    echo "  • Option 36: ALHacking Usage Tutorial"
    echo "  • GitHub Issues: Report bugs or ask questions"
    echo ""
    
    log_info "Launching main menu in 3 seconds..."
    sleep 3
    
    # Mark onboarding as complete
    touch "$PROJECT_ROOT/.onboarding_complete"
}

# Main onboarding flow
main() {
    show_welcome
    step_introduction
    step_system_check
    step_tool_categories
    step_first_setup
    step_how_to_use
    step_alhacking_guide
    step_best_practices
    step_quick_start
    step_completion
}

# Run main function
main
