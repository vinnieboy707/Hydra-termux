#!/bin/bash

# Wordlist Download Manager
# Downloads and organizes password wordlists

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Wordlist directory
WORDLIST_DIR="${WORDLIST_DIR:-$HOME/wordlists}"
mkdir -p "$WORDLIST_DIR"

# Wordlist sources
declare -A WORDLISTS=(
    ["common_passwords"]="https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10k-most-common.txt"
    ["rockyou_top1000"]="https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/top-20-common-SSH-passwords.txt"
    ["admin_default"]="https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Default-Credentials/default-passwords.txt"
    ["usernames"]="https://raw.githubusercontent.com/danielmiessler/SecLists/master/Usernames/top-usernames-shortlist.txt"
)

# Function to display help
show_help() {
    print_banner "Wordlist Download Manager"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --all         Download all wordlists"
    echo "  -l, --list        List available wordlists"
    echo "  -d, --dir         Set wordlist directory (default: ~/wordlists)"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --all"
    echo "  $0 --list"
    echo "  $0 --dir /path/to/wordlists --all"
    echo ""
}

# Function to list wordlists
list_wordlists() {
    print_header "Available Wordlists"
    
    for name in "${!WORDLISTS[@]}"; do
        local file="$WORDLIST_DIR/${name}.txt"
        if [ -f "$file" ]; then
            local size
            size=$(du -h "$file" | cut -f1)
            local lines
            lines=$(wc -l < "$file")
            log_success "$name ($size, $lines lines) - Downloaded"
        else
            log_info "$name - Not downloaded"
        fi
    done
}

# Function to download wordlist
download_wordlist() {
    local name="$1"
    local url="${WORDLISTS[$name]}"
    local output="$WORDLIST_DIR/${name}.txt"
    
    if [ -z "$url" ]; then
        log_error "Unknown wordlist: $name"
        return 1
    fi
    
    log_progress "Downloading $name..."
    
    if command -v wget &> /dev/null; then
        wget -q --show-progress -O "$output" "$url" 2>&1
    elif command -v curl &> /dev/null; then
        curl -# -L -o "$output" "$url" 2>&1
    else
        log_error "Neither wget nor curl is installed"
        return 1
    fi
    
    if [ $? -eq 0 ] && [ -f "$output" ]; then
        local size
        size=$(du -h "$output" | cut -f1)
        local lines
        lines=$(wc -l < "$output")
        log_success "Downloaded $name ($size, $lines lines)"
        return 0
    else
        log_error "Failed to download $name"
        return 1
    fi
}

# Function to download all wordlists
download_all() {
    print_header "Downloading All Wordlists"
    
    local total=${#WORDLISTS[@]}
    local current=0
    local success=0
    
    for name in "${!WORDLISTS[@]}"; do
        current=$((current + 1))
        show_progress $current $total
        
        download_wordlist "$name"
        [ $? -eq 0 ] && success=$((success + 1))
        
        sleep 1
    done
    
    echo ""
    log_success "Downloaded $success/$total wordlists"
}

# Function to create custom admin wordlists
create_admin_lists() {
    print_header "Creating Admin Wordlists"
    
    # Create admin usernames
    local admin_users="$WORDLIST_DIR/admin_usernames.txt"
    cat > "$admin_users" << 'EOF'
root
admin
administrator
sysadmin
webadmin
dbadmin
ftpadmin
mysql
postgres
pgadmin
user
test
guest
support
manager
supervisor
operator
daemon
EOF
    log_success "Created: admin_usernames.txt"
    
    # Create common admin passwords
    local admin_pass="$WORDLIST_DIR/admin_passwords.txt"
    cat > "$admin_pass" << 'EOF'
admin
password
123456
admin123
root
password123
admin@123
P@ssw0rd
Admin123
root123
administrator
welcome
qwerty
letmein
changeme
admin1234
welcome123
passw0rd
password1
12345678
abc123
EOF
    log_success "Created: admin_passwords.txt"
}

# Function to verify wordlists
verify_wordlists() {
    print_header "Verifying Wordlists"
    
    local errors=0
    
    for name in "${!WORDLISTS[@]}"; do
        local file="$WORDLIST_DIR/${name}.txt"
        
        if [ ! -f "$file" ]; then
            log_warning "Missing: $name"
            errors=$((errors + 1))
        elif [ ! -s "$file" ]; then
            log_warning "Empty: $name"
            errors=$((errors + 1))
        else
            log_success "Valid: $name"
        fi
    done
    
    if [ $errors -eq 0 ]; then
        log_success "All wordlists verified"
    else
        log_warning "$errors wordlist(s) have issues"
    fi
}

# Parse command line arguments
DOWNLOAD_ALL=false
LIST_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            DOWNLOAD_ALL=true
            shift
            ;;
        -l|--list)
            LIST_ONLY=true
            shift
            ;;
        -d|--dir)
            WORDLIST_DIR="$2"
            mkdir -p "$WORDLIST_DIR"
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
print_banner "Wordlist Manager"
echo ""

log_info "Wordlist directory: $WORDLIST_DIR"
echo ""

if [ "$LIST_ONLY" = "true" ]; then
    list_wordlists
    exit 0
fi

if [ "$DOWNLOAD_ALL" = "true" ]; then
    download_all
    create_admin_lists
    verify_wordlists
    
    echo ""
    log_success "All operations completed"
    log_info "Wordlists saved to: $WORDLIST_DIR"
else
    show_help
fi
