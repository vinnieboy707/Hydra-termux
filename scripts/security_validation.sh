#!/bin/bash

# Hydra-Termux Security & Input Validation Module
# Provides comprehensive security checks and input sanitization
# Prevents command injection, validates all inputs, ensures safe operations

# Use private variable naming
_SECURITY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
_SECURITY_PROJECT_ROOT="$(dirname "$_SECURITY_SCRIPT_DIR")"

# Security configuration
SECURITY_STRICT_MODE="${SECURITY_STRICT_MODE:-1}"  # 1 = strict, 0 = permissive
SECURITY_ALLOW_PRIVATE_IPS="${SECURITY_ALLOW_PRIVATE_IPS:-1}"  # 1 = allow, 0 = block

# ============================================================================
# IP Address Validation (Enhanced)
# ============================================================================

# Validate IPv4 address format and range
security_validate_ipv4() {
    local ip="$1"
    local allow_private="${2:-$SECURITY_ALLOW_PRIVATE_IPS}"
    
    # Check format
    if ! [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        echo "ERROR: Invalid IPv4 format: $ip" >&2
        return 1
    fi
    
    # Check octets
    local IFS='.'
    local -a octets=($ip)
    for octet in "${octets[@]}"; do
        if [ "$octet" -gt 255 ]; then
            echo "ERROR: Invalid IPv4 octet (>255): $ip" >&2
            return 1
        fi
    done
    
    # Check for reserved/special addresses
    if [ "$ip" = "0.0.0.0" ] || [ "$ip" = "255.255.255.255" ]; then
        echo "ERROR: Reserved IP address: $ip" >&2
        return 1
    fi
    
    # Check for localhost
    if [[ "$ip" =~ ^127\. ]]; then
        echo "ERROR: Localhost not allowed: $ip" >&2
        return 1
    fi
    
    # Check for private IPs if not allowed
    if [ "$allow_private" -eq 0 ]; then
        if [[ "$ip" =~ ^10\. ]] || \
           [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] || \
           [[ "$ip" =~ ^192\.168\. ]]; then
            echo "ERROR: Private IP addresses not allowed: $ip" >&2
            return 1
        fi
    fi
    
    return 0
}

# Validate CIDR notation
security_validate_cidr() {
    local cidr="$1"
    
    if ! [[ "$cidr" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR format: $cidr" >&2
        return 1
    fi
    
    local ip="${cidr%/*}"
    local mask="${cidr#*/}"
    
    # Validate IP part
    security_validate_ipv4 "$ip" || return 1
    
    # Validate mask
    if [ "$mask" -lt 0 ] || [ "$mask" -gt 32 ]; then
        echo "ERROR: Invalid CIDR mask (0-32): /$mask" >&2
        return 1
    fi
    
    return 0
}

# Validate IP range (192.168.1.1-192.168.1.254)
security_validate_ip_range() {
    local range="$1"
    
    if ! [[ "$range" =~ ^([0-9.]+)-([0-9.]+)$ ]]; then
        echo "ERROR: Invalid IP range format: $range" >&2
        return 1
    fi
    
    local start_ip="${BASH_REMATCH[1]}"
    local end_ip="${BASH_REMATCH[2]}"
    
    security_validate_ipv4 "$start_ip" || return 1
    security_validate_ipv4 "$end_ip" || return 1
    
    return 0
}

# ============================================================================
# Hostname Validation (Enhanced)
# ============================================================================

# Validate hostname/domain format
security_validate_hostname() {
    local hostname="$1"
    
    # Check length
    if [ ${#hostname} -gt 253 ]; then
        echo "ERROR: Hostname too long (max 253): $hostname" >&2
        return 1
    fi
    
    # Check format (RFC 1123)
    if ! [[ "$hostname" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]]; then
        echo "ERROR: Invalid hostname format: $hostname" >&2
        return 1
    fi
    
    # Check for special characters that could be injection
    if [[ "$hostname" =~ [\;\|\&\$\`\<\>\(\)\{\}] ]]; then
        echo "ERROR: Hostname contains dangerous characters: $hostname" >&2
        return 1
    fi
    
    return 0
}

# ============================================================================
# Port Validation (Enhanced)
# ============================================================================

# Validate single port number
security_validate_port() {
    local port="$1"
    local allow_privileged="${2:-1}"  # 1 = allow <1024, 0 = block
    
    # Check if numeric
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        echo "ERROR: Port must be numeric: $port" >&2
        return 1
    fi
    
    # Check range
    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        echo "ERROR: Port out of range (1-65535): $port" >&2
        return 1
    fi
    
    # Check privileged ports
    if [ "$allow_privileged" -eq 0 ] && [ "$port" -lt 1024 ]; then
        echo "ERROR: Privileged ports (<1024) not allowed: $port" >&2
        return 1
    fi
    
    return 0
}

# Validate port list (22,80,443)
security_validate_port_list() {
    local ports="$1"
    
    IFS=',' read -ra PORT_ARRAY <<< "$ports"
    
    for port in "${PORT_ARRAY[@]}"; do
        # Trim whitespace
        port=$(echo "$port" | xargs)
        
        if ! security_validate_port "$port"; then
            return 1
        fi
    done
    
    return 0
}

# ============================================================================
# File Path Validation
# ============================================================================

# Validate file path (prevent directory traversal)
security_validate_file_path() {
    local filepath="$1"
    local must_exist="${2:-0}"  # 1 = must exist, 0 = can be new
    
    # Check for dangerous patterns
    if [[ "$filepath" =~ \.\./  ]] || [[ "$filepath" =~ ^/ && ! "$filepath" =~ ^/home/ && ! "$filepath" =~ ^/tmp/ ]]; then
        echo "ERROR: Suspicious file path: $filepath" >&2
        return 1
    fi
    
    # Check for command injection attempts
    if [[ "$filepath" =~ [\;\|\&\$\`\<\>\{\}] ]]; then
        echo "ERROR: File path contains dangerous characters: $filepath" >&2
        return 1
    fi
    
    # Check existence if required
    if [ "$must_exist" -eq 1 ] && [ ! -f "$filepath" ]; then
        echo "ERROR: File does not exist: $filepath" >&2
        return 1
    fi
    
    # Check readability if exists
    if [ -f "$filepath" ] && [ ! -r "$filepath" ]; then
        echo "ERROR: File not readable: $filepath" >&2
        return 1
    fi
    
    return 0
}

# ============================================================================
# Username/Password Validation
# ============================================================================

# Validate username format
security_validate_username() {
    local username="$1"
    
    # Check length
    if [ ${#username} -lt 1 ] || [ ${#username} -gt 32 ]; then
        echo "ERROR: Username length must be 1-32 characters" >&2
        return 1
    fi
    
    # Check format (alphanumeric, underscore, dash, dot)
    if ! [[ "$username" =~ ^[a-zA-Z0-9._-]+$ ]]; then
        echo "ERROR: Username contains invalid characters: $username" >&2
        return 1
    fi
    
    # Check for injection attempts
    if [[ "$username" =~ [\;\|\&\$\`\<\>\(\)\{\}] ]]; then
        echo "ERROR: Username contains dangerous characters: $username" >&2
        return 1
    fi
    
    return 0
}

# ============================================================================
# Numeric Value Validation
# ============================================================================

# Validate integer within range
security_validate_integer() {
    local value="$1"
    local min="${2:-0}"
    local max="${3:-9999999}"
    local name="${4:-value}"
    
    # Check if numeric
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "ERROR: $name must be an integer: $value" >&2
        return 1
    fi
    
    # Check range
    if [ "$value" -lt "$min" ] || [ "$value" -gt "$max" ]; then
        echo "ERROR: $name out of range ($min-$max): $value" >&2
        return 1
    fi
    
    return 0
}

# ============================================================================
# Target Validation (Comprehensive)
# ============================================================================

# Validate target (IP, hostname, CIDR, or range)
security_validate_target() {
    local target="$1"
    
    # Try IP
    if security_validate_ipv4 "$target" 2>/dev/null; then
        return 0
    fi
    
    # Try CIDR
    if security_validate_cidr "$target" 2>/dev/null; then
        return 0
    fi
    
    # Try IP range
    if security_validate_ip_range "$target" 2>/dev/null; then
        return 0
    fi
    
    # Try hostname
    if security_validate_hostname "$target" 2>/dev/null; then
        return 0
    fi
    
    echo "ERROR: Invalid target format: $target" >&2
    echo "  Supported formats:" >&2
    echo "    - IPv4: 192.168.1.1" >&2
    echo "    - CIDR: 192.168.1.0/24" >&2
    echo "    - Range: 192.168.1.1-192.168.1.254" >&2
    echo "    - Hostname: example.com" >&2
    return 1
}

# ============================================================================
# Command Argument Sanitization
# ============================================================================

# Sanitize string for use in shell commands
security_sanitize_argument() {
    local arg="$1"
    
    # Remove any characters that could be used for injection
    # Keep only: alphanumeric, underscore, dash, dot, slash, colon
    arg=$(echo "$arg" | tr -cd '[:alnum:]_.-/: ')
    
    echo "$arg"
}

# Quote argument safely for shell
security_quote_argument() {
    local arg="$1"
    
    # Use printf %q for safe quoting
    printf '%q' "$arg"
}

# ============================================================================
# Wordlist Validation
# ============================================================================

# Validate wordlist file
security_validate_wordlist() {
    local wordlist="$1"
    
    # Check file exists
    if [ ! -f "$wordlist" ]; then
        echo "ERROR: Wordlist file not found: $wordlist" >&2
        return 1
    fi
    
    # Check file is readable
    if [ ! -r "$wordlist" ]; then
        echo "ERROR: Wordlist file not readable: $wordlist" >&2
        return 1
    fi
    
    # Check file is not empty
    if [ ! -s "$wordlist" ]; then
        echo "ERROR: Wordlist file is empty: $wordlist" >&2
        return 1
    fi
    
    # Check file size (warn if >100MB)
    local size
    size=$(stat -f%z "$wordlist" 2>/dev/null || stat -c%s "$wordlist" 2>/dev/null)
    if [ "$size" -gt 104857600 ]; then
        echo "WARNING: Large wordlist file (>100MB): $wordlist" >&2
        echo "  This may take a very long time to process." >&2
    fi
    
    return 0
}

# ============================================================================
# Configuration Validation
# ============================================================================

# Validate configuration file before sourcing
security_validate_config() {
    local config_file="$1"
    
    # Check file exists
    if [ ! -f "$config_file" ]; then
        echo "ERROR: Config file not found: $config_file" >&2
        return 1
    fi
    
    # Check file is readable
    if [ ! -r "$config_file" ]; then
        echo "ERROR: Config file not readable: $config_file" >&2
        return 1
    fi
    
    # Validate syntax without executing
    if ! bash -n "$config_file" 2>/dev/null; then
        echo "ERROR: Config file has syntax errors: $config_file" >&2
        return 1
    fi
    
    # Check for dangerous patterns
    if grep -qE '(rm -rf|curl.*\||wget.*\||eval|exec|>|<|\$\(|`)' "$config_file"; then
        echo "ERROR: Config file contains potentially dangerous commands: $config_file" >&2
        return 1
    fi
    
    return 0
}

# ============================================================================
# Security Audit Functions
# ============================================================================

# Check if running with appropriate privileges
security_check_privileges() {
    if [ "$EUID" -eq 0 ]; then
        echo "WARNING: Running as root is not recommended" >&2
        return 1
    fi
    return 0
}

# Check if VPN is active (if vpn_check.sh available)
security_check_vpn() {
    if [ -f "$_SECURITY_SCRIPT_DIR/vpn_check.sh" ]; then
        source "$_SECURITY_SCRIPT_DIR/vpn_check.sh" 2>/dev/null
        if command -v check_vpn_connection >/dev/null 2>&1; then
            check_vpn_connection false
            return $?
        fi
    fi
    return 0
}

# Validate all attack parameters
security_validate_attack_params() {
    local target="$1"
    local port="$2"
    local threads="$3"
    local timeout="$4"
    local wordlist="$5"
    
    local errors=0
    
    # Validate target
    if ! security_validate_target "$target"; then
        errors=$((errors + 1))
    fi
    
    # Validate port
    if ! security_validate_port "$port"; then
        errors=$((errors + 1))
    fi
    
    # Validate threads
    if ! security_validate_integer "$threads" 1 128 "threads"; then
        errors=$((errors + 1))
    fi
    
    # Validate timeout
    if ! security_validate_integer "$timeout" 1 300 "timeout"; then
        errors=$((errors + 1))
    fi
    
    # Validate wordlist
    if ! security_validate_wordlist "$wordlist"; then
        errors=$((errors + 1))
    fi
    
    return $errors
}

# ============================================================================
# Export Functions
# ============================================================================

export -f security_validate_ipv4
export -f security_validate_cidr
export -f security_validate_ip_range
export -f security_validate_hostname
export -f security_validate_port
export -f security_validate_port_list
export -f security_validate_file_path
export -f security_validate_username
export -f security_validate_integer
export -f security_validate_target
export -f security_sanitize_argument
export -f security_quote_argument
export -f security_validate_wordlist
export -f security_validate_config
export -f security_check_privileges
export -f security_check_vpn
export -f security_validate_attack_params

# Mark as loaded
_SECURITY_MODULE_LOADED=1
export _SECURITY_MODULE_LOADED

# Silent mode - don't print loading message in scripts
if [ "${SECURITY_SILENT_LOAD:-0}" != "1" ]; then
    echo "[SECURITY] Input validation module loaded" >&2
fi
