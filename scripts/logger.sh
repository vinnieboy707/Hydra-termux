#!/bin/bash

# Hydra-Termux Logging Utility
# Provides centralized logging functionality for all scripts

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory (use local variable to avoid collision with parent scripts)
_LOGGER_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$_LOGGER_SCRIPT_DIR")"

# Default log directory
LOG_DIR="${LOG_DIR:-$PROJECT_ROOT/logs}"
mkdir -p "$LOG_DIR"

# Current log file
LOG_FILE="$LOG_DIR/hydra_$(date +%Y%m%d).log"
RESULTS_FILE="$LOG_DIR/results_$(date +%Y%m%d).json"

# Initialize results file if it doesn't exist
if [ ! -f "$RESULTS_FILE" ]; then
    echo "[]" > "$RESULTS_FILE"
fi

# Attack metadata tracking file
ATTACK_METADATA_FILE="$LOG_DIR/attack_metadata_$(date +%Y%m%d).json"
if [ ! -f "$ATTACK_METADATA_FILE" ]; then
    echo "[]" > "$ATTACK_METADATA_FILE"
fi

# Initialize attack tracking variables
ATTACK_START_TIME=""
ATTACK_END_TIME=""
ATTACK_ATTEMPTS=0
ATTACK_WORDLIST_COUNT=0

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp

    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to print colored messages
print_message() {
    local message="$1"
    local color="$2"
    echo -e "${color}${message}${NC}"
}

# Success message
log_success() {
    local message="$1"
    log_message "SUCCESS" "$message"
    print_message "✅ $message" "$GREEN"
}

# Error message
log_error() {
    local message="$1"
    log_message "ERROR" "$message"
    print_message "❌ $message" "$RED"
}

# Warning message
log_warning() {
    local message="$1"
    log_message "WARNING" "$message"
    print_message "⚠️  $message" "$YELLOW"
}

# Info message
log_info() {
    local message="$1"
    log_message "INFO" "$message"
    print_message "ℹ️  $message" "$BLUE"
}

# Debug message
log_debug() {
    local message="$1"
    if [ "${VERBOSE:-false}" = "true" ]; then
        log_message "DEBUG" "$message"
        print_message "🔍 $message" "$CYAN"
    fi
}

# Progress message
log_progress() {
    local message="$1"
    log_message "PROGRESS" "$message"
    print_message "⏳ $message" "$YELLOW"
}

# Save successful attack result
save_result() {
    local protocol="$1"
    local target="$2"
    local username="$3"
    local password="$4"
    local port="$5"
    local timestamp

    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    # Create JSON entry with proper escaping using jq
    local json_entry
    json_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg protocol "$protocol" \
        --arg target "$target" \
        --arg port "$port" \
        --arg username "$username" \
        --arg password "$password" \
        '{timestamp: $timestamp, protocol: $protocol, target: $target, port: $port, username: $username, password: $password}')
    
    # Add to results file
    if [ -f "$RESULTS_FILE" ]; then
        local temp_file

        temp_file=$(mktemp)
        jq --argjson entry "$json_entry" '. += [$entry]' "$RESULTS_FILE" > "$temp_file" 2>/dev/null || {
            # If jq fails, fall back to simple append
            echo "$json_entry" >> "$LOG_DIR/results_fallback.txt"
        }
        [ -f "$temp_file" ] && mv "$temp_file" "$RESULTS_FILE"
    fi
    
    # Set restrictive permissions on results file (owner-only read/write)
    chmod 600 "$RESULTS_FILE" 2>/dev/null
    
    log_success "Credentials saved: $protocol://$username:$password@$target:$port"
    log_warning "Results contain sensitive data - stored with restricted permissions"
}

# Start tracking attack metadata
start_attack_tracking() {
    ATTACK_START_TIME=$(date "+%Y-%m-%d %H:%M:%S")
    ATTACK_ATTEMPTS=0
    ATTACK_WORDLIST_COUNT=0
}

# Update attack attempt count
update_attack_attempts() {
    local attempts="${1:-0}"
    ATTACK_ATTEMPTS=$((ATTACK_ATTEMPTS + attempts)) 2>/dev/null || true
}

# Update wordlist count
update_wordlist_count() {
    ATTACK_WORDLIST_COUNT=$((ATTACK_WORDLIST_COUNT + 1)) 2>/dev/null || true
}

# Finish attack tracking and generate report
finish_attack_tracking() {
    local protocol="$1"
    local target="$2"
    local port="$3"
    local status="$4"
    local username="${5:-N/A}"
    local password="${6:-N/A}"
    
    ATTACK_END_TIME=$(date "+%Y-%m-%d %H:%M:%S")
    
    # Source report generator if available and not already sourced
    if [ -f "$SCRIPT_DIR/report_generator.sh" ] && [ -z "$REPORT_GENERATOR_SOURCED" ]; then
        source "$SCRIPT_DIR/report_generator.sh"
        export REPORT_GENERATOR_SOURCED=1
    fi
    
    # Generate detailed report if functions are available
    if declare -f generate_report >/dev/null 2>&1; then
        # Generate detailed report
        local report_file

        report_file=$(generate_report "$protocol" "$target" "$port" \
            "$ATTACK_START_TIME" "$ATTACK_END_TIME" "$status" \
            "$username" "$password" "$ATTACK_ATTEMPTS" "$ATTACK_WORDLIST_COUNT")
        
        # Save metadata
        save_attack_metadata "$protocol" "$target" "$port" "$status" "$report_file"
        
        # Show summary
        generate_summary "$protocol" "$target" "$status" "$report_file"
        
        return 0
    else
        log_warning "Report generator not found - skipping detailed report"
        return 1
    fi
}

# Save attack metadata
save_attack_metadata() {
    local protocol="$1"
    local target="$2"
    local port="$3"
    local status="$4"
    local report_file="$5"
    
    local metadata_entry
    metadata_entry=$(jq -n \
        --arg protocol "$protocol" \
        --arg target "$target" \
        --arg port "$port" \
        --arg status "$status" \
        --arg start_time "$ATTACK_START_TIME" \
        --arg end_time "$ATTACK_END_TIME" \
        --arg attempts "$ATTACK_ATTEMPTS" \
        --arg wordlist_count "$ATTACK_WORDLIST_COUNT" \
        --arg report_file "$report_file" \
        '{protocol: $protocol, target: $target, port: $port, status: $status, start_time: $start_time, end_time: $end_time, attempts: $attempts, wordlist_count: $wordlist_count, report_file: $report_file}')
    
    if [ -f "$ATTACK_METADATA_FILE" ]; then
        local temp_file

        temp_file=$(mktemp)
        jq --argjson entry "$metadata_entry" '. += [$entry]' "$ATTACK_METADATA_FILE" > "$temp_file" 2>/dev/null && \
            mv "$temp_file" "$ATTACK_METADATA_FILE"
    fi
}

# Export results to CSV
export_to_csv() {
    local output_file="$1"
    if [ -f "$RESULTS_FILE" ]; then
        echo "Timestamp,Protocol,Target,Port,Username,Password" > "$output_file"
        jq -r '.[] | [.timestamp, .protocol, .target, .port, .username, .password] | @csv' "$RESULTS_FILE" >> "$output_file" 2>/dev/null
        log_success "Results exported to CSV: $output_file"
    else
        log_error "No results file found"
    fi
}

# Export results to TXT
export_to_txt() {
    local output_file="$1"
    if [ -f "$RESULTS_FILE" ]; then
        jq -r '.[] | "\(.timestamp) | \(.protocol)://\(.username):\(.password)@\(.target):\(.port)"' "$RESULTS_FILE" > "$output_file" 2>/dev/null
        log_success "Results exported to TXT: $output_file"
    else
        log_error "No results file found"
    fi
}

# Rotate logs (keep last 30 days)
rotate_logs() {
    find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null
    find "$LOG_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null
    log_info "Log rotation completed"
}

# Print banner
print_banner() {
    local title="$1"
    print_message "╔════════════════════════════════════════════════════════════╗" "$CYAN"
    printf "${CYAN}║%-60s║${NC}\n" "$(printf "%*s" $(((60+${#title})/2)) "$title")"
    print_message "╚════════════════════════════════════════════════════════════╝" "$CYAN"
}

# Print section header
print_header() {
    local header="$1"
    echo ""
    print_message "═══ $header ═══" "$MAGENTA"
}

# VPN Check Warning
check_vpn_warn() {
    local vpn_script="$PROJECT_ROOT/scripts/vpn_check.sh"
    
    # Source VPN check if available
    if [ -f "$vpn_script" ]; then
        source "$vpn_script"
        
        # Check if VPN is connected
        if ! check_vpn_connection "false" 2>/dev/null; then
            echo ""
            log_warning "═════════════════════════════════════════════════════════"
            log_warning "  ⚠️  VPN NOT DETECTED - ANONYMITY AT RISK  ⚠️"
            log_warning "═════════════════════════════════════════════════════════"
            log_warning "It is STRONGLY recommended to use a VPN when running"
            log_warning "penetration testing tools to protect your identity."
            log_warning ""
            log_warning "VPN Detection Methods (all failed):"
            log_warning "  ✗ Network interface check (tun/tap/wg)"
            log_warning "  ✗ VPN process check (openvpn/wireguard)"
            log_warning "  ✗ DNS check (VPN-provided DNS)"
            log_warning ""
            log_warning "Recommended Actions:"
            log_warning "  • Install OpenVPN: pkg install openvpn"
            log_warning "  • Install WireGuard: pkg install wireguard-tools"
            log_warning "  • Use commercial VPN: NordVPN, ExpressVPN, etc."
            log_warning "═════════════════════════════════════════════════════════"
            echo ""
            
            # Ask user if they want to continue
            if [ -t 0 ]; then  # Check if stdin is a terminal
                read -r -p "Continue without VPN? (y/N): " response
                if [[ ! "$response" =~ ^[Yy]$ ]]; then
                    log_info "Exiting. Please connect to VPN and try again."
                    exit 0
                fi
                log_warning "Proceeding WITHOUT VPN protection..."
            fi
        else
            log_success "VPN connection verified ✓"
        fi
    fi
}

# Track IP for rotation monitoring
track_ip_rotation() {
    local user_id="${1:-unknown}"
    local log_file="$LOG_DIR/ip_rotation_${user_id}.log"
    
    # Rotate log file if it exceeds 10000 lines
    if [ -f "$log_file" ]; then
        local line_count

        line_count=$(wc -l < "$log_file" 2>/dev/null || echo "0")
        if [ "$line_count" -gt 10000 ]; then
            # Archive old log and start fresh
            local archive_file
            archive_file="$LOG_DIR/ip_rotation_${user_id}_$(date +%Y%m%d_%H%M%S).log.gz"
            gzip -c "$log_file" > "$archive_file" 2>/dev/null || true
            # Keep only last 1000 entries in active log
            tail -n 1000 "$log_file" > "$log_file.tmp"
            mv "$log_file.tmp" "$log_file"
            log_debug "IP Rotation: Log rotated, archived to $(basename "$archive_file")"
        fi
    fi
    
    # Get current public IP
    # Uses external service (https://api.ipify.org); if unavailable, logs a warning and skips tracking
    local current_ip="unknown"
    if command -v curl &>/dev/null; then
        local ip_output
        ip_output=$(curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$ip_output" ]; then
            current_ip="$ip_output"
        else
            log_warn "IP Rotation: Failed to fetch public IP from https://api.ipify.org (network/firewall issue?). Skipping IP rotation tracking for this run."
            return 1
        fi
    else
        log_warn "IP Rotation: 'curl' command not found. Cannot fetch public IP; IP rotation tracking is disabled for this run."
        return 1
    fi
    
    if [ "$current_ip" != "unknown" ] && [ -n "$current_ip" ]; then
        local timestamp
        timestamp=$(date "+%Y-%m-%d %H:%M:%S")
        local now_epoch
        now_epoch=$(date +%s)
        echo "$timestamp|$current_ip|$now_epoch" >> "$log_file"
        
        # Count unique IPs in last hour (using epoch timestamps for portability)
        local one_hour_ago_epoch

        one_hour_ago_epoch=$((now_epoch - 3600))
        local unique_ips=0
        
        if [ -f "$log_file" ]; then
            unique_ips=$(awk -F'|' -v cutoff_epoch="$one_hour_ago_epoch" 'NF >= 3 && ($3 + 0) >= (cutoff_epoch + 0) {print $2}' "$log_file" 2>/dev/null | sort -u | wc -l)
        fi
        
        log_debug "IP Rotation: Current=$current_ip, Unique IPs (last hour)=$unique_ips"
        
        # Check if approaching the 1000 IP threshold
        local total_ips

        total_ips=$(wc -l < "$log_file" 2>/dev/null || echo "0")
        if [ "$total_ips" -ge 900 ] && [ "$total_ips" -lt 1000 ]; then
            log_info "IP Rotation: $total_ips/1000 IPs tracked ($(($total_ips * 100 / 1000))%)"
        elif [ "$total_ips" -ge 1000 ]; then
            log_success "IP Rotation: Reached tracking threshold (1000+ IPs)"
        fi
    fi
}

# Get IP rotation statistics
get_ip_rotation_stats() {
    local user_id="${1:-unknown}"
    local log_file="$LOG_DIR/ip_rotation_${user_id}.log"
    
    if [ -f "$log_file" ]; then
        local total_ips

        total_ips=$(wc -l < "$log_file")
        local unique_ips

        unique_ips=$(cut -d'|' -f2 "$log_file" | sort -u | wc -l)
        local first_seen

        first_seen=$(head -n1 "$log_file" | cut -d'|' -f1)
        local last_seen

        last_seen=$(tail -n1 "$log_file" | cut -d'|' -f1)
        
        echo "Total IPs tracked: $total_ips"
        echo "Unique IPs: $unique_ips"
        echo "First seen: $first_seen"
        echo "Last seen: $last_seen"
        echo "Threshold reached: $([[ $total_ips -ge 1000 ]] && echo "Yes" || echo "No ($total_ips/1000)")"
    else
        echo "No IP rotation data found for user: $user_id"
    fi
}

# Progress bar
show_progress() {
    local current=$1
    local total=$2
    local percent

    percent=$((current * 100 / total))
    local completed

    completed=$((percent / 2))
    local remaining

    remaining=$((50 - completed))
    
    printf "\r${CYAN}Progress: [${GREEN}"
    printf "%${completed}s" | tr ' ' '='
    printf "${NC}"
    printf "%${remaining}s" | tr ' ' '-'
    printf "${CYAN}] ${percent}%%${NC}"
    
    [ $current -eq $total ] && echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# REAL-TIME FEEDBACK AND ERROR DIAGNOSTICS FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

# Function to provide real-time status updates
realtime_status() {
    local status="$1"
    local message="$2"
    local timestamp

    timestamp=$(date "+%H:%M:%S")
    
    case "$status" in
        "starting")
            printf "${CYAN}[${timestamp}]${NC} 🚀 ${BLUE}STARTING:${NC} %s\n" "$message"
            ;;
        "running")
            printf "${CYAN}[${timestamp}]${NC} ⚡ ${YELLOW}RUNNING:${NC} %s\n" "$message"
            ;;
        "progress")
            printf "${CYAN}[${timestamp}]${NC} 📊 ${MAGENTA}PROGRESS:${NC} %s\n" "$message"
            ;;
        "success")
            printf "${CYAN}[${timestamp}]${NC} ✅ ${GREEN}SUCCESS:${NC} %s\n" "$message"
            ;;
        "failure")
            printf "${CYAN}[${timestamp}]${NC} ❌ ${RED}FAILURE:${NC} %s\n" "$message"
            ;;
        "warning")
            printf "${CYAN}[${timestamp}]${NC} ⚠️  ${YELLOW}WARNING:${NC} %s\n" "$message"
            ;;
        *)
            printf "${CYAN}[${timestamp}]${NC} ℹ️  ${NC}%s\n" "$message"
            ;;
    esac
}

# Function to diagnose and explain protocol failures
diagnose_failure() {
    local protocol="$1"
    local error_code="$2"
    local error_message="$3"
    local target="$4"
    local port="${5:-default}"
    
    print_header "🔍 FAILURE DIAGNOSIS - ${protocol^^} Protocol"
    echo ""
    
    # Common failure patterns and solutions
    case "$protocol" in
        ssh)
            diagnose_ssh_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        ftp)
            diagnose_ftp_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        mysql)
            diagnose_mysql_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        postgresql|postgres)
            diagnose_postgres_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        rdp)
            diagnose_rdp_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        smb)
            diagnose_smb_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        http|https|web)
            diagnose_web_failure "$error_code" "$error_message" "$target" "$port"
            ;;
        *)
            diagnose_generic_failure "$error_code" "$error_message" "$target" "$port"
            ;;
    esac
}

# SSH-specific failure diagnosis
diagnose_ssh_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "SSH attack failed on ${target}:${port}"
    echo ""
    
    # Analyze error message for common issues
    if echo "$error_message" | grep -qi "connection refused"; then
        print_message "❌ PROBLEM: Connection Refused" "$RED"
        echo ""
        print_message "📋 POSSIBLE CAUSES:" "$YELLOW"
        echo "  1. SSH service is not running on target"
        echo "  2. Firewall is blocking port ${port}"
        echo "  3. Wrong port number (SSH default is 22)"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Verify SSH is running: nmap -p ${port} ${target}"
        echo "  • Try different common SSH ports: 22, 2222, 22222"
        echo "  • Check if target is actually online: ping ${target}"
        echo "  • Scan all ports: nmap -p- ${target}"
        echo ""
    elif echo "$error_message" | grep -qi "timeout\|timed out"; then
        print_message "❌ PROBLEM: Connection Timeout" "$RED"
        echo ""
        print_message "📋 POSSIBLE CAUSES:" "$YELLOW"
        echo "  1. Target is offline or unreachable"
        echo "  2. Network latency is too high"
        echo "  3. Firewall is silently dropping packets"
        echo "  4. Rate limiting / IDS blocking attempts"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Increase timeout: bash scripts/ssh_admin_attack.sh -t ${target} -o 60"
        echo "  • Reduce threads: bash scripts/ssh_admin_attack.sh -t ${target} -T 8"
        echo "  • Check target is online: ping ${target}"
        echo "  • Use stealth scan first: nmap -sS ${target}"
        echo "  • Add delay between attempts: --skip-vpn (if internal network)"
        echo ""
    elif echo "$error_message" | grep -qi "key exchange\|algorithm"; then
        print_message "❌ PROBLEM: SSH Key Exchange Failed" "$RED"
        echo ""
        print_message "📋 POSSIBLE CAUSES:" "$YELLOW"
        echo "  1. Old SSH version with deprecated algorithms"
        echo "  2. Custom SSH configuration blocking connections"
        echo "  3. SSH server using non-standard encryption"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Update Hydra: pkg upgrade hydra"
        echo "  • Test manual connection: ssh -p ${port} root@${target}"
        echo "  • Try legacy algorithms: ssh -oKexAlgorithms=+diffie-hellman-group1-sha1 ${target}"
        echo ""
    elif echo "$error_message" | grep -qi "authentication\|denied\|failed"; then
        print_message "❌ PROBLEM: All Authentication Attempts Failed" "$RED"
        echo ""
        print_message "📋 POSSIBLE CAUSES:" "$YELLOW"
        echo "  1. None of the passwords in wordlist are correct"
        echo "  2. Account lockout policy triggered"
        echo "  3. SSH configured for key-only authentication"
        echo "  4. Usernames don't exist on target"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Try blank password: (already tried if optimization enabled)"
        echo "  • Use better wordlist: bash scripts/download_wordlists.sh"
        echo "  • Generate custom wordlist: bash scripts/wordlist_generator.sh"
        echo "  • Try common usernames: root, admin, ubuntu, user"
        echo "  • Check for key-only auth: ssh -p ${port} ${target} (if prompted for password, it's OK)"
        echo "  • Wait before retrying (lockout policy may be active)"
        echo ""
    elif echo "$error_message" | grep -qi "no route\|unreachable"; then
        print_message "❌ PROBLEM: Network Unreachable" "$RED"
        echo ""
        print_message "📋 POSSIBLE CAUSES:" "$YELLOW"
        echo "  1. Target IP is not routable"
        echo "  2. Network interface is down"
        echo "  3. VPN/proxy issues"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Check network: ping ${target}"
        echo "  • Verify IP address is correct"
        echo "  • Check VPN connection if required"
        echo "  • Try traceroute: traceroute ${target}"
        echo ""
    else
        print_message "❌ PROBLEM: Unknown SSH Failure" "$RED"
        echo ""
        print_message "📋 ERROR DETAILS:" "$YELLOW"
        echo "  ${error_message}"
        echo ""
        print_message "✅ GENERAL TROUBLESHOOTING:" "$GREEN"
        echo "  • Verify target is online: nmap -sn ${target}"
        echo "  • Check SSH is running: nmap -p ${port} -sV ${target}"
        echo "  • Try manual connection: ssh -p ${port} root@${target}"
        echo "  • View optimization tips: bash scripts/ssh_admin_attack.sh --tips"
        echo "  • Check logs: tail -f logs/hydra_$(date +%Y%m%d).log"
        echo ""
    fi
    
    print_message "💡 OPTIMIZATION TIPS:" "$CYAN"
    echo "  • View SSH optimization strategies: bash scripts/ssh_admin_attack.sh --tips"
    echo "  • Try with fewer threads: -T 8 (instead of default 32)"
    echo "  • Increase timeout: -o 30 (instead of default 15s)"
    echo ""
}

# FTP-specific failure diagnosis
diagnose_ftp_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "FTP attack failed on ${target}:${port}"
    echo ""
    
    if echo "$error_message" | grep -qi "connection refused"; then
        print_message "❌ PROBLEM: Connection Refused" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Verify FTP is running: nmap -p ${port} ${target}"
        echo "  • Try standard FTP port: 21"
        echo "  • Check for FTPS (FTP over SSL): port 990"
        echo "  • Try anonymous FTP first: ftp -n ${target}"
        echo ""
    elif echo "$error_message" | grep -qi "timeout"; then
        print_message "❌ PROBLEM: Connection Timeout" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Reduce threads (FTP may rate-limit): -T 16"
        echo "  • Increase timeout: -o 20"
        echo "  • Check passive vs active mode settings"
        echo ""
    else
        print_message "❌ PROBLEM: FTP Authentication Failed" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Try anonymous login FIRST: ftp -n ${target}, then: user anonymous, pass anonymous"
        echo "  • Common FTP users: ftp, ftpuser, admin, anonymous"
        echo "  • Try blank password (30-50% success on misconfigurations)"
        echo "  • View FTP tips: bash scripts/ftp_admin_attack.sh --tips"
        echo ""
    fi
}

# MySQL-specific failure diagnosis
diagnose_mysql_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "MySQL attack failed on ${target}:${port}"
    echo ""
    
    if echo "$error_message" | grep -qi "connection refused\|can't connect"; then
        print_message "❌ PROBLEM: Cannot Connect to MySQL" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Verify MySQL is running: nmap -p ${port} -sV ${target}"
        echo "  • Check MySQL is bound to external interface (not just localhost)"
        echo "  • Try default port: 3306"
        echo "  • Test connection: mysql -h ${target} -P ${port} -u root -p"
        echo ""
    elif echo "$error_message" | grep -qi "access denied\|authentication"; then
        print_message "❌ PROBLEM: MySQL Authentication Failed" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Try root with BLANK password: mysql -h ${target} -u root"
        echo "  • Common MySQL users: root, admin, mysql, dbadmin"
        echo "  • Try common passwords: root, mysql, password, admin, toor"
        echo "  • Check if user can connect from your IP: MySQL may restrict by host"
        echo "  • View MySQL tips: bash scripts/mysql_admin_attack.sh --tips"
        echo ""
    elif echo "$error_message" | grep -qi "timeout"; then
        print_message "❌ PROBLEM: MySQL Connection Timeout" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Increase timeout: -o 30 (MySQL needs more time for handshake)"
        echo "  • Reduce threads: -T 12 (MySQL has connection limits)"
        echo "  • Check MySQL max_connections setting"
        echo ""
    else
        print_message "❌ PROBLEM: Unknown MySQL Error" "$RED"
        echo ""
        print_message "✅ GENERAL FIXES:" "$GREEN"
        echo "  • Test blank password: 15-25% success rate!"
        echo "  • Verify MySQL version: nmap -p ${port} -sV ${target}"
        echo "  • Check for MySQL firewall rules"
        echo "  • Try: mysql -h ${target} -P ${port} -u root -p"
        echo ""
    fi
}

# PostgreSQL-specific failure diagnosis
diagnose_postgres_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "PostgreSQL attack failed on ${target}:${port}"
    echo ""
    
    if echo "$error_message" | grep -qi "connection refused"; then
        print_message "❌ PROBLEM: Connection Refused" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Verify PostgreSQL is running: nmap -p ${port} -sV ${target}"
        echo "  • Check pg_hba.conf allows external connections"
        echo "  • Verify listen_addresses in postgresql.conf"
        echo "  • Default port is 5432"
        echo ""
    elif echo "$error_message" | grep -qi "authentication\|password"; then
        print_message "❌ PROBLEM: PostgreSQL Authentication Failed" "$RED"
        echo ""
        print_message "✅ HOW TO FIX:" "$GREEN"
        echo "  • Primary user is 'postgres' (90% of attacks target this)"
        echo "  • Try: psql -h ${target} -p ${port} -U postgres"
        echo "  • Common passwords: postgres, password, admin"
        echo "  • Check pg_hba.conf for allowed authentication methods"
        echo "  • View Postgres tips: bash scripts/postgres_admin_attack.sh --tips"
        echo ""
    else
        print_message "❌ PROBLEM: PostgreSQL Connection Failed" "$RED"
        echo ""
        print_message "✅ GENERAL FIXES:" "$GREEN"
        echo "  • Test connection: psql -h ${target} -p ${port} -U postgres"
        echo "  • Check PostgreSQL logs on target"
        echo "  • Verify database name (default: postgres)"
        echo ""
    fi
}

# RDP-specific failure diagnosis
diagnose_rdp_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "RDP attack failed on ${target}:${port}"
    echo ""
    
    print_message "❌ PROBLEM: RDP Attack Failed" "$RED"
    echo ""
    print_message "⚠️  IMPORTANT: RDP is SLOW and has lockout policies!" "$YELLOW"
    echo ""
    print_message "✅ HOW TO FIX:" "$GREEN"
    echo "  • Use LOW thread count: -T 4 (MAX 8 to avoid lockouts)"
    echo "  • Increase timeout: -o 60 (RDP needs more time)"
    echo "  • Try Administrator with blank password first"
    echo "  • Check if NLA (Network Level Authentication) is enabled"
    echo "  • Verify RDP is enabled: nmap -p ${port} --script rdp-enum-encryption ${target}"
    echo "  • WAIT 30+ minutes between attempts (lockout policy)"
    echo "  • View RDP tips: bash scripts/rdp_admin_attack.sh --tips"
    echo ""
    print_message "💡 RDP-SPECIFIC NOTES:" "$CYAN"
    echo "  • Account lockouts are COMMON on RDP"
    echo "  • Default lockout: 5 failed attempts = 30 minute ban"
    echo "  • Use VERY slow attack: -T 4 -o 60"
    echo ""
}

# SMB-specific failure diagnosis
diagnose_smb_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "SMB attack failed on ${target}:${port}"
    echo ""
    
    print_message "❌ PROBLEM: SMB Attack Failed" "$RED"
    echo ""
    print_message "✅ HOW TO FIX:" "$GREEN"
    echo "  • Try guest account FIRST: smbclient //$ {target}/IPC$ -N"
    echo "  • Check SMB version: smbclient -L //${target}/ -N"
    echo "  • Common users: Administrator, admin, guest"
    echo "  • Guest account success: 30-40% if enabled"
    echo "  • Try null session: smbclient //${target}/IPC$ -N"
    echo "  • Enumerate shares: smbmap -H ${target}"
    echo "  • View SMB tips: bash scripts/smb_admin_attack.sh --tips"
    echo ""
    print_message "💡 SMB VERSIONS:" "$CYAN"
    echo "  • SMBv1: Old and vulnerable (EternalBlue)"
    echo "  • SMBv2/3: More secure, harder to attack"
    echo "  • Check version before attacking"
    echo ""
}

# Web-specific failure diagnosis
diagnose_web_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "Web attack failed on ${target}:${port}"
    echo ""
    
    print_message "❌ PROBLEM: Web Admin Attack Failed" "$RED"
    echo ""
    print_message "✅ HOW TO FIX:" "$GREEN"
    echo "  • Detect CMS first: whatweb ${target}"
    echo "  • WordPress: try /wp-admin or /wp-login.php"
    echo "  • Check for rate limiting (429 responses)"
    echo "  • Verify login path is correct"
    echo "  • Try common paths: /admin, /login, /administrator"
    echo "  • Check robots.txt for hidden paths"
    echo "  • Look for backup files: /backup.sql, /config.php.bak"
    echo "  • View Web tips: bash scripts/web_admin_attack.sh --tips"
    echo ""
    print_message "💡 WEB-SPECIFIC NOTES:" "$CYAN"
    echo "  • Rate limiting is COMMON (add delays)"
    echo "  • Check for CAPTCHA"
    echo "  • Monitor for 429 (Too Many Requests) responses"
    echo ""
}

# Generic failure diagnosis
diagnose_generic_failure() {
    local error_code="$1"
    local error_message="$2"
    local target="$3"
    local port="$4"
    
    log_error "Attack failed on ${target}:${port}"
    echo ""
    
    print_message "❌ PROBLEM: Attack Failed" "$RED"
    echo ""
    print_message "📋 ERROR DETAILS:" "$YELLOW"
    echo "  ${error_message}"
    echo ""
    print_message "✅ GENERAL TROUBLESHOOTING:" "$GREEN"
    echo "  • Verify target is online: ping ${target}"
    echo "  • Scan target: nmap -sV ${target}"
    echo "  • Check if service is running on port ${port}"
    echo "  • Try with fewer threads: -T 8"
    echo "  • Increase timeout: -o 30"
    echo "  • Check network connectivity"
    echo "  • View logs: tail -f logs/hydra_$(date +%Y%m%d).log"
    echo ""
}

# Function to show real-time attack progress with details
show_realtime_progress() {
    local protocol="$1"
    local target="$2"
    local port="$3"
    local current="$4"
    local total="$5"
    local found="${6:-0}"
    
    local percent

    
    percent=$((current * 100 / total))
    local completed

    completed=$((percent / 2))
    local remaining

    remaining=$((50 - completed))
    
    # Clear line and show progress
    printf "\r${CYAN}[%s]${NC} " "$(date +%H:%M:%S)"
    printf "${BLUE}%s${NC}://${YELLOW}%s${NC}:${GREEN}%s${NC} " "$protocol" "$target" "$port"
    printf "${CYAN}[${GREEN}"
    printf "%${completed}s" | tr ' ' '='
    printf "${NC}"
    printf "%${remaining}s" | tr ' ' '-'
    printf "${CYAN}]${NC} "
    printf "${MAGENTA}%3d%%${NC} " "$percent"
    printf "${CYAN}(%d/%d)${NC} " "$current" "$total"
    printf "${GREEN}Found: %d${NC}" "$found"
    
    [ "$current" -eq "$total" ] && echo ""
}

# Export functions
export -f realtime_status
export -f diagnose_failure
export -f diagnose_ssh_failure
export -f diagnose_ftp_failure
export -f diagnose_mysql_failure
export -f diagnose_postgres_failure
export -f diagnose_rdp_failure
export -f diagnose_smb_failure
export -f diagnose_web_failure
export -f diagnose_generic_failure
export -f show_realtime_progress
export -f check_vpn_warn
export -f track_ip_rotation
export -f get_ip_rotation_stats

# If sourced, make functions available
# If executed directly, show usage
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    print_banner "Hydra-Termux Logger Utility"
    echo ""
    print_message "This script is meant to be sourced by other scripts:" "$YELLOW"
    print_message "  source scripts/logger.sh" "$GREEN"
    echo ""
    print_message "Available functions:" "$BLUE"
    echo "  - log_success, log_error, log_warning, log_info, log_debug"
    echo "  - log_progress, save_result, export_to_csv, export_to_txt"
    echo "  - print_banner, print_header, show_progress, rotate_logs"
    echo "  - realtime_status, diagnose_failure, show_realtime_progress"
    echo ""
fi
