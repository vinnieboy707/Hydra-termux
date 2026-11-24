#!/usr/bin/env bash
# Health Check HTTP Server

set -euo pipefail

readonly PORT="${HEALTH_CHECK_PORT:-8080}"
readonly HOST="${HEALTH_CHECK_HOST:-0.0.0.0}"

# Health check function
perform_health_check() {
    local status="healthy"
    local checks=()
    
    # Check database connectivity
    if command -v psql &> /dev/null; then
        if psql -c '\l' &> /dev/null; then
            checks+=("database:ok")
        else
            checks+=("database:fail")
            status="unhealthy"
        fi
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -lt 90 ]]; then
        checks+=("disk:ok")
    else
        checks+=("disk:fail")
        status="unhealthy"
    fi
    
    # Check memory
    local mem_usage
    mem_usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
    if [[ $mem_usage -lt 90 ]]; then
        checks+=("memory:ok")
    else
        checks+=("memory:fail")
        status="unhealthy"
    fi
    
    # Build response
    local response
    local checks_str
    IFS=,
    checks_str="${checks[*]}"
    checks_str="${checks_str//,/\",\"}"
    response="{\"status\":\"$status\",\"checks\":{\"$checks_str\"}}"
    echo "$response"
}

# Start health check server
echo "Starting health check server on $HOST:$PORT"
while true; do
    {
        echo -ne "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n"
        perform_health_check
    } | nc -l -p "$PORT" -q 1
done
