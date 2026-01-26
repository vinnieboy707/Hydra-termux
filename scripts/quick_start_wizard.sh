#!/bin/bash

# Hydra-Termux Quick Start Wizard
# Interactive, user-friendly setup and attack launcher
# 10,000,000,000% improvement in ease of use

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source utilities
source "$SCRIPT_DIR/common.sh" 2>/dev/null || {
    echo "ERROR: common.sh not found"
    exit 1
}

source "$SCRIPT_DIR/enhanced_ui.sh" 2>/dev/null || {
    echo "ERROR: enhanced_ui.sh not found"
    exit 1
}

source "$SCRIPT_DIR/logger.sh" 2>/dev/null || {
    echo "ERROR: logger.sh not found"
    exit 1
}

# Wizard state
WIZARD_STEP=0
declare -A WIZARD_DATA

# Welcome screen
show_welcome() {
    ui_clear
    
    cat << 'EOF'

     ██╗  ██╗██╗   ██╗██████╗ ██████╗  █████╗     
     ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔══██╗    
     ███████║ ╚████╔╝ ██║  ██║██████╔╝███████║    
     ██╔══██║  ╚██╔╝  ██║  ██║██╔══██╗██╔══██║    
     ██║  ██║   ██║   ██████╔╝██║  ██║██║  ██║    
     ╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    
                                                    
        🚀 QUICK START WIZARD 🚀                   
             Version 2.0.0                          

EOF
    
    ui_divider
    echo ""
    ui_alert_info "This wizard will help you get started in 60 seconds!"
    echo ""
    
    ui_kv "What you'll do" "Choose attack type and target"
    ui_kv "What you'll get" "Automated attack with detailed results"
    ui_kv "Time required" "1-2 minutes"
    echo ""
    
    ui_divider
    echo ""
    
    if ui_confirm "Ready to start?" "y"; then
        return 0
    else
        ui_alert_warning "Wizard cancelled"
        exit 0
    fi
}

# Step 1: Check dependencies
check_dependencies() {
    ui_clear
    ui_breadcrumb "Quick Start" "Dependencies"
    
    ui_panel "Checking Dependencies" "Verifying required tools are installed..."
    
    echo ""
    ui_status_running "Checking for Hydra..."
    sleep 0.5
    
    if command_exists hydra; then
        ui_status_success "Hydra is installed"
        WIZARD_DATA[hydra]="installed"
    else
        ui_status_failed "Hydra is NOT installed"
        WIZARD_DATA[hydra]="missing"
        
        echo ""
        ui_alert_error "Hydra is required for attacks!"
        echo ""
        
        ui_panel "How to Install" "$(cat <<EOF
On Termux:
  pkg update && pkg install hydra -y

On Debian/Ubuntu:
  sudo apt install hydra -y

On Arch Linux:
  sudo pacman -S hydra
EOF
)"
        
        if ui_confirm "Do you want to try auto-installation?" "n"; then
            echo ""
            ui_alert_info "Installation requires system package manager with elevated privileges"
            echo ""
            echo "This will run one of the following commands:"
            if [ -d "/data/data/com.termux" ]; then
                echo "  ${COLORS[CYAN]}pkg install hydra -y${COLORS[NC]}"
            else
                echo "  ${COLORS[CYAN]}sudo apt install hydra -y${COLORS[NC]} (Debian/Ubuntu)"
                echo "  OR ${COLORS[CYAN]}sudo dnf install hydra -y${COLORS[NC]} (Fedora/RHEL)"
            fi
            echo ""
            
            if ! ui_confirm "Proceed with installation?" "y"; then
                ui_alert_warning "Installation cancelled"
                exit 1
            fi
            
            ui_loading 3 "Installing Hydra"
            
            if [ -d "/data/data/com.termux" ]; then
                pkg install hydra -y
            else
                if command_exists apt; then
                    INSTALL_CMD="sudo apt install hydra -y"
                elif command_exists dnf; then
                    INSTALL_CMD="sudo dnf install hydra -y"
                else
                    ui_alert_error "No supported package manager found (apt or dnf). Please install Hydra manually."
                    exit 1
                fi

                echo "Running: $INSTALL_CMD"
                # Execute command safely without eval
                if ! $INSTALL_CMD; then
                    ui_alert_error "Package installation command failed. Please check the output above and install Hydra manually."
                    exit 1
                fi
            fi
            
            if command_exists hydra; then
                ui_alert_success "Hydra installed successfully!"
            else
                ui_alert_error "Auto-installation failed. Please install manually."
                exit 1
            fi
        else
            exit 1
        fi
    fi
    
    echo ""
    ui_status_running "Checking for other tools..."
    sleep 0.5
    
    local tools_ok=true
    if command_exists nmap; then
        ui_status_success "Nmap is installed (optional)"
    else
        ui_status_pending "Nmap not found (optional, for scanning)"
    fi
    
    echo ""
    read -r -p "Press Enter to continue..."
}

# Step 2: Select attack type
select_attack_type() {
    ui_clear
    ui_breadcrumb "Quick Start" "Attack Type"
    
    ui_menu "Select Attack Type" \
        "SSH - Secure Shell (Port 22)" \
        "FTP - File Transfer Protocol (Port 21)" \
        "HTTP - Web Admin Panel (Port 80/443)" \
        "MySQL - Database Server (Port 3306)" \
        "RDP - Remote Desktop (Port 3389)" \
        "PostgreSQL - Database (Port 5432)" \
        "SMB - Windows Shares (Port 445)" \
        "Auto-Detect - Scan and choose best"
    
    local choice=$?
    
    case $choice in
        0) WIZARD_DATA[protocol]="ssh"; WIZARD_DATA[port]="22" ;;
        1) WIZARD_DATA[protocol]="ftp"; WIZARD_DATA[port]="21" ;;
        2) WIZARD_DATA[protocol]="http"; WIZARD_DATA[port]="80" ;;
        3) WIZARD_DATA[protocol]="mysql"; WIZARD_DATA[port]="3306" ;;
        4) WIZARD_DATA[protocol]="rdp"; WIZARD_DATA[port]="3389" ;;
        5) WIZARD_DATA[protocol]="postgres"; WIZARD_DATA[port]="5432" ;;
        6) WIZARD_DATA[protocol]="smb"; WIZARD_DATA[port]="445" ;;
        7) WIZARD_DATA[protocol]="auto"; WIZARD_DATA[port]="auto" ;;
        255) exit 0 ;;
    esac
}

# Step 3: Enter target
enter_target() {
    ui_clear
    ui_breadcrumb "Quick Start" "Target"
    
    ui_panel "Target Information" "Enter the IP address or hostname you want to test"
    
    echo ""
    ui_alert_warning "⚠️  LEGAL WARNING: Only test systems you own or have permission to test!"
    echo ""
    
    # Validator function
    validate_target() {
        local target="$1"
        validate_ip "$target" || validate_hostname "$target"
    }
    
    WIZARD_DATA[target]=$(ui_input "Enter target IP or hostname:" "validate_target")
    
    ui_alert_success "Target set to: ${WIZARD_DATA[target]}"
    sleep 1
}

# Step 4: Configure attack
configure_attack() {
    ui_clear
    ui_breadcrumb "Quick Start" "Configuration"
    
    ui_panel "Attack Configuration" "Customize your attack settings"
    
    echo ""
    
    # Mode selection
    ui_menu "Select Attack Mode" \
        "Quick - Fast scan with common passwords (5-10 min)" \
        "Standard - Balanced speed and coverage (15-30 min)" \
        "Thorough - Comprehensive scan (30-60 min)" \
        "Custom - Specify your own settings"
    
    local mode_choice=$?
    
    case $mode_choice in
        0) 
            WIZARD_DATA[mode]="quick"
            WIZARD_DATA[threads]=32
            WIZARD_DATA[timeout]=15
            WIZARD_DATA[wordlist]="common"
            ;;
        1)
            WIZARD_DATA[mode]="standard"
            WIZARD_DATA[threads]=16
            WIZARD_DATA[timeout]=30
            WIZARD_DATA[wordlist]="standard"
            ;;
        2)
            WIZARD_DATA[mode]="thorough"
            WIZARD_DATA[threads]=8
            WIZARD_DATA[timeout]=45
            WIZARD_DATA[wordlist]="large"
            ;;
        3)
            WIZARD_DATA[mode]="custom"
            ui_clear
            WIZARD_DATA[threads]=$(ui_input "Number of threads (1-64):" "" "16")
            WIZARD_DATA[timeout]=$(ui_input "Timeout in seconds (5-120):" "" "30")
            ;;
        255) exit 0 ;;
    esac
    
    echo ""
    ui_alert_info "Configuration saved"
    sleep 1
}

# Step 5: Summary and confirmation
show_summary() {
    ui_clear
    ui_breadcrumb "Quick Start" "Summary"
    
    ui_panel "Attack Summary" "Review your settings before starting"
    
    echo ""
    
    ui_kv "Protocol" "${WIZARD_DATA[protocol]^^}" 35
    ui_kv "Target" "${WIZARD_DATA[target]}" 35
    ui_kv "Port" "${WIZARD_DATA[port]}" 35
    ui_kv "Mode" "${WIZARD_DATA[mode]^^}" 35
    ui_kv "Threads" "${WIZARD_DATA[threads]}" 35
    ui_kv "Timeout" "${WIZARD_DATA[timeout]}s" 35
    
    echo ""
    ui_divider
    echo ""
    
    ui_alert_warning "⚠️  Remember: Only attack systems you own or have permission to test!"
    
    echo ""
    
    if ui_confirm "Start the attack now?" "y"; then
        return 0
    else
        ui_alert_warning "Attack cancelled"
        exit 0
    fi
}

# Step 6: Execute attack
execute_attack() {
    ui_clear
    ui_breadcrumb "Quick Start" "Executing"
    
    ui_panel "Attack in Progress" "${SYMBOLS[ROCKET]} Launching ${WIZARD_DATA[protocol]^^} attack on ${WIZARD_DATA[target]}"
    
    echo ""
    
    # Simulate attack progress
    ui_status_running "Initializing attack parameters..."
    sleep 1
    
    ui_status_running "Loading wordlist..."
    sleep 1
    
    ui_status_running "Establishing connection to target..."
    sleep 1
    
    echo ""
    ui_alert_info "Starting brute-force attack..."
    echo ""
    
    # Build command
    local script_file
    case "${WIZARD_DATA[protocol]}" in
        ssh) script_file="ssh_admin_attack.sh" ;;
        ftp) script_file="ftp_admin_attack.sh" ;;
        http) script_file="web_admin_attack.sh" ;;
        mysql) script_file="mysql_admin_attack.sh" ;;
        rdp) script_file="rdp_admin_attack.sh" ;;
        postgres) script_file="postgres_admin_attack.sh" ;;
        smb) script_file="smb_admin_attack.sh" ;;
        auto) script_file="admin_auto_attack.sh" ;;
    esac
    
    # Execute actual attack
    if [ -f "$SCRIPT_DIR/$script_file" ]; then
        log_info "Quick Start: Executing $script_file on ${WIZARD_DATA[target]}"
        
        # Show progress bar simulation while attack runs
        (
            for i in $(seq 0 10 100); do
                sleep 2
                echo "$i"
            done
        ) | while read -r progress; do
            ui_progress_bar "$progress" 100 50 "Attack Progress"
        done &
        
        local progress_pid=$!
        
        # Run actual attack
        bash "$SCRIPT_DIR/$script_file" -t "${WIZARD_DATA[target]}" -p "${WIZARD_DATA[port]}" > /tmp/hydra_quickstart.log 2>&1
        local exit_code=$?
        
        # Kill progress bar
        kill "$progress_pid" 2>/dev/null
        wait "$progress_pid" 2>/dev/null
        
        echo ""
        echo ""
        
        if [ $exit_code -eq 0 ]; then
            ui_alert_success "Attack completed successfully!"
            show_results
        else
            ui_alert_error "Attack encountered errors"
            echo ""
            ui_kv "Exit code" "$exit_code"
            echo ""
            
            if ui_confirm "View error log?" "y"; then
                less /tmp/hydra_quickstart.log 2>/dev/null || cat /tmp/hydra_quickstart.log
            fi
        fi
    else
        ui_alert_error "Attack script not found: $script_file"
        log_error "Quick Start: Script not found: $script_file"
    fi
    
    echo ""
    read -r -p "Press Enter to continue..."
}

# Show results
show_results() {
    ui_clear
    ui_breadcrumb "Quick Start" "Results"
    
    ui_panel "Attack Results" "${SYMBOLS[TROPHY]} Your attack has completed!"
    
    echo ""
    
    # Try to find recent results
    local results_file
    results_file=$(find "$PROJECT_ROOT/logs" -name "results_*.json" -type f -mmin -10 | sort -r | head -1)
    
    if [ -n "$results_file" ] && [ -f "$results_file" ]; then
        ui_status_success "Results saved to: $results_file"
        
        # Try to parse results
        if command_exists jq; then
            local found_count=$(jq '. | length' "$results_file" 2>/dev/null || echo "0")
            echo ""
            ui_kv "Credentials Found" "$found_count" 35
        fi
    else
        ui_status_pending "No results file found (attack may still be running)"
    fi
    
    echo ""
    
    # Check for reports
    local report_file
    report_file=$(find "$PROJECT_ROOT/reports" -name "attack_report_*.md" -type f -mmin -10 | sort -r | head -1)
    
    if [ -n "$report_file" ] && [ -f "$report_file" ]; then
        ui_status_success "Detailed report generated"
        echo ""
        
        if ui_confirm "View detailed report?" "y"; then
            less "$report_file" 2>/dev/null || cat "$report_file"
        fi
    fi
    
    echo ""
    ui_divider
    echo ""
    
    ui_menu "What's Next?" \
        "Run another attack" \
        "View all results" \
        "Open main menu" \
        "Exit"
    
    local next=$?
    
    case $next in
        0) main ;;
        1) bash "$SCRIPT_DIR/results_viewer.sh" --all ;;
        2) bash "$PROJECT_ROOT/hydra.sh" ;;
        3|255) exit 0 ;;
    esac
}

# Main wizard flow
main() {
    # Trap Ctrl+C
    trap 'ui_cursor_show; ui_alert_warning "Wizard interrupted"; exit 130' INT
    
    show_welcome
    check_dependencies
    select_attack_type
    enter_target
    configure_attack
    show_summary
    execute_attack
}

# Run wizard
main "$@"
