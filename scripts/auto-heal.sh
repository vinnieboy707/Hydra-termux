#!/bin/bash

# Auto-Healing and Self-Recovery System
# Automatically detects and fixes common issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOG_FILE="/var/log/hydra-auto-heal.log"
ALERT_THRESHOLD=3
RESTART_COOLDOWN=300  # 5 minutes

log_event() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log_event "INFO: $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    log_event "WARN: $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log_event "ERROR: $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log_event "SUCCESS: $1"
}

# Check service health
check_service_health() {
    local service="$1"
    local health_url="$2"
    
    if curl -sf "$health_url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Restart unhealthy service
restart_service() {
    local service="$1"
    
    print_warning "Attempting to restart $service..."
    
    if docker-compose restart "$service" 2>&1; then
        print_success "$service restarted successfully"
        return 0
    else
        print_error "Failed to restart $service"
        return 1
    fi
}

# Check and fix database connection
check_database() {
    print_status "Checking database connectivity..."
    
    if docker exec hydra-postgres-prod pg_isready -U hydra > /dev/null 2>&1; then
        print_success "Database is healthy"
        return 0
    else
        print_warning "Database not responding"
        
        # Check if container is running
        if ! docker ps | grep -q hydra-postgres-prod; then
            print_warning "Database container is not running"
            restart_service "postgres"
        fi
        
        # Wait and retry
        sleep 10
        if docker exec hydra-postgres-prod pg_isready -U hydra > /dev/null 2>&1; then
            print_success "Database recovered"
            return 0
        else
            print_error "Database recovery failed"
            return 1
        fi
    fi
}

# Check and fix Redis connection
check_redis() {
    print_status "Checking Redis connectivity..."
    
    if docker exec hydra-redis-prod redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
        return 0
    else
        print_warning "Redis not responding"
        restart_service "redis"
        
        sleep 5
        if docker exec hydra-redis-prod redis-cli ping > /dev/null 2>&1; then
            print_success "Redis recovered"
            return 0
        else
            print_error "Redis recovery failed"
            return 1
        fi
    fi
}

# Check disk space
check_disk_space() {
    print_status "Checking disk space..."
    
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -gt 90 ]; then
        print_error "Disk usage critical: ${usage}%"
        
        # Clean up Docker
        print_status "Cleaning up Docker resources..."
        docker system prune -f --volumes > /dev/null 2>&1
        
        # Clean up old logs
        find /var/log -name "*.log" -mtime +30 -delete 2>/dev/null || true
        find ./logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
        
        print_success "Cleanup completed"
        return 0
    elif [ "$usage" -gt 80 ]; then
        print_warning "Disk usage high: ${usage}%"
        return 0
    else
        print_success "Disk space OK: ${usage}% used"
        return 0
    fi
}

# Check memory usage
check_memory() {
    print_status "Checking memory usage..."
    
    local mem_usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2*100}')
    
    if [ "$mem_usage" -gt 90 ]; then
        print_error "Memory usage critical: ${mem_usage}%"
        
        # Try to free memory
        sync
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
        
        print_status "Memory cache cleared"
        return 1
    elif [ "$mem_usage" -gt 80 ]; then
        print_warning "Memory usage high: ${mem_usage}%"
        return 0
    else
        print_success "Memory usage OK: ${mem_usage}%"
        return 0
    fi
}

# Check application health
check_application() {
    print_status "Checking application health..."
    
    if check_service_health "hydra-app" "http://localhost:3000/api/health"; then
        print_success "Application is healthy"
        return 0
    else
        print_warning "Application health check failed"
        
        # Check logs for errors
        docker logs --tail 50 hydra-termux-prod 2>&1 | grep -i error | tail -5 || true
        
        # Restart application
        restart_service "hydra-app"
        
        sleep 15
        if check_service_health "hydra-app" "http://localhost:3000/api/health"; then
            print_success "Application recovered"
            return 0
        else
            print_error "Application recovery failed"
            return 1
        fi
    fi
}

# Check for zombie processes
check_zombie_processes() {
    print_status "Checking for zombie processes..."
    
    local zombies=$(ps aux | awk '{if ($8 == "Z") print $0}' | wc -l)
    
    if [ "$zombies" -gt 0 ]; then
        print_warning "Found $zombies zombie processes"
        # Zombies are cleaned up by parent process termination
        return 1
    else
        print_success "No zombie processes found"
        return 0
    fi
}

# Monitor and fix network issues
check_network() {
    print_status "Checking network connectivity..."
    
    # Check DNS
    if ! nslookup google.com > /dev/null 2>&1; then
        print_warning "DNS resolution issues detected"
        return 1
    fi
    
    # Check Docker network
    if ! docker network inspect hydra-network > /dev/null 2>&1; then
        print_error "Docker network not found"
        docker network create hydra-network 2>/dev/null || true
        return 1
    fi
    
    print_success "Network is healthy"
    return 0
}

# Auto-scaling based on load
auto_scale() {
    print_status "Checking if auto-scaling is needed..."
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # If CPU usage is high, suggest scaling
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        print_warning "High CPU usage detected: ${cpu_usage}%"
        print_status "Consider scaling up the application"
        
        # Could automatically scale here with orchestration tools
        return 1
    else
        print_success "CPU load is normal: ${cpu_usage}%"
        return 0
    fi
}

# Generate health report
generate_health_report() {
    local report_file="/tmp/health-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
═══════════════════════════════════════════════════════
  HYDRA-TERMUX HEALTH REPORT
  Generated: $(date)
═══════════════════════════════════════════════════════

SYSTEM METRICS:
  CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
  Memory: $(free -h | awk 'NR==2{printf "%s/%s (%.2f%%)", $3,$2,$3*100/$2 }')
  Disk: $(df -h / | awk 'NR==2{printf "%s/%s (%s)", $3,$2,$5}')
  
SERVICES:
  Application: $(docker ps | grep hydra-termux-prod > /dev/null && echo "UP" || echo "DOWN")
  PostgreSQL: $(docker ps | grep hydra-postgres-prod > /dev/null && echo "UP" || echo "DOWN")
  Redis: $(docker ps | grep hydra-redis-prod > /dev/null && echo "UP" || echo "DOWN")
  Nginx: $(docker ps | grep hydra-nginx-prod > /dev/null && echo "UP" || echo "DOWN")
  
RECENT ISSUES:
$(tail -20 "$LOG_FILE" | grep "ERROR\|WARN" || echo "  No recent issues")

═══════════════════════════════════════════════════════
EOF
    
    echo "Health report saved to: $report_file"
}

# Main monitoring loop
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  HYDRA-TERMUX AUTO-HEALING SYSTEM${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
    
    log_event "Auto-healing system started"
    
    local iteration=0
    local failures=0
    
    while true; do
        ((iteration++))
        echo ""
        print_status "=== Health Check #$iteration at $(date +%H:%M:%S) ==="
        echo ""
        
        # Run all health checks
        check_disk_space || ((failures++))
        check_memory || ((failures++))
        check_network || ((failures++))
        check_database || ((failures++))
        check_redis || ((failures++))
        check_application || ((failures++))
        check_zombie_processes || true
        auto_scale || true
        
        # Generate report every 10 iterations
        if [ $((iteration % 10)) -eq 0 ]; then
            generate_health_report
        fi
        
        # Alert if too many failures
        if [ "$failures" -gt "$ALERT_THRESHOLD" ]; then
            print_error "Multiple health check failures detected! Manual intervention may be required."
            failures=0
        fi
        
        print_status "Next check in 60 seconds..."
        sleep 60
    done
}

# Handle script arguments
case "${1:-}" in
    --once)
        check_disk_space
        check_memory
        check_database
        check_redis
        check_application
        generate_health_report
        ;;
    --report)
        generate_health_report
        ;;
    *)
        main
        ;;
esac
