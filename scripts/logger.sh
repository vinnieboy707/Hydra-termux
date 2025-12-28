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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
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
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    # Create JSON entry
    local json_entry=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "protocol": "$protocol",
  "target": "$target",
  "port": "$port",
  "username": "$username",
  "password": "$password"
}
EOF
)
    
    # Add to results file
    if [ -f "$RESULTS_FILE" ]; then
        local temp_file=$(mktemp)
        jq ". += [$json_entry]" "$RESULTS_FILE" > "$temp_file" 2>/dev/null || {
            # If jq fails, fall back to simple append
            echo "$json_entry" >> "$LOG_DIR/results_fallback.txt"
        }
        [ -f "$temp_file" ] && mv "$temp_file" "$RESULTS_FILE"
    fi
    
    log_success "Credentials saved: $protocol://$username:$password@$target:$port"
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

# Progress bar
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local completed=$((percent / 2))
    local remaining=$((50 - completed))
    
    printf "\r${CYAN}Progress: [${GREEN}"
    printf "%${completed}s" | tr ' ' '='
    printf "${NC}"
    printf "%${remaining}s" | tr ' ' '-'
    printf "${CYAN}] ${percent}%%${NC}"
    
    [ $current -eq $total ] && echo ""
}

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
    echo ""
fi
