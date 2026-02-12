#!/usr/bin/env bash
# Exponential Backoff Retry Logic

set -euo pipefail

# Default retry configuration
readonly DEFAULT_MAX_RETRIES=5
readonly DEFAULT_INITIAL_DELAY=1
readonly DEFAULT_MAX_DELAY=60
readonly DEFAULT_BACKOFF_MULTIPLIER=2

# Retry a command with exponential backoff
retry_with_backoff() {
    local max_retries="${1:-$DEFAULT_MAX_RETRIES}"
    local initial_delay="${2:-$DEFAULT_INITIAL_DELAY}"
    local max_delay="${3:-$DEFAULT_MAX_DELAY}"
    shift 3
    local command=("$@")
    
    local attempt=1
    local delay=$initial_delay
    
    while [[ $attempt -le $max_retries ]]; do
        echo "Attempt $attempt/$max_retries: ${command[*]}"
        
        if "${command[@]}"; then
            echo "Success on attempt $attempt"
            return 0
        fi
        
        if [[ $attempt -lt $max_retries ]]; then
            echo "Failed. Retrying in ${delay}s..."
            sleep "$delay"
            
            # Calculate next delay with exponential backoff
            delay=$((delay * DEFAULT_BACKOFF_MULTIPLIER))
            
            # Cap at max_delay
            if [[ $delay -gt $max_delay ]]; then
                delay=$max_delay
            fi
            
            # Add jitter (random 0-20% of delay)
            local jitter=$((RANDOM % (delay / 5)))
            delay=$((delay + jitter))
        fi
        
        ((attempt++))
    done
    
    echo "Failed after $max_retries attempts"
    return 1
}

# Export function
export -f retry_with_backoff
