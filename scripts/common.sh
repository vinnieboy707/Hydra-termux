#!/bin/bash

# Hydra-Termux Common Utility Library
# Provides standardized functions for safe script operations
# This file should be sourced by all scripts that need robust error handling

# Use private variable naming to avoid collision with parent scripts
_COMMON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || {
    echo "ERROR: Could not determine common.sh script directory" >&2
    return 1 2>/dev/null || exit 1
}
_COMMON_PROJECT_ROOT="$(dirname "$_COMMON_SCRIPT_DIR")"

# Safe sourcing function with validation and error handling
# Usage: safe_source "/path/to/script.sh" ["optional description"]
safe_source() {
    local file="$1"
    local description="${2:-$file}"
    
    if [ -z "$file" ]; then
        echo "ERROR: safe_source called with empty file path" >&2
        return 1
    fi
    
    if [ ! -f "$file" ]; then
        echo "ERROR: Cannot source $description - file not found: $file" >&2
        return 1
    fi
    
    if [ ! -r "$file" ]; then
        echo "ERROR: Cannot source $description - file not readable: $file" >&2
        return 1
    fi
    
    # Source the file and capture any errors
    local error_output
    error_output=$(source "$file" 2>&1) || {
        echo "ERROR: Failed to source $description: $file" >&2
        [ -n "$error_output" ] && echo "Details: $error_output" >&2
        return 1
    }
    
    return 0
}

# Validate that a variable is set and not empty
# Usage: validate_var "VARIABLE_NAME" "value" ["description"]
validate_var() {
    local var_name="$1"
    local var_value="$2"
    local description="${3:-$var_name}"
    
    if [ -z "$var_value" ]; then
        echo "ERROR: Required variable $var_name ($description) is not set or empty" >&2
        return 1
    fi
    
    return 0
}

# Validate that a directory exists and is accessible
# Usage: validate_dir "/path/to/dir" ["description"]
validate_dir() {
    local dir="$1"
    local description="${2:-$dir}"
    
    if [ -z "$dir" ]; then
        echo "ERROR: validate_dir called with empty directory path" >&2
        return 1
    fi
    
    if [ ! -d "$dir" ]; then
        echo "ERROR: Directory not found: $description ($dir)" >&2
        return 1
    fi
    
    if [ ! -r "$dir" ] || [ ! -x "$dir" ]; then
        echo "ERROR: Directory not accessible: $description ($dir)" >&2
        return 1
    fi
    
    return 0
}

# Validate that a file exists and is accessible
# Usage: validate_file "/path/to/file" ["description"]
validate_file() {
    local file="$1"
    local description="${2:-$file}"
    
    if [ -z "$file" ]; then
        echo "ERROR: validate_file called with empty file path" >&2
        return 1
    fi
    
    if [ ! -f "$file" ]; then
        echo "ERROR: File not found: $description ($file)" >&2
        return 1
    fi
    
    if [ ! -r "$file" ]; then
        echo "ERROR: File not readable: $description ($file)" >&2
        return 1
    fi
    
    return 0
}

# Validate environment variables required for script execution
# Usage: validate_environment
validate_environment() {
    local errors=0
    
    # Check if SCRIPT_DIR is set (should be set by parent script)
    if [ -z "$SCRIPT_DIR" ]; then
        echo "WARNING: SCRIPT_DIR not set in calling script" >&2
        errors=$((errors + 1))
    elif [ ! -d "$SCRIPT_DIR" ]; then
        echo "ERROR: SCRIPT_DIR points to non-existent directory: $SCRIPT_DIR" >&2
        errors=$((errors + 1))
    fi
    
    # Check if PROJECT_ROOT is set
    if [ -z "$PROJECT_ROOT" ]; then
        echo "WARNING: PROJECT_ROOT not set in calling script" >&2
        errors=$((errors + 1))
    elif [ ! -d "$PROJECT_ROOT" ]; then
        echo "ERROR: PROJECT_ROOT points to non-existent directory: $PROJECT_ROOT" >&2
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Resolve script path with symlink support (comprehensive)
# Usage: resolve_script_path "$BASH_SOURCE[0]"
# Returns: Absolute path to the script (follows symlinks)
resolve_script_path() {
    local script_path="$1"
    local resolved_path=""
    
    if [ -z "$script_path" ]; then
        echo "ERROR: resolve_script_path called with empty path" >&2
        return 1
    fi
    
    # Try realpath first (most reliable)
    if command -v realpath >/dev/null 2>&1; then
        resolved_path="$(realpath "$script_path" 2>/dev/null)"
        if [ -n "$resolved_path" ]; then
            echo "$resolved_path"
            return 0
        fi
    fi
    
    # Try readlink -f (GNU coreutils)
    if command -v readlink >/dev/null 2>&1; then
        resolved_path="$(readlink -f "$script_path" 2>/dev/null)"
        if [ -n "$resolved_path" ]; then
            echo "$resolved_path"
            return 0
        fi
        
        # Try basic readlink (single level symlink resolution)
        resolved_path="$(readlink "$script_path" 2>/dev/null)"
        if [ -n "$resolved_path" ]; then
            # Handle relative paths
            if [ "${resolved_path#/}" = "$resolved_path" ]; then
                # Relative path: resolve it relative to the script's directory
                local link_dir="$(cd "$(dirname "$script_path")" 2>/dev/null && pwd)"
                resolved_path="$link_dir/$resolved_path"
            fi
            echo "$resolved_path"
            return 0
        fi
    fi
    
    # Fallback: use the original path
    echo "$script_path"
    return 0
}

# Get script directory with symlink resolution
# Usage: get_script_dir "$BASH_SOURCE[0]"
# Returns: Absolute directory path
get_script_dir() {
    local script_path="$1"
    local resolved_path
    
    resolved_path="$(resolve_script_path "$script_path")"
    
    if ! cd "$(dirname "$resolved_path")" 2>/dev/null; then
        echo "ERROR: Could not determine script directory from: $script_path" >&2
        return 1
    fi
    
    pwd
}

# Load configuration file safely
# Usage: load_config "/path/to/config.conf" ["description"]
load_config() {
    local config_file="$1"
    local description="${2:-$config_file}"
    
    if [ -z "$config_file" ]; then
        echo "WARNING: load_config called with empty file path" >&2
        return 0  # Not fatal, just skip
    fi
    
    if [ ! -f "$config_file" ]; then
        # Config file not found is not always an error
        return 0
    fi
    
    if [ ! -r "$config_file" ]; then
        echo "WARNING: Configuration file not readable: $description ($config_file)" >&2
        return 0
    fi
    
    # Source the configuration file
    local error_output
    error_output=$(source "$config_file" 2>&1) || {
        echo "WARNING: Failed to load configuration from $description: $config_file" >&2
        [ -n "$error_output" ] && echo "Details: $error_output" >&2
        return 1
    }
    
    return 0
}

# Create directory safely with error handling
# Usage: safe_mkdir "/path/to/dir" ["description"]
safe_mkdir() {
    local dir="$1"
    local description="${2:-$dir}"
    
    if [ -z "$dir" ]; then
        echo "ERROR: safe_mkdir called with empty directory path" >&2
        return 1
    fi
    
    if [ -d "$dir" ]; then
        # Directory already exists
        return 0
    fi
    
    if ! mkdir -p "$dir" 2>/dev/null; then
        echo "ERROR: Failed to create directory: $description ($dir)" >&2
        return 1
    fi
    
    return 0
}

# Check if command exists
# Usage: command_exists "hydra"
command_exists() {
    local cmd="$1"
    command -v "$cmd" >/dev/null 2>&1
}

# Check multiple commands and report missing ones
# Usage: check_commands "hydra" "nmap" "git"
check_commands() {
    local missing=()
    local cmd
    
    for cmd in "$@"; do
        if ! command_exists "$cmd"; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo "ERROR: Missing required commands: ${missing[*]}" >&2
        return 1
    fi
    
    return 0
}

# Print error and exit (for use in scripts, not when sourced)
# Usage: die "Error message"
die() {
    echo "FATAL: $*" >&2
    exit 1
}

# Temporary file management
# Usage: temp_file=$(make_temp_file "prefix")
make_temp_file() {
    local prefix="${1:-hydra_temp}"
    local temp_dir="${TMPDIR:-/tmp}"
    
    mktemp "$temp_dir/${prefix}.XXXXXX" 2>/dev/null || {
        echo "ERROR: Failed to create temporary file" >&2
        return 1
    }
}

# Cleanup function for temporary files
# Usage: cleanup_temp_files file1 file2 file3
cleanup_temp_files() {
    local file
    for file in "$@"; do
        if [ -f "$file" ]; then
            rm -f "$file" 2>/dev/null
        fi
    done
}

# Enhanced debug logging (only if DEBUG=1 or VERBOSE=1)
# Usage: debug_log "Debug message"
debug_log() {
    if [ "${DEBUG:-0}" = "1" ] || [ "${VERBOSE:-0}" = "1" ]; then
        echo "[DEBUG] $*" >&2
    fi
}

# Standard function to check if script is being run or sourced
# Usage: if is_sourced; then ...; fi
is_sourced() {
    [ "${BASH_SOURCE[0]}" != "${0}" ]
}

# Validate IP address format
# Usage: validate_ip "192.168.1.1"
validate_ip() {
    local ip="$1"
    local regex='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
    
    if [[ ! "$ip" =~ $regex ]]; then
        return 1
    fi
    
    # Check each octet
    local IFS='.'
    local -a octets=($ip)
    local octet
    
    for octet in "${octets[@]}"; do
        if [ "$octet" -gt 255 ]; then
            return 1
        fi
    done
    
    return 0
}

# Validate hostname format
# Usage: validate_hostname "example.com"
validate_hostname() {
    local hostname="$1"
    local regex='^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
    
    [[ "$hostname" =~ $regex ]]
}

# Validate port number
# Usage: validate_port "22"
validate_port() {
    local port="$1"
    
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        return 1
    fi
    
    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        return 1
    fi
    
    return 0
}

# Print usage information helper
# Usage: print_usage "script_name" "description" "usage_example"
print_usage() {
    local script_name="$1"
    local description="$2"
    local usage="$3"
    
    cat << EOF
${script_name} - ${description}

Usage: ${usage}

Common Options:
  -h, --help          Show this help message
  -v, --verbose       Enable verbose output
  -d, --debug         Enable debug output

EOF
}

# Export functions so they're available to sourcing scripts
export -f safe_source
export -f validate_var
export -f validate_dir
export -f validate_file
export -f validate_environment
export -f resolve_script_path
export -f get_script_dir
export -f load_config
export -f safe_mkdir
export -f command_exists
export -f check_commands
export -f die
export -f make_temp_file
export -f cleanup_temp_files
export -f debug_log
export -f is_sourced
export -f validate_ip
export -f validate_hostname
export -f validate_port
export -f print_usage

# Mark that common.sh has been loaded
_COMMON_SH_LOADED=1
export _COMMON_SH_LOADED

debug_log "common.sh loaded successfully"
