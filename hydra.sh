#!/bin/bash

# Hydra-Termux Ultimate Edition Main Launcher
# Interactive menu system for all attack tools

# Get script directory (supports symlinks)
SCRIPT_PATH="${BASH_SOURCE[0]}"
# Resolve the real script path across environments (realpath > readlink -f > readlink)
resolved_path=""
if command -v realpath >/dev/null; then
    resolved_path="$(realpath "$SCRIPT_PATH" 2>/dev/null)"
fi
if [ -z "$resolved_path" ] && command -v readlink >/dev/null; then
    resolved_path="$(readlink -f "$SCRIPT_PATH" 2>/dev/null)"
fi
if [ -z "$resolved_path" ] && command -v readlink >/dev/null; then
    # Basic readlink resolves a single symlink level; used as last resort
    resolved_path="$(readlink "$SCRIPT_PATH" 2>/dev/null)"
fi
[ -n "$resolved_path" ] && SCRIPT_PATH="$resolved_path"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

# Source logger
source "$SCRIPT_DIR/scripts/logger.sh"

# Version
VERSION="2.0.0 Ultimate Edition"

# Function to display ASCII banner
show_banner() {
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
║              🐍 TERMUX ULTIMATE EDITION 🐍                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo ""
    print_message "                    Version: $VERSION" "$CYAN"
    print_message "                Created for Ethical Hackers" "$YELLOW"
    echo ""
}

# Function to display main menu
show_menu() {
    print_message "╔════════════════════ MAIN MENU ════════════════════════╗" "$BLUE"
    echo ""
    print_message "  ATTACK SCRIPTS:" "$MAGENTA"
    echo "  1)  SSH Admin Attack"
    echo "  2)  FTP Admin Attack"
    echo "  3)  Web Admin Attack"
    echo "  4)  RDP Admin Attack"
    echo "  5)  MySQL Admin Attack"
    echo "  6)  PostgreSQL Admin Attack"
    echo "  7)  SMB Admin Attack"
    echo "  8)  Multi-Protocol Auto Attack"
    echo ""
    print_message "  UTILITIES:" "$MAGENTA"
    echo "  9)  Download Wordlists"
    echo "  10) Generate Custom Wordlist"
    echo "  11) Scan Target"
    echo "  12) View Attack Results"
    echo ""
    print_message "  MANAGEMENT:" "$MAGENTA"
    echo "  13) View Configuration"
    echo "  14) View Logs"
    echo "  15) Export Results"
    echo "  16) Update Hydra-Termux"
    echo ""
    print_message "  OTHER:" "$MAGENTA"
    echo "  17) Help & Documentation"
    echo "  18) About & Credits"
    echo "  0)  Exit"
    echo ""
    print_message "╚════════════════════════════════════════════════════════╝" "$BLUE"
    echo ""
}

# Function to run attack script
run_attack_script() {
    local script="$1"
    local name="$2"
    
    print_banner "$name"
    echo ""
    
    if [ ! -f "$SCRIPT_DIR/scripts/$script" ]; then
        log_error "Script not found: $script"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    read -p "Enter target IP/hostname: " target
    
    if [ -z "$target" ]; then
        log_error "Target is required"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo ""
    log_info "Starting attack on $target..."
    echo ""
    
    bash "$SCRIPT_DIR/scripts/$script" -t "$target"
    
    echo ""
    log_info "Attack completed. Check logs for results."
    read -p "Press Enter to continue..."
}

# Function to run utility script
run_utility() {
    local script="$1"
    local name="$2"
    
    print_banner "$name"
    echo ""
    
    if [ ! -f "$SCRIPT_DIR/scripts/$script" ]; then
        log_error "Script not found: $script"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    bash "$SCRIPT_DIR/scripts/$script" "$@"
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to view configuration
view_config() {
    print_banner "Configuration"
    echo ""
    
    if [ -f "$SCRIPT_DIR/config/hydra.conf" ]; then
        cat "$SCRIPT_DIR/config/hydra.conf"
    else
        log_warning "Configuration file not found"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to view logs
view_logs() {
    print_banner "Recent Logs"
    echo ""
    
    local log_file="$SCRIPT_DIR/logs/hydra_$(date +%Y%m%d).log"
    
    if [ -f "$log_file" ]; then
        log_info "Showing last 50 lines..."
        echo ""
        tail -n 50 "$log_file"
    else
        log_warning "No logs found for today"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to export results
export_results() {
    print_banner "Export Results"
    echo ""
    
    echo "Select export format:"
    echo "  1) TXT"
    echo "  2) CSV"
    echo "  3) JSON"
    echo ""
    read -p "Enter choice [1-3]: " format_choice
    
    local format="txt"
    case $format_choice in
        1) format="txt" ;;
        2) format="csv" ;;
        3) format="json" ;;
        *) 
            log_error "Invalid choice"
            read -p "Press Enter to continue..."
            return 1
            ;;
    esac
    
    local output_file="$SCRIPT_DIR/results/export_$(date +%Y%m%d_%H%M%S).$format"
    
    bash "$SCRIPT_DIR/scripts/results_viewer.sh" --export "$output_file" --format "$format"
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to update tool
update_tool() {
    print_banner "Update Hydra-Termux"
    echo ""
    
    log_info "Checking for updates..."
    
    cd "$SCRIPT_DIR"
    
    if [ -d ".git" ]; then
        git fetch origin
        
        local local_hash=$(git rev-parse HEAD)
        local remote_hash=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)
        
        if [ "$local_hash" = "$remote_hash" ]; then
            log_success "Already up to date!"
        else
            log_info "Updates available. Pulling changes..."
            git pull
            log_success "Update completed!"
        fi
    else
        log_warning "Not a git repository. Cannot check for updates."
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Function to show help
show_help() {
    print_banner "Help & Documentation"
    echo ""
    
    echo "ATTACK SCRIPTS:"
    echo "  All attack scripts support the following options:"
    echo "    -t, --target      Target IP or hostname"
    echo "    -p, --port        Custom port"
    echo "    -v, --verbose     Verbose output"
    echo "    -h, --help        Show help"
    echo ""
    echo "WORDLISTS:"
    echo "  Download wordlists first using option 9"
    echo "  Default location: ~/wordlists/"
    echo ""
    echo "RESULTS:"
    echo "  View results using option 12"
    echo "  Export results using option 15"
    echo "  Results are saved in: $SCRIPT_DIR/logs/"
    echo ""
    echo "DOCUMENTATION:"
    echo "  Full documentation: README.md"
    echo "  Usage guide: docs/USAGE.md"
    echo "  Examples: docs/EXAMPLES.md"
    echo ""
    
    read -p "Press Enter to continue..."
}

# Function to show about
show_about() {
    print_banner "About & Credits"
    echo ""
    
    print_message "Hydra-Termux Ultimate Edition" "$CYAN"
    print_message "Version: $VERSION" "$YELLOW"
    echo ""
    echo "A powerful brute-force tool suite optimized for Termux."
    echo ""
    print_message "Features:" "$GREEN"
    echo "  ✓ 8 Pre-built attack scripts"
    echo "  ✓ Multi-protocol auto attack"
    echo "  ✓ Wordlist management"
    echo "  ✓ Target scanning"
    echo "  ✓ Results tracking"
    echo "  ✓ Comprehensive logging"
    echo ""
    print_message "Credits:" "$CYAN"
    echo "  Original: cyrushar/Hydra-Termux"
    echo "  Enhanced by: vinnieboy707"
    echo ""
    print_message "⚠️  LEGAL DISCLAIMER ⚠️" "$RED"
    echo "This tool is for educational and authorized testing ONLY."
    echo "Unauthorized access to computer systems is illegal."
    echo "The developers assume NO liability for misuse."
    echo ""
    
    read -p "Press Enter to continue..."
}

# Main program loop
main() {
    # Check if running on Termux
    if [ ! -d "/data/data/com.termux" ]; then
        log_warning "This tool is optimized for Termux on Android"
    fi
    
    # Main menu loop
    while true; do
        show_banner
        show_menu
        
        read -p "Enter your choice [0-18]: " choice
        
        case $choice in
            1)
                run_attack_script "ssh_admin_attack.sh" "SSH Admin Attack"
                ;;
            2)
                run_attack_script "ftp_admin_attack.sh" "FTP Admin Attack"
                ;;
            3)
                run_attack_script "web_admin_attack.sh" "Web Admin Attack"
                ;;
            4)
                run_attack_script "rdp_admin_attack.sh" "RDP Admin Attack"
                ;;
            5)
                run_attack_script "mysql_admin_attack.sh" "MySQL Admin Attack"
                ;;
            6)
                run_attack_script "postgres_admin_attack.sh" "PostgreSQL Admin Attack"
                ;;
            7)
                run_attack_script "smb_admin_attack.sh" "SMB Admin Attack"
                ;;
            8)
                run_attack_script "admin_auto_attack.sh" "Multi-Protocol Auto Attack"
                ;;
            9)
                run_utility "download_wordlists.sh" "Download Wordlists" --all
                ;;
            10)
                run_utility "wordlist_generator.sh" "Wordlist Generator"
                ;;
            11)
                run_attack_script "target_scanner.sh" "Target Scanner"
                ;;
            12)
                run_utility "results_viewer.sh" "Results Viewer" --all
                ;;
            13)
                view_config
                ;;
            14)
                view_logs
                ;;
            15)
                export_results
                ;;
            16)
                update_tool
                ;;
            17)
                show_help
                ;;
            18)
                show_about
                ;;
            0)
                clear
                print_message "Thanks for using Hydra-Termux Ultimate Edition!" "$GREEN"
                print_message "Stay ethical! 🐍" "$CYAN"
                echo ""
                exit 0
                ;;
            *)
                log_error "Invalid choice. Please select 0-18."
                sleep 2
                ;;
        esac
    done
}

# Run main program
main
