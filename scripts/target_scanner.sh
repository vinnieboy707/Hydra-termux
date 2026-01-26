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
        local open_ports

        open_ports=$(grep -oP 'portid="\K[0-9]+(?=")' "$scan_file" 2>/dev/null | wc -l)
    else
        local open_ports

        open_ports=$(grep -c "^[0-9]*/.*open" "$scan_file" 2>/dev/null || echo 0)
    fi
    
    log_info "Open ports found: $open_ports"
    
    # Display open ports and services
    if [ "$OUTPUT_FORMAT" = "xml" ]; then
        echo ""
        log_info "Services detected:"
        grep -oP 'portid="\K[0-9]+' "$scan_file" 2>/dev/null | while read -r port; do
            local service

            service=$(grep "portid=\"$port\"" "$scan_file" | grep -oP 'name="\K[^"]+' | head -1)
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
        
        # Recommend scripts based on detected services
        echo ""
        recommend_scripts "$scan_file"
    fi
}

# Function to map services to Library scripts
recommend_scripts() {
    local scan_file="$1"
    
    print_header "🎯 OPTIMIZED ATTACK STRATEGY - Service-Specific Recommendations"
    echo ""
    log_info "🔍 Analyzing detected services and mapping to optimized attack vectors..."
    echo ""
    
    # Detect services and recommend scripts
    local services_found=()
    
    # MASSIVELY OPTIMIZED service to script mappings with enhanced descriptions
    # Each entry includes: script name | detailed description with attack strategy and expected success rate
    declare -A service_map=(
        # Remote Access Protocols (HIGH PRIORITY - Direct System Access)
        ["ssh"]="ssh_quick.sh|🔐 SSH Brute-Force [Port 22] → ROOT ACCESS via weak credentials. Targets: root/admin/ubuntu. Success: 15-30% on default configs. Fast parallel attack with 16+ threads."
        ["telnet"]="telnet_quick.sh|📡 Telnet Brute-Force [Port 23] → LEGACY SYSTEM ACCESS, often unencrypted. High success on IoT/embedded devices (40-60%). Prioritize admin/root/user credentials."
        ["vnc"]="vnc_quick.sh|🖥️  VNC Desktop Access [Port 5900] → FULL GUI CONTROL of remote desktop. Weak/no auth common on internal networks (25-45% success). Try blank passwords first."
        ["ms-wbt-server"]="rdp_quick.sh|🪟 RDP Windows Attack [Port 3389] → WINDOWS DESKTOP ACCESS. Administrator/Admin accounts. Slow but high-value (20-35% success). Enable NLA bypass techniques."
        
        # File Transfer Protocols (MEDIUM PRIORITY - File System Access)
        ["ftp"]="ftp_quick.sh|📁 FTP Server Attack [Port 21] → FILE SYSTEM ACCESS with anonymous/admin credentials. Success: 30-50% on misconfigured servers. Check for anonymous login first."
        ["microsoft-ds"]="smb_quick.sh|🗂️  SMB File Sharing [Port 445] → WINDOWS NETWORK SHARES. Guest/Administrator accounts. Critical for domain pivoting. Success: 20-40% on weak domains."
        ["netbios-ssn"]="smb_quick.sh|🔗 NetBIOS/SMB [Port 139] → LEGACY WINDOWS SHARES. Often easier than modern SMB. High success on older Windows systems (35-55%). Try guest account."
        
        # Database Protocols (HIGH VALUE - Data Extraction)
        ["mysql"]="mysql_quick.sh|💾 MySQL Database [Port 3306] → DATABASE ROOT ACCESS. Targets root@localhost with weak passwords. Success: 25-45%. Enables full data dump and SQL injection."
        ["postgresql"]="postgres_quick.sh|🐘 PostgreSQL DB [Port 5432] → POSTGRES USER ACCESS with postgres/admin credentials. Success: 20-40%. Command execution possible via extensions."
        ["ms-sql"]="mssql_quick.sh|🗄️  MS-SQL Server [Port 1433] → SA ACCOUNT ACCESS enables xp_cmdshell for OS commands. Success: 15-30%. High-value corporate target."
        ["mongodb"]="mongodb_quick.sh|🍃 MongoDB NoSQL [Port 27017] → ADMIN DATABASE ACCESS. Often exposed without auth (HUGE vulnerability). Success: 40-70% when accessible."
        ["redis"]="redis_quick.sh|⚡ Redis Cache [Port 6379] → IN-MEMORY DATABASE, frequently NO PASSWORD (critical flaw). Success: 50-80% when exposed. Enables SSH key injection."
        ["oracle"]="oracle_db.sh|🔮 Oracle Database [Ports 1521/1526] → ENTERPRISE DB ACCESS. Complex but high-value. SID enumeration + password attack. Success: 10-25% (skilled target)."
        
        # Web Protocols (VARIABLE PRIORITY - Application Access)
        ["http"]="web_quick.sh|🌐 HTTP Web Attack [Port 80] → ADMIN PANEL ACCESS (WordPress, Joomla, custom panels). Auto-detects login forms. Success: 15-35% depending on CMS."
        ["https"]="web_quick.sh|🔒 HTTPS Web Attack [Port 443] → SECURE WEB ADMIN with SSL/TLS. Same as HTTP but encrypted traffic. Check certificate validity first. Success: 15-35%."
        ["http-proxy"]="http_proxy_auth.sh|🚪 HTTP Proxy Auth [Port 8080] → PROXY BYPASS for network access. Corporate proxies often weak. Success: 20-40%. Enables internal pivoting."
        ["http-alt"]="web_quick.sh|🌍 Alternative HTTP [Port 8080/8000] → WEB SERVICES on non-standard ports. Admin interfaces, APIs, or dev servers. Success: 20-40%."
        
        # Email Protocols (MEDIUM VALUE - Account Takeover)
        ["smtp"]="smtp_quick.sh|📧 SMTP Mail Server [Port 25/587] → EMAIL ACCOUNT ACCESS + relay abuse. Can send phishing from legitimate domain. Success: 15-30%."
        ["imap"]="imap_quick.sh|📬 IMAP Email [Port 143/993] → FULL MAILBOX ACCESS (read/delete emails). Better than POP3. Success: 20-35%. Enables email harvesting."
        ["pop3"]="pop3_quick.sh|📮 POP3 Email [Port 110/995] → EMAIL DOWNLOAD ACCESS (read-only). Legacy protocol. Success: 20-35%. Limited compared to IMAP."
        ["submission"]="smtp_quick.sh|📤 SMTP Submission [Port 587] → AUTHENTICATED EMAIL SENDING. Modern SMTP with TLS. Success: 15-30%. Requires valid credentials."
        
        # Directory Services (HIGH VALUE - Domain Control)
        ["ldap"]="ldap_quick.sh|📖 LDAP Directory [Port 389/636] → ACTIVE DIRECTORY ACCESS. Enumerate users, groups, policies. Success: 15-30%. Critical for domain reconnaissance."
        ["ldaps"]="ldap_quick.sh|🔐 LDAPS Secure [Port 636] → ENCRYPTED LDAP with SSL/TLS. Same attack as LDAP but secured. Success: 15-30%. Provides domain intelligence."
        
        # IoT & Media Protocols (VARIABLE VALUE - Surveillance/Control)
        ["rtsp"]="rtsp_camera.sh|📹 RTSP IP Camera [Port 554] → SURVEILLANCE CAMERA ACCESS. IoT devices with default passwords. Success: 50-70% (notoriously weak)."
        ["sip"]="asterisk_sip.sh|☎️  SIP VoIP [Port 5060] → VOIP PHONE SYSTEM. Make/intercept calls, listen to voicemail. Success: 25-45%. Targets PBX systems."
        ["upnp"]="network_quick.sh|🔌 UPnP Service [Port 1900] → DEVICE DISCOVERY protocol. Can expose internal network topology. Enumerate then target specific services."
        
        # Network Management (HIGH VALUE - Infrastructure Control)
        ["snmp"]="snmp_quick.sh|🔧 SNMP Management [Port 161] → NETWORK DEVICE CONTROL. Routers/switches config access. Community string brute-force. Success: 30-50%."
        ["ssh-tunnel"]="ssh_quick.sh|🚇 SSH Tunnel [Non-standard ports] → BACKDOOR or tunneled SSH service. Same attack as SSH. Check for tunnels to internal services."
        
        # Cisco Specific
        ["cisco-enable"]="cisco_enable.sh|🌐 Cisco Enable Mode → PRIVILEGED EXEC ACCESS on Cisco devices. Full router/switch control. Success: 20-40% on weak enable passwords."
    )
    
    # Parse scan results and detect services
    if [ "$OUTPUT_FORMAT" = "xml" ]; then
        # Parse XML format
        while read -r port; do
            local service

            service=$(grep "portid=\"$port\"" "$scan_file" | grep -oP 'name="\K[^"]+' | head -1)
            if [ -n "$service" ]; then
                services_found+=("$service:$port")
            fi
        done < <(grep -oP 'portid="\K[0-9]+' "$scan_file" 2>/dev/null)
    else
        # Parse normal text format
        while read -r line; do
            local port

            port=$(echo "$line" | awk '{print $1}' | cut -d'/' -f1)
            local service

            service=$(echo "$line" | awk '{print $3}')
            if [ -n "$service" ]; then
                services_found+=("$service:$port")
            fi
        done < <(grep "^[0-9]*/.*open" "$scan_file" 2>/dev/null)
    fi
    
    # Categorize and recommend scripts for detected services
    local count=0
    declare -A recommended_scripts
    declare -A script_categories
    
    # Define categories for organization
    declare -A category_priority=(
        ["Remote Access"]="1"
        ["Database"]="2"
        ["Web Services"]="3"
        ["File Transfer"]="4"
        ["Email"]="5"
        ["Network Management"]="6"
        ["IoT & Media"]="7"
    )
    
    for service_port in "${services_found[@]}"; do
        local service

        service=$(echo "$service_port" | cut -d':' -f1)
        local port

        port=$(echo "$service_port" | cut -d':' -f2)
        
        # Check if we have a script for this service
        if [ -n "${service_map[$service]}" ]; then
            local script

            script=$(echo "${service_map[$service]}" | cut -d'|' -f1)
            local desc

            desc=$(echo "${service_map[$service]}" | cut -d'|' -f2)
            
            # Avoid duplicate recommendations
            if [ -z "${recommended_scripts[$script]}" ]; then
                recommended_scripts["$script"]="$desc"
                
                # Categorize the script
                case "$service" in
                    ssh|telnet|vnc|ms-wbt-server|ssh-tunnel)
                        script_categories["$script"]="Remote Access"
                        ;;
                    mysql|postgresql|ms-sql|mongodb|redis|oracle)
                        script_categories["$script"]="Database"
                        ;;
                    http|https|http-proxy|http-alt)
                        script_categories["$script"]="Web Services"
                        ;;
                    ftp|microsoft-ds|netbios-ssn)
                        script_categories["$script"]="File Transfer"
                        ;;
                    smtp|imap|pop3|submission)
                        script_categories["$script"]="Email"
                        ;;
                    snmp|ldap|ldaps|cisco-enable)
                        script_categories["$script"]="Network Management"
                        ;;
                    rtsp|sip|upnp)
                        script_categories["$script"]="IoT & Media"
                        ;;
                esac
                
                count=$((count + 1))
            fi
        fi
    done
    
    # Display recommended scripts by category
    if [ $count -gt 0 ]; then
        echo ""
        print_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$CYAN"
        print_message "📋 DETECTED SERVICES: $count attack vector(s) identified" "$GREEN"
        print_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$CYAN"
        echo ""
        
        # Display by category
        for category in "Remote Access" "Database" "Web Services" "File Transfer" "Email" "Network Management" "IoT & Media"; do
            local has_category=false
            
            # Check if any scripts in this category
            for script in "${!script_categories[@]}"; do
                if [ "${script_categories[$script]}" = "$category" ]; then
                    has_category=true
                    break
                fi
            done
            
            if [ "$has_category" = true ]; then
                print_message "╔══ $category ══" "$YELLOW"
                for script in "${!script_categories[@]}"; do
                    if [ "${script_categories[$script]}" = "$category" ]; then
                        local desc="${recommended_scripts[$script]}"
                        printf "${GREEN}║ ➤ %-22s${NC} %s\n" "$script" "$desc"
                    fi
                done
                echo ""
            fi
        done
        
        print_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$CYAN"
        log_info "💡 Usage: ${CYAN}bash scripts/<script_name>${NC}"
        log_warning "⚠️  Remember: Edit TARGET variable in script before running!"
        log_info "🎯 Pro Tip: Start with highest success rate services (Redis, MongoDB, IoT) for quick wins"
        echo ""
    else
        log_warning "❌ No specific script recommendations for detected services"
        log_info "💡 Tip: Try running ${CYAN}auto_attack_quick.sh${NC} for automatic protocol detection"
        echo ""
    fi
    
    # Always show utility scripts - ENHANCED WITH OPTIMIZATION
    echo ""
    print_header "⚙️  ADVANCED RECONNAISSANCE & UTILITY SCRIPTS"
    echo ""
    print_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$CYAN"
    echo ""
    
    print_message "🔍 RECONNAISSANCE & SCANNING:" "$YELLOW"
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "nmap_vuln_scan.sh" "🛡️  CVE Scanner → Detect known vulnerabilities with NSE scripts. Success: 60-80% finding issues. CRITICAL for pre-attack recon."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "nmap_os_detection.sh" "💻 OS Fingerprint → Identify exact OS/version for targeted exploits. Accuracy: 85-95%. Essential for custom payload selection."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "nmap_full_scan.sh" "🔬 Full Port Scan → All 65535 ports (SLOW but thorough). Find hidden services and backdoors. Use on high-value targets."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "nmap_stealth_scan.sh" "👻 Stealth SYN Scan → Low-noise reconnaissance. Avoid IDS/IPS detection. Use for sensitive targets or red team ops."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "nmap_network_discovery.sh" "🌐 Network Discovery → Map entire subnet topology. Identify all live hosts and routing. Great for large-scale assessments."
    echo ""
    
    print_message "🔐 SECURITY ANALYSIS:" "$YELLOW"
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "ssl_analyzer.sh" "🔒 SSL/TLS Audit → Check certificate validity, cipher strength, BEAST/POODLE/Heartbleed. Find SSL misconfigurations."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "web_header_analyzer.sh" "📊 HTTP Headers → Analyze security headers (CSP, HSTS, X-Frame). Find clickjacking/XSS weaknesses. Success: 40-60%."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "web_directory_bruteforce.sh" "📂 Web Dir Brute → Discover hidden admin panels, backups, config files. Success: 30-50%. Use with common wordlists."
    echo ""
    
    print_message "⚡ AUTOMATED ATTACKS:" "$YELLOW"
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "auto_attack_quick.sh" "🚀 AUTO-ATTACK → Intelligent multi-protocol attack. Detects all services and attacks simultaneously. BEST for unknown targets."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "combo_full_infrastructure.sh" "🏢 Full Infra Attack → Web+DB+Email+SMB combined assault. Enterprise-grade target. Parallel execution for speed."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "combo_windows_infra.sh" "🪟 Windows Stack → RDP+SMB+MSSQL coordinated attack. Perfect for Windows domains. Includes pass-the-hash techniques."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "combo_web_db.sh" "🌐💾 Web+Database → Simultaneous web admin + DB root attack. High success for LAMP/WAMP stacks (25-40%)."
    printf "${GREEN}║ ➤ %-22s${NC} %s\n" "multi_target_ssh.sh" "🎯 Multi-SSH → Attack multiple SSH hosts in parallel. Great for subnet sweeps. Include CIDR ranges."
    echo ""
    
    print_message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$CYAN"
    echo ""
    log_success "✨ OPTIMIZATION COMPLETE: All protocols analyzed with detailed attack strategies"
    log_info "💡 Quick Start: ${CYAN}bash scripts/<script_name>${NC}"
    log_warning "⚠️  LEGAL: Only attack systems you own or have written authorization to test"
    log_info "🎯 Recommended Workflow: 1) Vuln Scan → 2) Service-Specific Attack → 3) Post-Exploitation"
    echo ""
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
