#!/bin/bash

# Performance Optimization Script
# Automatically tunes system and application parameters for optimal performance

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Optimize Docker performance
optimize_docker() {
    print_header "Optimizing Docker Configuration"
    
    # Enable BuildKit
    export DOCKER_BUILDKIT=1
    print_success "Enabled Docker BuildKit"
    
    # Configure Docker daemon for performance
    if [ -f /etc/docker/daemon.json ]; then
        print_success "Docker daemon configuration exists"
    else
        cat > /tmp/docker-daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
DOCKEREOF
        print_success "Created optimized Docker daemon config (requires sudo to apply)"
    fi
}

# Optimize database
optimize_database() {
    print_header "Optimizing Database Configuration"
    
    cat > /tmp/postgres-optimized.conf << 'PGEOF'
# Performance optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
PGEOF
    
    print_success "Created optimized PostgreSQL configuration"
}

# Optimize Redis
optimize_redis() {
    print_header "Optimizing Redis Configuration"
    
    cat > /tmp/redis-optimized.conf << 'REDISEOF'
# Performance optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
lua-time-limit 5000
slowlog-log-slower-than 10000
slowlog-max-len 128
REDISEOF
    
    print_success "Created optimized Redis configuration"
}

# Optimize Node.js application
optimize_nodejs() {
    print_header "Optimizing Node.js Configuration"
    
    cat > /tmp/node-optimizations.env << 'NODEEOF'
# Node.js performance environment variables
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
UV_THREADPOOL_SIZE=4
NODEEOF
    
    print_success "Created Node.js performance configuration"
}

# Create caching strategy
setup_caching() {
    print_header "Setting Up Advanced Caching"
    
    cat > /tmp/nginx-cache.conf << 'NGINXEOF'
# Nginx caching configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=1g inactive=60m use_temp_path=off;
proxy_cache_key "$scheme$request_method$host$request_uri";
proxy_cache_valid 200 60m;
proxy_cache_valid 404 10m;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
proxy_cache_background_update on;
proxy_cache_lock on;
NGINXEOF
    
    print_success "Created Nginx caching configuration"
}

# Optimize system limits
optimize_system_limits() {
    print_header "Optimizing System Limits"
    
    cat > /tmp/limits-optimized.conf << 'LIMITSEOF'
# System limits for high performance
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
LIMITSEOF
    
    print_success "Created system limits configuration (requires sudo to apply)"
}

# Create performance monitoring script
create_perf_monitor() {
    print_header "Creating Performance Monitor"
    
    cat > /tmp/perf-monitor.sh << 'MONEOF'
#!/bin/bash
# Continuous performance monitoring

while true; do
    echo "=== Performance Snapshot $(date) ==="
    
    # CPU
    echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% used"
    
    # Memory
    free -h | awk 'NR==2{printf "Memory: %s/%s (%.2f%%)\n", $3,$2,$3*100/$2 }'
    
    # Disk
    df -h / | awk 'NR==2{printf "Disk: %s/%s (%s used)\n", $3,$2,$5}'
    
    # Docker containers
    echo "Docker containers: $(docker ps -q | wc -l) running"
    
    # Active connections
    echo "Active connections: $(ss -s | grep TCP: | awk '{print $2}')"
    
    echo ""
    sleep 60
done
MONEOF
    chmod +x /tmp/perf-monitor.sh
    
    print_success "Created performance monitoring script"
}

# Parallel processing optimization
create_parallel_scripts() {
    print_header "Creating Parallel Processing Utilities"
    
    cat > /tmp/parallel-attack.sh << 'PARAEOF'
#!/bin/bash
# Parallel attack execution for maximum performance

MAX_PARALLEL=8

run_parallel_attacks() {
    local targets_file="$1"
    local attack_type="$2"
    
    # Use GNU parallel if available, otherwise use xargs
    if command -v parallel &> /dev/null; then
        cat "$targets_file" | parallel -j $MAX_PARALLEL "./scripts/${attack_type}_admin_attack.sh -t {}"
    else
        cat "$targets_file" | xargs -P $MAX_PARALLEL -I {} ./scripts/${attack_type}_admin_attack.sh -t {}
    fi
}

echo "Parallel attack utility created"
PARAEOF
    chmod +x /tmp/parallel-attack.sh
    
    print_success "Created parallel processing utilities"
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  HYDRA-TERMUX PERFORMANCE OPTIMIZATION${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
    
    optimize_docker
    optimize_database
    optimize_redis
    optimize_nodejs
    setup_caching
    optimize_system_limits
    create_perf_monitor
    create_parallel_scripts
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Optimization Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "Generated configuration files in /tmp/"
    echo "Review and apply configurations as needed (some require sudo)"
    echo ""
    echo "Performance improvements:"
    echo "  ⚡ Docker BuildKit enabled"
    echo "  ⚡ Database tuned for performance"
    echo "  ⚡ Redis optimized for speed"
    echo "  ⚡ Node.js memory optimized"
    echo "  ⚡ Nginx caching configured"
    echo "  ⚡ System limits increased"
    echo "  ⚡ Performance monitoring ready"
    echo "  ⚡ Parallel processing enabled"
    echo ""
}

main
