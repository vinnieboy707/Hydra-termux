#!/bin/bash

# Results Viewer
# View and manage attack results

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Results directory
RESULTS_DIR="$PROJECT_ROOT/logs"

# Function to display help
show_help() {
    print_banner "Results Viewer"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --all         Show all results (past 30 days)"
    echo "  -p, --protocol    Filter by protocol (ssh, ftp, http, etc.)"
    echo "  -t, --target      Filter by target"
    echo "  -d, --date        Filter by date (YYYY-MM-DD)"
    echo "  -e, --export      Export results to file"
    echo "  -f, --format      Export format: txt, csv, json (default: txt)"
    echo "  -c, --clear       Clear old results (30+ days)"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Note: All commands default to showing results from the past 30 days."
    echo "      Results older than 30 days are available via --clear option."
    echo ""
    echo "Examples:"
    echo "  $0 --all"
    echo "  $0 --protocol ssh"
    echo "  $0 --export results.csv --format csv"
    echo ""
}

# Function to display all results (from past 30 days)
show_all_results() {
    print_header "All Attack Results (Past 30 Days)"
    
    # Find all results files from the past 30 days
    local results_files=$(find "$RESULTS_DIR" -name "results_*.json" -type f -mtime -30 2>/dev/null | sort -r)
    
    if [ -z "$results_files" ]; then
        log_warning "No results found in the past 30 days"
        return 1
    fi
    
    # Count total results
    local total_count=0
    for file in $results_files; do
        local count=$(jq '. | length' "$file" 2>/dev/null || echo 0)
        total_count=$((total_count + count))
    done
    
    if [ $total_count -eq 0 ]; then
        log_warning "No successful attacks recorded in the past 30 days"
        return 1
    fi
    
    log_success "Total successful attacks found: $total_count"
    echo ""
    
    # Display results grouped by date
    local file_count=0
    for results_file in $results_files; do
        local file_date=$(basename "$results_file" | sed 's/results_\(.*\)\.json/\1/')
        local formatted_date=$(echo "$file_date" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3/')
        local file_count_single=$(jq '. | length' "$results_file" 2>/dev/null || echo 0)
        
        if [ "$file_count_single" -gt 0 ]; then
            file_count=$((file_count + 1))
            
            # Show separator between dates
            if [ $file_count -gt 1 ]; then
                echo ""
            fi
            
            print_message "📅 Date: $formatted_date (${file_count_single} results)" "$YELLOW"
            echo ""
            
            # Display results in table format
            if [ $file_count -eq 1 ]; then
                printf "${CYAN}%-20s %-15s %-8s %-15s %-20s${NC}\n" "Timestamp" "Protocol" "Port" "Target" "Credentials"
                printf "${CYAN}%s${NC}\n" "$(printf '%.0s─' {1..90})"
            fi
            
            jq -r '.[] | "\(.timestamp)|\(.protocol)|\(.port)|\(.target)|\(.username):\(.password)"' "$results_file" 2>/dev/null | \
            while IFS='|' read -r timestamp protocol port target creds; do
                printf "%-20s %-15s %-8s %-15s ${GREEN}%-20s${NC}\n" "$timestamp" "$protocol" "$port" "$target" "$creds"
            done
        fi
    done
    
    echo ""
    log_info "Results older than 30 days are automatically archived"
}

# Function to filter results by protocol
filter_by_protocol() {
    local protocol="$1"
    
    print_header "Results for Protocol: $protocol (Past 30 Days)"
    
    local results_files=$(find "$RESULTS_DIR" -name "results_*.json" -type f -mtime -30 2>/dev/null)
    
    if [ -z "$results_files" ]; then
        log_warning "No results found in the past 30 days"
        return 1
    fi
    
    local count=0
    local temp_output=$(mktemp)
    
    for file in $results_files; do
        jq -r --arg proto "$protocol" '.[] | select(.protocol == $proto) | "\(.timestamp)|\(.target)|\(.port)|\(.username):\(.password)"' "$file" 2>/dev/null >> "$temp_output"
    done
    
    if [ ! -s "$temp_output" ]; then
        rm -f "$temp_output"
        log_warning "No results found for protocol: $protocol (in past 30 days)"
        return 1
    fi
    
    printf "${CYAN}%-20s %-15s %-8s %-20s${NC}\n" "Timestamp" "Target" "Port" "Credentials"
    printf "${CYAN}%s${NC}\n" "$(printf '%.0s─' {1..70})"
    
    while IFS='|' read -r timestamp target port creds; do
        printf "%-20s %-15s %-8s ${GREEN}%-20s${NC}\n" "$timestamp" "$target" "$port" "$creds"
        count=$((count + 1))
    done < "$temp_output"
    
    rm -f "$temp_output"
    
    echo ""
    log_success "Found $count result(s)"
}

# Function to filter results by target
filter_by_target() {
    local target="$1"
    
    print_header "Results for Target: $target (Past 30 Days)"
    
    local results_files=$(find "$RESULTS_DIR" -name "results_*.json" -type f -mtime -30 2>/dev/null)
    
    if [ -z "$results_files" ]; then
        log_warning "No results found in the past 30 days"
        return 1
    fi
    
    local count=0
    local temp_output=$(mktemp)
    
    for file in $results_files; do
        jq -r --arg tgt "$target" '.[] | select(.target == $tgt) | "\(.timestamp)|\(.protocol)|\(.port)|\(.username):\(.password)"' "$file" 2>/dev/null >> "$temp_output"
    done
    
    if [ ! -s "$temp_output" ]; then
        rm -f "$temp_output"
        log_warning "No results found for target: $target (in past 30 days)"
        return 1
    fi
    
    printf "${CYAN}%-20s %-15s %-8s %-20s${NC}\n" "Timestamp" "Protocol" "Port" "Credentials"
    printf "${CYAN}%s${NC}\n" "$(printf '%.0s─' {1..70})"
    
    while IFS='|' read -r timestamp protocol port creds; do
        printf "%-20s %-15s %-8s ${GREEN}%-20s${NC}\n" "$timestamp" "$protocol" "$port" "$creds"
        count=$((count + 1))
    done < "$temp_output"
    
    rm -f "$temp_output"
    
    echo ""
    log_success "Found $count result(s)"
}

# Function to export results
export_results() {
    local output_file="$1"
    local format="$2"
    
    print_header "Exporting Results (Past 30 Days)"
    
    local results_files=$(find "$RESULTS_DIR" -name "results_*.json" -type f -mtime -30 2>/dev/null)
    
    if [ -z "$results_files" ]; then
        log_error "No results found in the past 30 days"
        return 1
    fi
    
    case "$format" in
        csv)
            echo "Timestamp,Protocol,Target,Port,Username,Password" > "$output_file"
            for file in $results_files; do
                jq -r '.[] | [.timestamp, .protocol, .target, .port, .username, .password] | @csv' "$file" 2>/dev/null >> "$output_file"
            done
            ;;
        json)
            echo "[]" > "$output_file"
            for file in $results_files; do
                jq -s 'add' "$output_file" "$file" > "${output_file}.tmp" 2>/dev/null
                mv "${output_file}.tmp" "$output_file"
            done
            ;;
        txt|*)
            for file in $results_files; do
                jq -r '.[] | "\(.timestamp) | \(.protocol)://\(.username):\(.password)@\(.target):\(.port)"' "$file" 2>/dev/null >> "$output_file"
            done
            ;;
    esac
    
    if [ -f "$output_file" ]; then
        log_success "Results exported to: $output_file"
    else
        log_error "Export failed"
        return 1
    fi
}

# Function to clear old results
clear_old_results() {
    print_header "Clearing Old Results"
    
    local count=$(find "$RESULTS_DIR" -name "results_*.json" -mtime +30 -type f 2>/dev/null | wc -l)
    
    if [ $count -eq 0 ]; then
        log_info "No old results to clear"
        return 0
    fi
    
    log_warning "Found $count old result file(s)"
    read -p "Delete files older than 30 days? (y/n): " confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        find "$RESULTS_DIR" -name "results_*.json" -mtime +30 -type f -delete 2>/dev/null
        log_success "Old results cleared"
    else
        log_info "Operation cancelled"
    fi
}

# Parse command line arguments
SHOW_ALL=false
PROTOCOL=""
TARGET=""
EXPORT_FILE=""
EXPORT_FORMAT="txt"
CLEAR_OLD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            SHOW_ALL=true
            shift
            ;;
        -p|--protocol)
            PROTOCOL="$2"
            shift 2
            ;;
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -e|--export)
            EXPORT_FILE="$2"
            shift 2
            ;;
        -f|--format)
            EXPORT_FORMAT="$2"
            shift 2
            ;;
        -c|--clear)
            CLEAR_OLD=true
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
print_banner "Results Viewer"
echo ""

if [ "$SHOW_ALL" = "true" ]; then
    show_all_results
elif [ -n "$PROTOCOL" ]; then
    filter_by_protocol "$PROTOCOL"
elif [ -n "$TARGET" ]; then
    filter_by_target "$TARGET"
elif [ -n "$EXPORT_FILE" ]; then
    export_results "$EXPORT_FILE" "$EXPORT_FORMAT"
elif [ "$CLEAR_OLD" = "true" ]; then
    clear_old_results
else
    show_help
fi
