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
    if resolved="$(readlink -f "$SCRIPT_PATH" 2>/dev/null)" && [ -n "$resolved" ]; then
        resolved_path="$resolved"
    elif resolved="$(readlink "$SCRIPT_PATH" 2>/dev/null)" && [ -n "$resolved" ]; then
        # Fallback when -f is unavailable or fails; resolves a single symlink level
        # If the result is relative, resolve it relative to the symlink's directory
        if [ "${resolved#/}" != "$resolved" ]; then
            # Absolute path
            resolved_path="$resolved"
        else
            # Relative path: interpret relative to the directory of SCRIPT_PATH
            link_dir="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
            resolved_path="$link_dir/$resolved"
        fi
    fi
fi
[ -n "$resolved_path" ] && SCRIPT_PATH="$resolved_path"
if ! SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" 2>/dev/null && pwd)"; then
    echo "Error: Unable to determine script directory from SCRIPT_PATH='$SCRIPT_PATH'." >&2
    exit 1
fi

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
    echo "  15) View Attack Reports"
    echo "  16) Export Results"
    echo "  17) Update Hydra-Termux"
    echo ""
    print_message "  OTHER:" "$MAGENTA"
    echo "  18) Help & Documentation"
    echo "  19) About & Credits"
    echo "  20) Show Login Credentials"
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
        read -r -p "Press Enter to continue..."
        return 1
    fi
    
    read -r -p "Enter target IP/hostname: " target
    
    if [ -z "$target" ]; then
        log_error "Target is required"
        read -r -p "Press Enter to continue..."
        return 1
    fi
    
    echo ""
    log_info "Starting attack on $target..."
    echo ""
    
    bash "$SCRIPT_DIR/scripts/$script" -t "$target"
    
    echo ""
    log_info "Attack completed. Check logs for results."
    read -r -p "Press Enter to continue..."
}

# Function to run utility script
run_utility() {
    local script="$1"
    local name="$2"
    
    print_banner "$name"
    echo ""
    
    if [ ! -f "$SCRIPT_DIR/scripts/$script" ]; then
        log_error "Script not found: $script"
        read -r -p "Press Enter to continue..."
        return 1
    fi
    
    bash "$SCRIPT_DIR/scripts/$script" "$@"
    
    echo ""
    read -r -p "Press Enter to continue..."
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
    read -r -p "Press Enter to continue..."
}

# Function to view logs
view_logs() {
    print_banner "Recent Logs"
    echo ""
    
    local log_file
    log_file="$SCRIPT_DIR/logs/hydra_$(date +%Y%m%d).log"
    
    if [ -f "$log_file" ]; then
        log_info "Showing last 50 lines..."
        echo ""
        tail -n 50 "$log_file"
    else
        log_warning "No logs found for today"
    fi
    
    echo ""
    read -r -p "Press Enter to continue..."
}

# Function to view attack reports
view_attack_reports() {
    print_banner "Attack Reports"
    echo ""
    
    local report_dir="$SCRIPT_DIR/reports"
    
    if [ ! -d "$report_dir" ]; then
        log_warning "No reports directory found"
        echo ""
        read -r -p "Press Enter to continue..."
        return 1
    fi
    
    # Find all report files
    local reports=$(find "$report_dir" -name "attack_report_*.md" -type f 2>/dev/null | sort -r)
    
    if [ -z "$reports" ]; then
        log_warning "No attack reports found"
        echo ""
        log_info "Reports are automatically generated after each attack"
        log_info "Run an attack (options 1-8) to generate your first report"
        echo ""
        read -r -p "Press Enter to continue..."
        return 1
    fi
    
    # Count reports
    local report_count=$(echo "$reports" | wc -l)
    log_success "Found $report_count attack report(s)"
    echo ""
    
    # Display list of reports
    print_message "Recent Attack Reports:" "$CYAN"
    echo ""
    
    local index=1
    echo "$reports" | while IFS= read -r report; do
        local report_name=$(basename "$report")
        local report_date
        # Try GNU coreutils stat (-c) first; fall back to BSD/macOS stat (-f) if needed
        if stat -c %y "$report" >/dev/null 2>&1; then
            report_date=$(stat -c %y "$report" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1)
        elif stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$report" >/dev/null 2>&1; then
            report_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$report" 2>/dev/null)
        else
            report_date="unknown"
        fi
        local report_size=$(du -h "$report" 2>/dev/null | cut -f1)
        
        # Extract protocol and target from filename if possible
        local protocol=$(echo "$report_name" | sed 's/attack_report_\([^_]*\)_.*/\1/')
        
        printf "${YELLOW}%2d)${NC} %-15s ${CYAN}%-20s${NC} (%s)\n" \
            "$index" "$protocol" "$report_date" "$report_size"
        
        index=$((index + 1))
    done
    
    echo ""
    print_message "Actions:" "$BLUE"
    echo "  1) View a specific report"
    echo "  2) View latest report"
    echo "  3) Export all reports (tar.gz)"
    echo "  4) Delete old reports (30+ days)"
    echo "  0) Back to main menu"
    echo ""
    read -r -p "Enter choice: " action_choice
    
    case $action_choice in
        1)
            echo ""
            read -r -p "Enter report number to view: " report_num
            local selected_report=$(echo "$reports" | sed -n "${report_num}p")
            if [ -n "$selected_report" ] && [ -f "$selected_report" ]; then
                echo ""
                print_message "Opening report: $(basename "$selected_report")" "$GREEN"
                echo ""
                if command -v less >/dev/null 2>&1; then
                    less "$selected_report"
                else
                    cat "$selected_report"
                    echo ""
                    read -r -p "Press Enter to continue..."
                fi
            else
                log_error "Invalid report number"
            fi
            ;;
        2)
            local latest_report=$(echo "$reports" | head -1)
            if [ -n "$latest_report" ] && [ -f "$latest_report" ]; then
                echo ""
                print_message "Opening latest report: $(basename "$latest_report")" "$GREEN"
                echo ""
                if command -v less >/dev/null 2>&1; then
                    less "$latest_report"
                else
                    cat "$latest_report"
                    echo ""
                    read -r -p "Press Enter to continue..."
                fi
            fi
            ;;
        3)
            local archive_file="$SCRIPT_DIR/attack_reports_$(date +%Y%m%d_%H%M%S).tar.gz"
            tar -czf "$archive_file" -C "$report_dir" . 2>/dev/null
            if [ $? -eq 0 ]; then
                log_success "Reports exported to: $archive_file"
            else
                log_error "Failed to export reports"
            fi
            echo ""
            read -r -p "Press Enter to continue..."
            ;;
        4)
            echo ""
            log_info "Deleting reports older than 30 days..."
            find "$report_dir" -name "attack_report_*.md" -type f -mtime +30 -delete 2>/dev/null
            log_success "Old reports deleted"
            echo ""
            read -r -p "Press Enter to continue..."
            ;;
        0)
            return 0
            ;;
        *)
            log_error "Invalid choice"
            read -r -p "Press Enter to continue..."
            ;;
    esac
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
    read -r -p "Enter choice [1-3]: " format_choice
    
    local format="txt"
    case $format_choice in
        1) format="txt" ;;
        2) format="csv" ;;
        3) format="json" ;;
        *) 
            log_error "Invalid choice"
            read -r -p "Press Enter to continue..."
            return 1
            ;;
    esac
    
    local output_file
    output_file="$SCRIPT_DIR/results/export_$(date +%Y%m%d_%H%M%S).$format"
    
    bash "$SCRIPT_DIR/scripts/results_viewer.sh" --export "$output_file" --format "$format"
    
    echo ""
    read -r -p "Press Enter to continue..."
}

# Function to update tool
update_tool() {
    print_banner "Update Hydra-Termux"
    echo ""
    
    log_info "Checking for updates..."
    
    cd "$SCRIPT_DIR" || return
    
    if [ -d ".git" ]; then
        git fetch origin
        
        local local_hash
        local remote_hash
        local_hash=$(git rev-parse HEAD)
        remote_hash=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)
        
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
    read -r -p "Press Enter to continue..."
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
    
    read -r -p "Press Enter to continue..."
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
    
    read -r -p "Press Enter to continue..."
}

# Main program loop
main() {
    # Check if running on Termux
    if [ ! -d "/data/data/com.termux" ]; then
        log_warning "This tool is optimized for Termux on Android"
    fi
    
    # Check critical dependencies before starting
    if ! command -v hydra &> /dev/null; then
        clear
        show_banner
        echo ""
        log_error "CRITICAL: Hydra is not installed!"
        echo ""
        print_message "═══ PROBLEM ═══" "$RED"
        echo "Hydra is the CORE brute-force tool that all attacks depend on."
        echo "Without hydra installed, NO attacks will work."
        echo ""
        print_message "═══ HOW TO FIX ═══" "$CYAN"
        echo ""
        
        if [ -d "/data/data/com.termux" ]; then
            print_message "On Termux, install hydra with:" "$BLUE"
            print_message "  pkg update && pkg install hydra -y" "$GREEN"
        else
            print_message "Install hydra:" "$BLUE"
            print_message "  Debian/Ubuntu: sudo apt install hydra -y" "$GREEN"
            print_message "  Fedora/RHEL: sudo dnf install hydra -y" "$GREEN"
            print_message "  Arch Linux: sudo pacman -S hydra" "$GREEN"
            print_message "  macOS: brew install hydra" "$GREEN"
        fi
        
        echo ""
        print_message "Or run the automated installer:" "$BLUE"
        print_message "  bash install.sh" "$GREEN"
        echo ""
        print_message "After installing, run dependency check:" "$BLUE"
        print_message "  bash scripts/check_dependencies.sh" "$GREEN"
        echo ""
        print_message "════════════════════════════════════════════════════════════" "$BLUE"
        echo ""
        exit 1
    fi
    
    # Main menu loop
    while true; do
        show_banner
        show_menu
        
        read -r -p "Enter your choice [0-20]: " choice
        
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
                view_attack_reports
                ;;
            16)
                export_results
                ;;
            17)
                update_tool
                ;;
            18)
                show_help
                ;;
            19)
                show_about
                ;;
            20)
                run_utility "show_login_info.sh" "Login Credentials Helper"
                ;;
            0)
                clear
                print_message "Thanks for using Hydra-Termux Ultimate Edition!" "$GREEN"
                print_message "Stay ethical! 🐍" "$CYAN"
                echo ""
                exit 0
                ;;
            *)
                log_error "Invalid choice. Please select 0-20."
                sleep 2
                ;;
        esac
    done
}

# Run main program
main
