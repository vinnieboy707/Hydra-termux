#!/usr/bin/env bash
# JSON Structured Logging System

set -euo pipefail

# Log levels
readonly LOG_LEVEL_DEBUG=0
readonly LOG_LEVEL_INFO=1
readonly LOG_LEVEL_WARN=2
readonly LOG_LEVEL_ERROR=3
readonly LOG_LEVEL_FATAL=4

# Current log level (default: INFO)
LOG_LEVEL=${LOG_LEVEL:-$LOG_LEVEL_INFO}

# Log file location
LOG_FILE="${LOG_FILE:-/tmp/hydra-termux.log}"

# Get timestamp in ISO 8601 format
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"
}

# Get log level name
get_level_name() {
    case $1 in
        $LOG_LEVEL_DEBUG) echo "DEBUG" ;;
        $LOG_LEVEL_INFO) echo "INFO" ;;
        $LOG_LEVEL_WARN) echo "WARN" ;;
        $LOG_LEVEL_ERROR) echo "ERROR" ;;
        $LOG_LEVEL_FATAL) echo "FATAL" ;;
        *) echo "UNKNOWN" ;;
    esac
}

# Write JSON log entry
write_log() {
    local level=$1
    local message="$2"
    local context="${3:-{}}"
    
    # Skip if below current log level
    if [[ $level -lt $LOG_LEVEL ]]; then
        return 0
    fi
    
    local timestamp
    timestamp=$(get_timestamp)
    local level_name
    level_name=$(get_level_name "$level")
    
    # Escape message for JSON
    local escaped_message
    escaped_message=$(echo "$message" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
    
    # Build JSON log entry
    local json_log="{\"timestamp\":\"$timestamp\",\"level\":\"$level_name\",\"message\":\"$escaped_message\",\"context\":$context}"
    
    # Write to log file
    echo "$json_log" >> "$LOG_FILE"
    
    # Also write to stderr for ERROR and FATAL
    if [[ $level -ge $LOG_LEVEL_ERROR ]]; then
        echo "$json_log" >&2
    fi
}

# Convenience logging functions
log_debug() {
    write_log $LOG_LEVEL_DEBUG "$1" "${2:-{}}"
}

log_info() {
    write_log $LOG_LEVEL_INFO "$1" "${2:-{}}"
}

log_warn() {
    write_log $LOG_LEVEL_WARN "$1" "${2:-{}}"
}

log_error() {
    write_log $LOG_LEVEL_ERROR "$1" "${2:-{}}"
}

log_fatal() {
    write_log $LOG_LEVEL_FATAL "$1" "${2:-{}}"
}

# Export functions
export -f get_timestamp get_level_name write_log
export -f log_debug log_info log_warn log_error log_fatal
