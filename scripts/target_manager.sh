#!/bin/bash

# Target Manager Utility
# Handles CIDR notation, target lists, and multi-target operations

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to expand CIDR notation to individual IPs
expand_cidr() {
    local cidr="$1"
    
    # Check if nmap is available for easier expansion
    if command -v nmap &>/dev/null; then
        nmap -sL -n "$cidr" 2>/dev/null | grep "Nmap scan report" | awk '{print $NF}' | tr -d '()'
        return $?
    fi
    
    # Fallback: use ipcalc if available
    if command -v ipcalc &>/dev/null; then
        ipcalc "$cidr" | grep -oP '(?<=Host min:\s{3})[\d.]+' | while read -r start_ip; do
            # This is a simplified version - would need full CIDR expansion logic
            echo "$start_ip"
        done
        return 0
    fi
    
    echo -e "${YELLOW}[!] Install nmap for CIDR support: pkg install nmap${NC}" >&2
    return 1
}

# Function to validate IP address
validate_ip() {
    local ip="$1"
    
    if [[ $ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        # Check each octet
        local IFS='.'
        local -a octets
        read -ra octets <<< "$ip"
        for octet in "${octets[@]}"; do
            if [ "$octet" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

# Function to check if target is CIDR notation
is_cidr() {
    local target="$1"
    [[ "$target" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]]
}

# Function to check if target is IP range
is_ip_range() {
    local target="$1"
    [[ "$target" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}-([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

# Function to read targets from file
read_target_file() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}[!] Target file not found: $file${NC}" >&2
        return 1
    fi
    
    # Read and clean file (remove comments, empty lines)
    grep -v "^#" "$file" | grep -v "^$" | while read -r target; do
        echo "$target"
    done
}

# Function to process multiple targets
process_targets() {
    local input="$1"
    local targets=()
    
    # Check if input is a file
    if [ -f "$input" ]; then
        echo -e "${BLUE}[*] Reading targets from file: $input${NC}" >&2
        while IFS= read -r target; do
            targets+=("$target")
        done < <(read_target_file "$input")
    
    # Check if input is CIDR notation
    elif is_cidr "$input"; then
        echo -e "${BLUE}[*] Expanding CIDR notation: $input${NC}" >&2
        while IFS= read -r ip; do
            [ -n "$ip" ] && targets+=("$ip")
        done < <(expand_cidr "$input")
    
    # Check if input is IP range
    elif is_ip_range "$input"; then
        echo -e "${YELLOW}[!] IP range format detected. Use CIDR notation instead (e.g., 192.168.1.0/24)${NC}" >&2
        echo "$input"
        return 0
    
    # Single target
    else
        targets+=("$input")
    fi
    
    # Output targets
    for target in "${targets[@]}"; do
        echo "$target"
    done
}

# Function to count targets
count_targets() {
    local input="$1"
    process_targets "$input" | wc -l
}

# Function to create target batches for parallel processing
create_batches() {
    local input="$1"
    local batch_size="${2:-10}"
    local batch_num=0
    local count=0
    
    process_targets "$input" | while read -r target; do
        if [ $count -eq 0 ]; then
            echo "# Batch $batch_num"
        fi
        echo "$target"
        
        count=$((count + 1))
        if [ $count -ge $batch_size ]; then
            count=0
            batch_num=$((batch_num + 1))
        fi
    done
}

# Function to display target summary
show_target_summary() {
    local input="$1"
    local total_targets
    
    total_targets=$(count_targets "$input")
    
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         Target Summary                 ║${NC}"
    echo -e "${BLUE}╠════════════════════════════════════════╣${NC}"
    
    if [ -f "$input" ]; then
        echo -e "${BLUE}║ Type: Target List File                 ║${NC}"
        echo -e "${BLUE}║ File: $(printf '%-30s' "$(basename "$input")")║${NC}"
    elif is_cidr "$input"; then
        echo -e "${BLUE}║ Type: CIDR Notation                    ║${NC}"
        echo -e "${BLUE}║ Range: $(printf '%-29s' "$input")║${NC}"
    else
        echo -e "${BLUE}║ Type: Single Target                    ║${NC}"
        echo -e "${BLUE}║ Target: $(printf '%-28s' "$input")║${NC}"
    fi
    
    echo -e "${BLUE}║ Total Targets: $(printf '%-24s' "$total_targets")║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

# Main function for standalone execution
main() {
    local command=""
    local input=""
    local batch_size=10
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            expand|count|summary|batches)
                command="$1"
                shift
                ;;
            -i|--input)
                input="$2"
                shift 2
                ;;
            -b|--batch-size)
                batch_size="$2"
                shift 2
                ;;
            --help|-h)
                echo "Target Manager Utility"
                echo ""
                echo "Usage: $0 COMMAND -i INPUT [OPTIONS]"
                echo ""
                echo "Commands:"
                echo "  expand     Expand CIDR/file to individual targets"
                echo "  count      Count total number of targets"
                echo "  summary    Display target summary"
                echo "  batches    Create target batches for parallel processing"
                echo ""
                echo "Options:"
                echo "  -i, --input       Target input (IP, CIDR, or file path)"
                echo "  -b, --batch-size  Batch size for 'batches' command (default: 10)"
                echo "  -h, --help        Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 expand -i 192.168.1.0/24"
                echo "  $0 count -i targets.txt"
                echo "  $0 summary -i 10.0.0.0/16"
                echo "  $0 batches -i targets.txt -b 20"
                echo ""
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    if [ -z "$command" ] || [ -z "$input" ]; then
        echo "Error: Command and input are required"
        echo "Use --help for usage information"
        exit 1
    fi
    
    case "$command" in
        expand)
            process_targets "$input"
            ;;
        count)
            count_targets "$input"
            ;;
        summary)
            show_target_summary "$input"
            ;;
        batches)
            create_batches "$input" "$batch_size"
            ;;
    esac
}

# If script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
