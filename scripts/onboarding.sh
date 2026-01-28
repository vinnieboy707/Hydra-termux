#!/bin/bash

# Hydra-Termux AI-Powered Onboarding Script
# Interactive step-by-step guide for new users with AI assistance

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Track user choices for AI learning
USER_PROFILE="$PROJECT_ROOT/.user_profile"
touch "$USER_PROFILE"

# Welcome banner
show_welcome() {
    clear
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         🤖 AI-POWERED ONBOARDING SYSTEM 🤖                   ║
║            HYDRA-TERMUX Ultimate Edition                      ║
║                                                               ║
║         Your Intelligent Guide to Ethical Hacking             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo ""
    print_message "          🚀 Welcome! I'm your AI assistant! 🚀" "$CYAN"
    echo ""
    print_message "I'll guide you through everything you need to know." "$GREEN"
    echo ""
    sleep 2
}

# Detect environment (development container, production, or local)
detect_environment() {
    if [ -f "/.dockerenv" ] || [ -n "$DEVELOPMENT_MODE" ]; then
        if [ "$DEVELOPMENT_MODE" = "true" ] || [ -f "/workspace/.devcontainer/devcontainer.json" ]; then
            echo "devcontainer"
        else
            echo "docker"
        fi
    else
        echo "local"
    fi
}

# Development Container Onboarding
dev_container_onboarding() {
    clear
    print_banner "🔧 Development Container Detected"
    echo ""
    
    print_message "🎉 Welcome to the Hydra-Termux Dev Container!" "$GREEN"
    echo ""
    echo "Your development environment is fully configured with:"
    echo "  ✅ All penetration testing tools pre-installed"
    echo "  ✅ PostgreSQL database (postgres-dev:5432)"
    echo "  ✅ Redis cache (redis-dev:6379)"
    echo "  ✅ Adminer database UI (localhost:8080)"
    echo "  ✅ Redis Insight (localhost:8001)"
    echo "  ✅ ShellCheck and linting tools"
    echo "  ✅ Hot reload enabled"
    echo ""
    
    print_message "🚀 Quick Start Commands:" "$CYAN"
    echo ""
    echo "  Development:"
    echo "    npm run dev           - Start all development servers"
    echo "    npm run dev:backend   - Backend only"
    echo "    npm run dev:frontend  - Frontend only"
    echo "    npm test              - Run tests"
    echo ""
    echo "  Hydra Tools:"
    echo "    ./hydra.sh            - Main Hydra interface"
    echo "    hydra-status          - Check service status"
    echo ""
    echo "  Database Management:"
    echo "    http://localhost:8080 - Adminer (PostgreSQL UI)"
    echo "    http://localhost:8001 - Redis Insight"
    echo ""
    
    read -p "Press Enter to continue with environment setup..." _
    
    # Run environment-specific setup
    dev_container_setup
}

# Development container setup
dev_container_setup() {
    clear
    print_banner "🔧 Setting Up Development Environment"
    echo ""
    
    # Check database connectivity
    print_message "Checking database connection..." "$CYAN"
    if PGPASSWORD=hydra_dev_pass psql -h postgres-dev -U hydra_dev -d hydra_dev_db -c '\q' 2>/dev/null; then
        log_success "✅ PostgreSQL is connected"
    else
        log_warning "⚠️  PostgreSQL connection failed - may need to wait for services to start"
    fi
    
    # Check Redis connectivity
    print_message "Checking Redis connection..." "$CYAN"
    if redis-cli -h redis-dev ping &>/dev/null; then
        log_success "✅ Redis is connected"
    else
        log_warning "⚠️  Redis connection failed - may need to wait for services to start"
    fi
    
    echo ""
    print_message "Development environment is ready!" "$GREEN"
    echo ""
    echo "💡 Tips for development:"
    echo "  • Use 'npm run dev' to start with hot reload"
    echo "  • Check 'hydra-status' for service status"
    echo "  • All changes are automatically synced to the container"
    echo "  • Database data persists between container restarts"
    echo ""
    
    read -p "Press Enter to continue..." _
}

# Choose onboarding path
choose_onboarding_path() {
    # Detect environment first
    local env_type
    env_type=$(detect_environment)
    
    # Declare validated_choice at function scope
    local validated_choice
    
    # If in dev container, show dev-specific onboarding option
    if [ "$env_type" = "devcontainer" ]; then
        clear
        print_banner "🎯 Choose Your Path (Development Mode)"
        echo ""
        
        print_message "Development Container Detected!" "$CYAN"
        echo ""
        echo "  1) 🔧 Dev Container Quick Start (Recommended)"
        echo "     Tailored for VS Code development container users"
        echo ""
        echo "  2) 🚀 Standard Quick Start (5 minutes)"
        echo "     Perfect for experienced users who want to start immediately"
        echo ""
        echo "  3) 📚 Complete Tutorial (15-20 minutes)"
        echo "     Comprehensive walkthrough of all features"
        echo ""
        echo "  4) 🎮 Interactive Practice Mode"
        echo "     Learn by doing with guided exercises"
        echo ""
        echo "  5) ⏭️  Skip Onboarding"
        echo "     Go directly to main menu"
        echo ""
        
        read -p "Enter your choice [1-5]: " path_choice
        
        case "$path_choice" in
            1)
                validated_choice="dev"
                ;;
            2)
                validated_choice="1"
                ;;
            3)
                validated_choice="2"
                ;;
            4)
                validated_choice="3"
                ;;
            5)
                validated_choice="4"
                ;;
            *)
                log_warning "Invalid choice, using Dev Container Quick Start"
                validated_choice="dev"
                ;;
        esac
    else
        clear
        print_banner "🎯 Choose Your Path"
        echo ""
        
        print_message "How would you like to proceed?" "$CYAN"
        echo ""
        echo "  1) 🚀 Quick Start (5 minutes)"
        echo "     Perfect for experienced users who want to start immediately"
        echo ""
        echo "  2) 📚 Complete Tutorial (15-20 minutes)"
        echo "     Comprehensive walkthrough of all features"
        echo ""
        echo "  3) 🎮 Interactive Practice Mode"
        echo "     Learn by doing with guided exercises"
        echo ""
        echo "  4) ⏭️  Skip Onboarding"
        echo "     Go directly to main menu (not recommended for first-time users)"
        echo ""
        
        read -p "Enter your choice [1-4]: " path_choice
        
        # Validate input to prevent file corruption
        case "$path_choice" in
            1|2|3|4)
                validated_choice="$path_choice"
                ;;
            *)
                log_warning "Invalid choice, defaulting to Quick Start"
                validated_choice="1"
                ;;
        esac
    fi
    
    echo "path=$validated_choice" >> "$USER_PROFILE"
    echo "environment=$env_type" >> "$USER_PROFILE"
    echo "$validated_choice"
}

# Choose onboarding path (original)
choose_onboarding_path_original() {
    clear
    print_banner "🎯 Choose Your Path"
    echo ""
    
    print_message "How would you like to proceed?" "$CYAN"
    echo ""
    echo "  1) 🚀 Quick Start (5 minutes)"
    echo "     Perfect for experienced users who want to start immediately"
    echo ""
    echo "  2) 📚 Complete Tutorial (15-20 minutes)"
    echo "     Comprehensive walkthrough of all features"
    echo ""
    echo "  3) 🎮 Interactive Practice Mode"
    echo "     Learn by doing with guided exercises"
    echo ""
    echo "  4) ⏭️  Skip Onboarding"
    echo "     Go directly to main menu (not recommended for first-time users)"
    echo ""
    
    read -p "Enter your choice [1-4]: " path_choice
    
    # Validate input to prevent file corruption
    local validated_choice
    case "$path_choice" in
        1|2|3|4)
            validated_choice="$path_choice"
            ;;
        *)
            log_warning "Invalid choice, defaulting to Quick Start"
            validated_choice="1"
            ;;
    esac
    
    echo "path=$validated_choice" >> "$USER_PROFILE"
    echo "$validated_choice"
}

# Quick start path
quick_start_path() {
    clear
    print_banner "🚀 Quick Start Guide"
    echo ""
    
    print_message "🤖 AI Assistant says:" "$CYAN"
    echo "Here's everything you need to get started quickly!"
    echo ""
    
    print_message "✅ Essential Steps:" "$GREEN"
    echo ""
    echo "1️⃣  Legal Agreement - Review terms and conditions"
    echo "2️⃣  System Check - Verify dependencies are installed"
    echo "3️⃣  Quick Setup - Get wordlists and configure"
    echo "4️⃣  First Task - Try your first safe scan"
    echo ""
    
    read -p "Ready to continue? (press Enter)" _
    
    # Run essential steps
    step_introduction_quick
    step_system_check
    step_quick_setup
    step_first_action_guide
}

# Complete tutorial path
complete_tutorial_path() {
    # Run all detailed steps
    step_introduction
    step_system_check
    step_tool_categories
    step_first_setup
    step_how_to_use
    step_alhacking_guide
    step_best_practices
    step_quick_start
}

# Interactive practice mode
interactive_practice_mode() {
    clear
    print_banner "🎮 Interactive Practice Mode"
    echo ""
    
    print_message "🤖 AI Assistant:" "$CYAN"
    echo "I'll guide you through hands-on exercises!"
    echo ""
    echo "Let's start with the basics and work our way up."
    echo ""
    
    # Run through practice exercises
    practice_exercise_1_setup
    practice_exercise_2_scanning
    practice_exercise_3_wordlists
    practice_exercise_4_safe_attack
}

# Step 1: Introduction (Quick Version)
step_introduction_quick() {
    clear
    print_banner "Step 1/4: Legal Agreement"
    echo ""
    
    print_message "⚠️  CRITICAL LEGAL NOTICE ⚠️" "$RED"
    echo ""
    echo "This tool is for EDUCATIONAL and AUTHORIZED TESTING ONLY!"
    echo ""
    echo "  • ✅ Only test systems YOU OWN or have WRITTEN PERMISSION"
    echo "  • ❌ Unauthorized access is ILLEGAL (jail time + fines)"
    echo "  • ⚖️  You are 100% RESPONSIBLE for your actions"
    echo ""
    
    read -p "I understand and agree to use this tool legally (yes/no): " agree
    
    if [[ ! "$agree" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_error "You must agree to the terms to continue."
        exit 1
    fi
    
    log_success "✓ Agreement accepted"
    sleep 1
}

# Step 1: Introduction (Detailed Version)
step_introduction() {
    clear
    print_banner "Step 1: Introduction"
    echo ""
    
    print_message "🤖 AI Assistant: Let me tell you about Hydra-Termux" "$CYAN"
    echo ""
    
    print_message "What is Hydra-Termux?" "$GREEN"
    echo ""
    echo "A comprehensive ethical hacking toolkit that includes:"
    echo ""
    echo "  🔐 Network Attack Tools"
    echo "     → SSH, FTP, RDP, SMB, Telnet brute-forcing"
    echo ""
    echo "  🌐 Web Application Testing"
    echo "     → Admin panel discovery and credential testing"
    echo ""
    echo "  💾 Database Penetration"
    echo "     → MySQL, PostgreSQL security assessment"
    echo ""
    echo "  🛠️ Additional Tools (ALHacking Suite)"
    echo "     → Phishing, DDoS, reconnaissance, and more"
    echo ""
    echo "  📊 Management Features"
    echo "     → Wordlist generation, reporting, logging"
    echo ""
    
    read -p "Press Enter to review legal requirements..." _
    
    clear
    print_banner "⚠️  LEGAL REQUIREMENTS ⚠️"
    echo ""
    
    print_message "WHAT IS LEGAL:" "$GREEN"
    echo "  ✓ Testing systems you own"
    echo "  ✓ Testing with written authorization"
    echo "  ✓ Educational labs and practice environments"
    echo "  ✓ Bug bounty programs with proper scope"
    echo "  ✓ Authorized penetration testing contracts"
    echo ""
    
    print_message "WHAT IS ILLEGAL:" "$RED"
    echo "  ✗ Testing systems without permission"
    echo "  ✗ Accessing others' accounts or data"
    echo "  ✗ Causing damage or disruption"
    echo "  ✗ Exceeding authorized scope"
    echo "  ✗ Not disclosing found vulnerabilities"
    echo ""
    
    print_message "CONSEQUENCES:" "$YELLOW"
    echo "  • Criminal prosecution"
    echo "  • Heavy fines (up to \$250,000+)"
    echo "  • Prison time (up to 20 years)"
    echo "  • Civil lawsuits"
    echo "  • Permanent criminal record"
    echo ""
    
    print_message "YOUR RESPONSIBILITY:" "$CYAN"
    echo "  • Get WRITTEN authorization before testing"
    echo "  • Stay within defined scope"
    echo "  • Document all activities"
    echo "  • Report vulnerabilities responsibly"
    echo "  • Use VPN for anonymity"
    echo ""
    
    read -p "Do you understand and agree to these terms? (yes/no): " agree
    
    if [[ ! "$agree" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_error "You must agree to the terms to continue."
        exit 1
    fi
    
    log_success "✓ Legal agreement accepted"
    echo "skill_level=beginner" >> "$USER_PROFILE"
    echo "legal_agreement=$(date +%Y-%m-%d)" >> "$USER_PROFILE"
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

# Quick setup helper
step_quick_setup() {
    clear
    print_banner "Step 3/4: Quick Setup"
    echo ""
    
    print_message "🤖 AI Assistant:" "$CYAN"
    echo "Let me help you set up the essentials!"
    echo ""
    
    # Create directories
    log_info "Creating necessary directories..."
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/reports"
    mkdir -p "$PROJECT_ROOT/results"
    mkdir -p "$HOME/wordlists"
    log_success "✓ Directories created"
    echo ""
    
    print_message "📚 Wordlists Setup" "$GREEN"
    echo ""
    echo "Wordlists contain common usernames and passwords."
    echo "They're essential for penetration testing."
    echo ""
    echo "Options:"
    echo "  1) Download now (recommended, ~5 minutes)"
    echo "  2) Download later (menu option 9)"
    echo "  3) Skip wordlists"
    echo ""
    
    read -p "Your choice [1-3]: " wl_choice
    
    case "$wl_choice" in
        1)
            log_info "Downloading wordlists..."
            # Log full (unfiltered) output to file while only showing filtered output to user
            local log_file
            log_file="$PROJECT_ROOT/logs/wordlist_download_$(date +%Y%m%d_%H%M%S).log"
            mkdir -p "$PROJECT_ROOT/logs"
            bash "$PROJECT_ROOT/scripts/download_wordlists.sh" --quick 2>&1 | tee "$log_file" | grep -E "(Downloading|Success|Complete|Error)" | head -10
            log_success "✓ Basic wordlists downloaded"
            log_info "Full log: $log_file"
            ;;
        2)
            log_info "✓ You can download wordlists later from option 9"
            ;;
        3)
            log_warning "⚠ Skipping wordlists (attacks may not work without them)"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..." _
}

# First action guide
step_first_action_guide() {
    clear
    print_banner "Step 4/4: Your First Task"
    echo ""
    
    print_message "🤖 AI Assistant: Let's try something safe!" "$CYAN"
    echo ""
    
    print_message "🎯 Safe First Steps:" "$GREEN"
    echo ""
    echo "I recommend starting with these safe actions:"
    echo ""
    echo "  1) 📊 View the Dashboard"
    echo "     See what features are available"
    echo ""
    echo "  2) 📖 Read Help & Documentation"
    echo "     Learn about all the tools"
    echo ""
    echo "  3) 🔍 Try IP Info Tool (Safe!)"
    echo "     Look up information about an IP address"
    echo ""
    echo "  4) 🎮 Practice Mode"
    echo "     Set up a safe test environment"
    echo ""
    
    read -p "What would you like to try? [1-4]: " first_action
    
    # Validate input before writing to file
    case "$first_action" in
        1)
            log_success "Great! The main menu will open next."
            ;;
        2)
            log_info "Opening help documentation..."
            if [ -f "$PROJECT_ROOT/README.md" ]; then
                less "$PROJECT_ROOT/README.md" 2>/dev/null || cat "$PROJECT_ROOT/README.md"
            fi
            ;;
        3)
            log_info "The IP Info tool will be available in the main menu (Option 26)"
            ;;
        4)
            practice_mode_intro
            ;;
        *)
            log_warning "Invalid choice, defaulting to dashboard"
            first_action="1"
            ;;
    esac
    
    echo ""
    echo "first_action=$first_action" >> "$USER_PROFILE"
    read -p "Press Enter to continue to main menu..." _
}

# Practice mode introduction
practice_mode_intro() {
    clear
    print_banner "🎮 Practice Mode"
    echo ""
    
    print_message "🤖 AI Assistant: Let me teach you the basics!" "$CYAN"
    echo ""
    
    echo "In practice mode, you'll learn:"
    echo ""
    echo "  ✓ How to set up safe test environments"
    echo "  ✓ How to scan targets for open ports"
    echo "  ✓ How to manage wordlists"
    echo "  ✓ How to launch your first safe attack"
    echo ""
    
    read -p "Start practice mode now? (y/n): " start_practice
    
    if [[ "$start_practice" =~ ^[Yy]$ ]]; then
        practice_exercise_1_setup
    else
        log_info "You can start practice mode anytime from the AI Assistant menu (Option 88)"
    fi
}

# Practice Exercise 1: Setup
practice_exercise_1_setup() {
    clear
    print_banner "🎮 Practice Exercise 1: Understanding the Layout"
    echo ""
    
    print_message "🤖 AI Instructor:" "$CYAN"
    echo "Let's understand where everything is stored!"
    echo ""
    
    print_message "📁 Directory Structure:" "$GREEN"
    echo ""
    echo "  ~/wordlists/         - Password and username lists"
    echo "  $PROJECT_ROOT/logs/         - Attack logs and histories"
    echo "  $PROJECT_ROOT/reports/      - Detailed attack reports"
    echo "  $PROJECT_ROOT/results/      - Discovered credentials"
    echo "  $PROJECT_ROOT/scripts/      - All attack scripts"
    echo "  $PROJECT_ROOT/config/       - Configuration files"
    echo ""
    
    print_message "💡 Pro Tip:" "$YELLOW"
    echo "Always check logs/ and reports/ folders after an attack!"
    echo ""
    
    read -p "Ready for next exercise? (press Enter)" _
    practice_exercise_2_scanning
}

# Practice Exercise 2: Scanning
practice_exercise_2_scanning() {
    clear
    print_banner "🎮 Practice Exercise 2: Safe Scanning"
    echo ""
    
    print_message "🤖 AI Instructor:" "$CYAN"
    echo "Let's learn about scanning WITHOUT attacking!"
    echo ""
    
    print_message "What is Scanning?" "$GREEN"
    echo ""
    echo "Scanning helps you discover:"
    echo "  • What ports are open on a target"
    echo "  • What services are running"
    echo "  • What protocols are available"
    echo ""
    
    print_message "Safe Scanning Practice:" "$YELLOW"
    echo ""
    echo "You can safely scan your own network:"
    echo ""
    echo "  Example: 192.168.1.1 (your router)"
    echo "  Example: 127.0.0.1 (your own computer)"
    echo ""
    
    echo "In the main menu, use Option 11 (Scan Target)"
    echo "to practice scanning safely!"
    echo ""
    
    read -p "Ready for next exercise? (press Enter)" _
    practice_exercise_3_wordlists
}

# Practice Exercise 3: Wordlists
practice_exercise_3_wordlists() {
    clear
    print_banner "🎮 Practice Exercise 3: Wordlists"
    echo ""
    
    print_message "🤖 AI Instructor:" "$CYAN"
    echo "Wordlists are the key to successful testing!"
    echo ""
    
    print_message "What are Wordlists?" "$GREEN"
    echo ""
    echo "Lists of common:"
    echo "  • Passwords (password, 123456, admin, etc.)"
    echo "  • Usernames (admin, root, user, etc.)"
    echo "  • Email addresses"
    echo "  • URLs and paths"
    echo ""
    
    print_message "How to Get Wordlists:" "$YELLOW"
    echo ""
    echo "  Option 9: Download from SecLists (comprehensive)"
    echo "  Option 10: Generate custom wordlists"
    echo ""
    
    print_message "💡 Pro Tips:" "$CYAN"
    echo "  • Bigger wordlists = more time but better coverage"
    echo "  • Targeted wordlists = faster and more effective"
    echo "  • Combine multiple wordlists for best results"
    echo ""
    
    read -p "Ready for next exercise? (press Enter)" _
    practice_exercise_4_safe_attack
}

# Practice Exercise 4: Safe Attack
practice_exercise_4_safe_attack() {
    clear
    print_banner "🎮 Practice Exercise 4: Your First Safe Attack"
    echo ""
    
    print_message "🤖 AI Instructor:" "$CYAN"
    echo "Let's talk about safe practice environments!"
    echo ""
    
    print_message "Safe Testing Options:" "$GREEN"
    echo ""
    echo "  1️⃣  Local Test Environments"
    echo "     • Docker containers"
    echo "     • Virtual machines (VirtualBox, VMware)"
    echo "     • Local services (your own server)"
    echo ""
    echo "  2️⃣  Legal Practice Platforms"
    echo "     • HackTheBox (hackthebox.eu)"
    echo "     • TryHackMe (tryhackme.com)"
    echo "     • OverTheWire (overthewire.org)"
    echo "     • PentesterLab (pentesterlab.com)"
    echo ""
    echo "  3️⃣  Intentionally Vulnerable Apps"
    echo "     • DVWA (Damn Vulnerable Web App)"
    echo "     • Metasploitable"
    echo "     • WebGoat"
    echo ""
    
    print_message "⚠️  NEVER:" "$RED"
    echo "  • Test public websites without permission"
    echo "  • Test your work/school networks"
    echo "  • Test your ISP or cloud providers"
    echo "  • Test anything you don't explicitly own"
    echo ""
    
    print_message "✅ When You're Ready:" "$CYAN"
    echo "  1. Set up a safe environment"
    echo "  2. Use Option 11 to scan it"
    echo "  3. Choose appropriate attack (Options 1-8)"
    echo "  4. Review results (Option 12)"
    echo "  5. Check reports (Option 15)"
    echo ""
    
    log_success "🎓 Practice exercises complete!"
    echo ""
    echo "You're ready to start using Hydra-Termux safely!"
    echo ""
    read -p "Press Enter to continue to main menu..." _
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
    
    read -p "Press Enter to continue..."
}

# Final step
step_completion() {
    clear
    print_banner "🎉 Onboarding Complete!"
    echo ""
    
    print_message "🤖 AI Assistant:" "$CYAN"
    echo "Congratulations! You're all set up and ready to go!"
    echo ""
    
    print_message "✅ What You've Learned:" "$GREEN"
    echo "  • Legal and ethical requirements"
    echo "  • System setup and dependencies"
    echo "  • Tool categories and features"
    echo "  • Safe practice environments"
    echo "  • How to use the main menu"
    echo ""
    
    print_message "🚀 Next Steps:" "$YELLOW"
    echo "  1. The main menu will open in 3 seconds"
    echo "  2. Try Option 18 for Help & Documentation"
    echo "  3. Use Option 88 for AI Assistant anytime"
    echo "  4. Check Option 89 for Workflow Guides"
    echo ""
    
    print_message "💡 AI Tips:" "$CYAN"
    echo "  • I'm always here to help (Option 88)"
    echo "  • Check your progress anytime (Option 90)"
    echo "  • Get smart suggestions (Option 91)"
    echo "  • Watch for contextual hints throughout"
    echo ""
    
    print_message "🛡️ Remember:" "$RED"
    echo "  • Always act legally and ethically"
    echo "  • Test only authorized systems"
    echo "  • Document your activities"
    echo "  • Use VPN for anonymity"
    echo ""
    
    log_success "🎓 Onboarding completed successfully!"
    echo ""
    log_info "Launching main menu in 3 seconds..."
    
    # Mark onboarding as complete
    touch "$PROJECT_ROOT/.onboarding_complete"
    echo "completed=$(date +%Y-%m-%d_%H:%M:%S)" >> "$USER_PROFILE"
    
    sleep 3
}

# Main onboarding flow
main() {
    show_welcome
    
    # Choose path
    local path
    path=$(choose_onboarding_path)
    
    case "$path" in
        dev)
            # Development Container Path
            dev_container_onboarding
            quick_start_path
            ;;
        1)
            # Quick Start
            quick_start_path
            ;;
        2)
            # Complete Tutorial
            complete_tutorial_path
            ;;
        3)
            # Interactive Practice
            interactive_practice_mode
            ;;
        4)
            # Skip Onboarding
            log_info "Skipping onboarding..."
            touch "$PROJECT_ROOT/.onboarding_complete"
            echo "skipped=$(date +%Y-%m-%d_%H:%M:%S)" >> "$USER_PROFILE"
            return 0
            ;;
        *)
            # Default to quick start
            log_warning "Invalid choice, using Quick Start..."
            quick_start_path
            ;;
    esac
    
    # Complete onboarding
    step_completion
}

# Run main function
main
