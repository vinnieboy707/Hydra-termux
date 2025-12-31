#!/bin/bash

# Hydra-Termux Smart Help
# One-stop troubleshooting assistant

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

clear

cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║               🆘 HYDRA-TERMUX HELP CENTER 🆘                  ║
║                                                               ║
║        Having problems? You're in the right place!           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF

echo ""
print_message "👋 Welcome to the Hydra-Termux Help Center!" "$CYAN"
echo ""
print_message "This tool will help diagnose and fix your issues automatically." "$BLUE"
echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

# Quick check if hydra is installed
HYDRA_INSTALLED=false
if command -v hydra &> /dev/null; then
    HYDRA_INSTALLED=true
fi

# Determine user's issue
print_message "What problem are you experiencing?" "$CYAN"
echo ""
echo "  1) Hydra is not installed / \"Command not found: hydra\""
echo "  2) Scripts won't run / Permission denied"
echo "  3) Attacks always fail / No results"
echo "  4) Installation failed / Packages won't install"
echo "  5) System is slow / Out of memory"
echo "  6) Not sure / Just run full diagnostics"
echo "  7) Show me all available help tools"
echo ""
read -r -p "Enter your choice [1-7]: " problem_choice

echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""

case $problem_choice in
    1)
        print_message "🔧 ISSUE: Hydra Not Installed" "$MAGENTA"
        echo ""
        
        if [ "$HYDRA_INSTALLED" = true ]; then
            print_message "✅ Good news! Hydra IS installed on your system." "$GREEN"
            hydra -h 2>&1 | head -1
            echo ""
            print_message "If you're still seeing errors, the problem might be:" "$YELLOW"
            echo "  • You're not in the correct directory"
            echo "  • Scripts don't have execute permissions"
            echo "  • There's a different issue"
            echo ""
            print_message "Let me run diagnostics to find the real problem..." "$BLUE"
            echo ""
            sleep 2
            bash scripts/system_diagnostics.sh
        else
            print_message "❌ Confirmed: Hydra is NOT installed." "$RED"
            echo ""
            print_message "This is the most common issue. Let me fix it for you!" "$BLUE"
            echo ""
            print_message "Starting automatic repair in 3 seconds..." "$YELLOW"
            sleep 3
            echo ""
            bash scripts/auto_fix.sh
        fi
        ;;
        
    2)
        print_message "🔧 ISSUE: Permission Problems" "$MAGENTA"
        echo ""
        print_message "Fixing file permissions..." "$BLUE"
        
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
        
        cd "$PROJECT_ROOT" || { print_message "❌ Failed to change directory" "$RED"; return; }
        
        print_message "  • Making hydra.sh executable..." "$BLUE"
        if chmod +x hydra.sh 2>/dev/null; then
            print_message "    ✅ Done" "$GREEN"
        else
            print_message "    ❌ Failed" "$RED"
        fi
        
        print_message "  • Making install.sh executable..." "$BLUE"
        if chmod +x install.sh 2>/dev/null; then
            print_message "    ✅ Done" "$GREEN"
        else
            print_message "    ❌ Failed" "$RED"
        fi
        
        print_message "  • Making all scripts executable..." "$BLUE"
        if chmod +x scripts/*.sh 2>/dev/null; then
            print_message "    ✅ Done" "$GREEN"
        else
            print_message "    ❌ Failed" "$RED"
        fi
        
        print_message "  • Making Library scripts executable..." "$BLUE"
        if chmod +x Library/*.sh 2>/dev/null; then
            print_message "    ✅ Done" "$GREEN"
        else
            print_message "    ❌ Failed" "$RED"
        fi
        
        echo ""
        print_message "✅ Permissions fixed!" "$GREEN"
        echo ""
        print_message "Try running your command again:" "$CYAN"
        print_message "  ./hydra.sh" "$GREEN"
        echo ""
        ;;
        
    3)
        print_message "🔧 ISSUE: Attacks Fail / No Results" "$MAGENTA"
        echo ""
        print_message "Let me check your system and provide diagnostics..." "$BLUE"
        echo ""
        sleep 1
        
        bash scripts/system_diagnostics.sh
        
        echo ""
        echo ""
        print_message "════════════════════════════════════════════════════════════" "$BLUE"
        echo ""
        print_message "💡 COMMON REASONS ATTACKS FAIL:" "$CYAN"
        echo ""
        echo "1. Target is offline or unreachable"
        print_message "   Fix: ping TARGET_IP" "$GREEN"
        echo ""
        echo "2. Service not running on target"
        print_message "   Fix: nmap TARGET_IP (check which ports are open)" "$GREEN"
        echo ""
        echo "3. Firewall blocking connections"
        print_message "   Fix: Try from different network, check firewall rules" "$GREEN"
        echo ""
        echo "4. Wrong port number"
        print_message "   Fix: Use -p PORT option with correct port" "$GREEN"
        echo ""
        echo "5. Account lockout / rate limiting"
        print_message "   Fix: Reduce threads -T 4, increase timeout -o 60" "$GREEN"
        echo ""
        echo "6. Passwords not in wordlist"
        print_message "   Fix: Use bigger wordlist or generate custom one" "$GREEN"
        echo ""
        print_message "📖 Read full troubleshooting guide:" "$CYAN"
        print_message "   cat docs/TROUBLESHOOTING.md" "$GREEN"
        echo ""
        ;;
        
    4)
        print_message "🔧 ISSUE: Installation Problems" "$MAGENTA"
        echo ""
        print_message "Let me try to fix the installation..." "$BLUE"
        echo ""
        sleep 1
        
        print_message "Running automatic repair tool..." "$BLUE"
        echo ""
        bash scripts/auto_fix.sh
        
        echo ""
        echo ""
        print_message "════════════════════════════════════════════════════════════" "$BLUE"
        echo ""
        
        if command -v hydra &> /dev/null; then
            print_message "✅ SUCCESS! Installation is now working!" "$GREEN"
        else
            print_message "⚠️  Automatic fix didn't work." "$YELLOW"
            echo ""
            print_message "📖 Try manual installation:" "$CYAN"
            echo ""
            
            if [ -d "/data/data/com.termux" ]; then
                print_message "On Termux:" "$BLUE"
                print_message "  pkg update" "$GREEN"
                print_message "  pkg upgrade -y" "$GREEN"
                print_message "  pkg install hydra -y" "$GREEN"
            else
                print_message "On Debian/Ubuntu:" "$BLUE"
                print_message "  sudo apt update" "$GREEN"
                print_message "  sudo apt install hydra -y" "$GREEN"
            fi
            
            echo ""
            print_message "📖 Full troubleshooting guide:" "$CYAN"
            print_message "   cat docs/TROUBLESHOOTING.md" "$GREEN"
        fi
        echo ""
        ;;
        
    5)
        print_message "🔧 ISSUE: Performance Problems" "$MAGENTA"
        echo ""
        print_message "🔍 Analyzing system performance..." "$BLUE"
        echo ""
        
        # Check memory
        if command -v free &> /dev/null; then
            print_message "Memory Status:" "$CYAN"
            free -h | head -2
            echo ""
        fi
        
        # Check CPU
        if command -v nproc &> /dev/null; then
            cores=$(nproc)
            print_message "CPU Cores: $cores" "$CYAN"
            echo ""
        fi
        
        print_message "💡 PERFORMANCE OPTIMIZATION TIPS:" "$CYAN"
        echo ""
        echo "For SLOW performance:"
        echo "  • Use WiFi instead of mobile data"
        echo "  • Close other apps to free RAM"
        echo "  • Reduce thread count: -T 8 (or -T 4 for very slow systems)"
        echo "  • Keep Termux in foreground (prevents Android from killing it)"
        echo ""
        echo "For OUT OF MEMORY errors:"
        echo "  • Close all other apps"
        echo "  • Use smaller wordlists"
        echo "  • Reduce threads to -T 4"
        echo "  • Reboot device to free memory"
        echo ""
        echo "For BETTER SPEED:"
        echo "  • Increase threads: -T 32 or -T 64"
        echo "  • Use SSD storage"
        echo "  • Ensure good network connection"
        echo ""
        ;;
        
    6)
        print_message "🔍 RUNNING FULL SYSTEM DIAGNOSTICS..." "$MAGENTA"
        echo ""
        sleep 1
        bash scripts/system_diagnostics.sh
        ;;
        
    7)
        print_message "📚 AVAILABLE HELP TOOLS" "$MAGENTA"
        echo ""
        print_message "Diagnostic Tools:" "$CYAN"
        echo "  ┌─────────────────────────────────────────────────────────┐"
        echo "  │ bash scripts/help.sh                                    │"
        echo "  │   → This tool (one-stop help center)                   │"
        echo "  │                                                         │"
        echo "  │ bash scripts/system_diagnostics.sh                      │"
        echo "  │   → Comprehensive health check with A-F grade          │"
        echo "  │                                                         │"
        echo "  │ bash scripts/check_dependencies.sh                      │"
        echo "  │   → Quick check of required tools                      │"
        echo "  │                                                         │"
        echo "  │ bash scripts/auto_fix.sh                                │"
        echo "  │   → Automatic repair tool (tries to install hydra)    │"
        echo "  │                                                         │"
        echo "  │ bash scripts/setup_wizard.sh                            │"
        echo "  │   → Interactive first-time setup guide                 │"
        echo "  └─────────────────────────────────────────────────────────┘"
        echo ""
        print_message "Documentation:" "$CYAN"
        echo "  ┌─────────────────────────────────────────────────────────┐"
        echo "  │ docs/TROUBLESHOOTING.md                                 │"
        echo "  │   → Complete troubleshooting guide (10,000+ words)     │"
        echo "  │                                                         │"
        echo "  │ README.md                                               │"
        echo "  │   → Quick start and overview                           │"
        echo "  │                                                         │"
        echo "  │ QUICKSTART.md                                           │"
        echo "  │   → 5-minute quick start guide                         │"
        echo "  │                                                         │"
        echo "  │ docs/USAGE.md                                           │"
        echo "  │   → Detailed usage instructions                        │"
        echo "  └─────────────────────────────────────────────────────────┘"
        echo ""
        print_message "💡 TIP: Most issues can be solved with:" "$YELLOW"
        print_message "   bash scripts/auto_fix.sh" "$GREEN"
        echo ""
        ;;
        
    *)
        print_message "❌ Invalid choice. Running full diagnostics..." "$RED"
        echo ""
        sleep 1
        bash scripts/system_diagnostics.sh
        ;;
esac

echo ""
print_message "════════════════════════════════════════════════════════════" "$BLUE"
echo ""
print_message "Need more help?" "$CYAN"
echo "  • Re-run this tool: bash scripts/help.sh"
echo "  • Read full guide: cat docs/TROUBLESHOOTING.md"
echo "  • Ask on GitHub: https://github.com/vinnieboy707/Hydra-termux/issues"
echo ""
print_message "Good luck! 🚀" "$GREEN"
echo ""
