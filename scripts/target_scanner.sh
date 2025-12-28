#!/bin/bash

# Target Scanner
# Quick nmap wrapper for reconnaissance

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default configuration
TARGET=""
SCAN_TYPE="quick"
OUTPUT_DIR="$PROJECT_ROOT/results"
OUTPUT_FORMAT="normal"

# Function to display help
show_help() {
    print_banner "Target Scanner"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP, hostname, or CIDR range"
    echo ""
    echo "Optional:"
    echo "  -s, --scan-type   Scan type: quick, full, stealth, aggressive (default: quick)"
    echo "  -o, --output      Output directory (default: ./results)"
    echo "  -f, --format      Output format: normal, xml, json (default: normal)"
    echo "  -p, --ports       Custom port range (e.g., 1-1000)"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Scan Types:"
    echo "  quick       - Fast scan of common ports (top 100)"
    echo "  full        - Complete scan of all 65535 ports"
    echo "  stealth     - SYN stealth scan"
    echo "  aggressive  - Aggressive scan with OS detection"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t 192.168.1.0/24 -s full"
    echo "  $0 -t example.com -s aggressive -f xml"
    echo ""
}

# Function to validate input
validate_input() {
    if [ -z "$TARGET" ]; then
        log_error "Target is required"
        show_help
        exit 1
    fi
    
    if ! command -v nmap &> /dev/null; then
        log_error "Nmap is not installed. Please run install.sh first"
        exit 1
    fi
    
    mkdir -p "$OUTPUT_DIR"
}

# Function to run scan
run_scan() {
    print_header "Starting Target Scan"
    
    log_info "Target: $TARGET"
    log_info "Scan Type: $SCAN_TYPE"
    
    local nmap_opts=""
    local scan_desc=""
    
    case "$SCAN_TYPE" in
        quick)
            nmap_opts="-F -T4"
            scan_desc="Quick scan (top 100 ports)"
            ;;
        full)
            nmap_opts="-p- -T4"
            scan_desc="Full scan (all 65535 ports)"
            ;;
        stealth)
            nmap_opts="-sS -T2"
            scan_desc="Stealth SYN scan"
            ;;
        aggressive)
            nmap_opts="-A -T4"
            scan_desc="Aggressive scan with OS detection"
            ;;
        *)
            log_error "Unknown scan type: $SCAN_TYPE"
            exit 1
            ;;
    esac
    
    # Add custom ports if specified
    if [ -n "$CUSTOM_PORTS" ]; then
        nmap_opts="$nmap_opts -p $CUSTOM_PORTS"
        scan_desc="$scan_desc (custom ports: $CUSTOM_PORTS)"
    fi
    
    log_info "Description: $scan_desc"
    echo ""
    
    # Determine output format
    local output_file="$OUTPUT_DIR/scan_${TARGET//[.\/:]/_}_$(date +%Y%m%d_%H%M%S)"
    local format_opt=""
    
    case "$OUTPUT_FORMAT" in
        xml)
            format_opt="-oX ${output_file}.xml"
            ;;
        json)
            format_opt="-oX ${output_file}.xml"
            ;;
        normal|*)
            format_opt="-oN ${output_file}.txt"
            ;;
    esac
    
    log_progress "Running nmap scan..."
    echo ""
    
    # Run nmap
    nmap $nmap_opts -sV $format_opt "$TARGET" 2>&1 | tee "${output_file}_verbose.txt"
    
    local result=$?
    
    if [ $result -eq 0 ]; then
        log_success "Scan completed successfully"
        
        # Parse and display summary
        parse_results "$output_file"
    else
        log_error "Scan failed"
        return 1
    fi
}

# Function to parse scan results
parse_results() {
    local output_file="$1"
    
    print_header "Scan Summary"
    
    local scan_file="${output_file}.txt"
    
    if [ "$OUTPUT_FORMAT" = "xml" ]; then
        scan_file="${output_file}.xml"
    fi
    
    if [ ! -f "$scan_file" ]; then
        log_warning "Output file not found"
        return 1
    fi
    
    # Extract open ports
    if [ "$OUTPUT_FORMAT" = "xml" ]; then
        local open_ports=$(grep -oP 'portid="\K[0-9]+(?=")' "$scan_file" 2>/dev/null | wc -l)
    else
        local open_ports=$(grep -c "^[0-9]*/.*open" "$scan_file" 2>/dev/null || echo 0)
    fi
    
    log_info "Open ports found: $open_ports"
    
    # Display open ports and services
    if [ "$OUTPUT_FORMAT" = "xml" ]; then
        echo ""
        log_info "Services detected:"
        grep -oP 'portid="\K[0-9]+' "$scan_file" 2>/dev/null | while read -r port; do
            local service=$(grep "portid=\"$port\"" "$scan_file" | grep -oP 'name="\K[^"]+' | head -1)
            [ -n "$service" ] && printf "  ${GREEN}Port $port${NC}: $service\n"
        done
    else
        echo ""
        log_info "Services detected:"
        grep "^[0-9]*/.*open" "$scan_file" 2>/dev/null | while read -r line; do
            printf "  ${GREEN}$line${NC}\n"
        done
    fi
    
    echo ""
    log_success "Results saved to: $scan_file"
    
    # Suggest next steps
    if [ $open_ports -gt 0 ]; then
        print_header "Suggested Next Steps"
        log_info "Run auto attack: bash scripts/admin_auto_attack.sh -t $TARGET"
        log_info "View results: bash scripts/results_viewer.sh --all"
    fi
}

# Parse command line arguments
VERBOSE=false
CUSTOM_PORTS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -s|--scan-type)
            SCAN_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -p|--ports)
            CUSTOM_PORTS="$2"
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
print_banner "Target Scanner"
echo ""

validate_input
run_scan

exit $?
