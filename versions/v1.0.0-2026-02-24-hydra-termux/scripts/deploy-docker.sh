#!/bin/bash
# Hydra-Termux Interactive Docker Deployment Script
# Error-free, persistent deployment with auto-fix capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration file
CONFIG_FILE=".docker-deploy.conf"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        read -rp "Would you like to install Docker? (y/n): " install_docker
        if [[ "$install_docker" == "y" ]]; then
            install_docker_engine
        else
            log_error "Docker is required. Exiting."
            exit 1
        fi
    else
        log_success "Docker is installed: $(docker --version)"
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        read -rp "Would you like to start Docker? (y/n): " start_docker
        if [[ "$start_docker" == "y" ]]; then
            sudo systemctl start docker || log_error "Failed to start Docker"
        else
            log_error "Docker must be running. Exiting."
            exit 1
        fi
    fi
}

# Check if Docker Compose is installed
check_docker_compose() {
    log_info "Checking Docker Compose installation..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        read -rp "Would you like to install Docker Compose? (y/n): " install_compose
        if [[ "$install_compose" == "y" ]]; then
            install_docker_compose
        else
            log_error "Docker Compose is required. Exiting."
            exit 1
        fi
    else
        log_success "Docker Compose is installed"
    fi
}

# Install Docker
install_docker_engine() {
    log_info "Installing Docker..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker "$USER"
        rm get-docker.sh
        log_success "Docker installed successfully"
        log_warning "Please log out and log back in for group changes to take effect"
    else
        log_error "Automatic Docker installation is only supported on Linux"
        log_info "Please install Docker manually from https://docs.docker.com/get-docker/"
        exit 1
    fi
}

# Install Docker Compose
install_docker_compose() {
    log_info "Installing Docker Compose..."
    
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_success "Docker Compose installed successfully"
}

# Load configuration
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        log_info "Loading saved configuration..."
        # shellcheck source=/dev/null
        source "$CONFIG_FILE"
        log_success "Configuration loaded"
        return 0
    fi
    return 1
}

# Save configuration
save_config() {
    log_info "Saving configuration..."
    cat > "$CONFIG_FILE" << EOF
# Hydra-Termux Docker Deployment Configuration
DEPLOYMENT_MODE=$DEPLOYMENT_MODE
USE_POSTGRES=$USE_POSTGRES
USE_REDIS=$USE_REDIS
USE_NGINX=$USE_NGINX
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
EOF
    chmod 600 "$CONFIG_FILE"
    log_success "Configuration saved"
}

# Interactive configuration
interactive_config() {
    echo ""
    echo "================================================"
    echo "   Hydra-Termux Docker Deployment Setup"
    echo "================================================"
    echo ""
    
    # Deployment mode
    echo "Select deployment mode:"
    echo "1) Development (local testing)"
    echo "2) Production (full stack with PostgreSQL, Redis, Nginx)"
    read -rp "Choose (1/2) [default: 2]: " mode_choice
    DEPLOYMENT_MODE=${mode_choice:-2}
    
    if [ "$DEPLOYMENT_MODE" == "2" ]; then
        USE_POSTGRES="yes"
        USE_REDIS="yes"
        USE_NGINX="yes"
        
        # Generate secure secrets
        JWT_SECRET=$(openssl rand -base64 32)
        SESSION_SECRET=$(openssl rand -base64 32)
        POSTGRES_PASSWORD=$(openssl rand -base64 16)
        REDIS_PASSWORD=$(openssl rand -base64 16)
        
        log_success "Secure passwords generated"
    else
        USE_POSTGRES="no"
        USE_REDIS="no"
        USE_NGINX="no"
        JWT_SECRET="dev_jwt_secret"
        SESSION_SECRET="dev_session_secret"
    fi
    
    # Port configuration
    read -rp "HTTP Port [default: 80]: " http_port
    HTTP_PORT=${http_port:-80}
    
    read -rp "HTTPS Port [default: 443]: " https_port
    HTTPS_PORT=${https_port:-443}
    
    # Data persistence
    read -rp "Data directory [default: ./data]: " data_dir
    DATA_DIR=${data_dir:-./data}
    
    mkdir -p "$DATA_DIR"
    
    echo ""
    log_success "Configuration complete"
    
    # Save configuration
    save_config
}

# Create .env file
create_env_file() {
    log_info "Creating .env file..."
    
    cat > .env << EOF
# Hydra-Termux Environment Configuration
NODE_ENV=${DEPLOYMENT_MODE}
PORT=3000

# Security
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}

# Database
DATABASE_URL=postgresql://hydra:${POSTGRES_PASSWORD}@postgres:5432/hydra_db
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Logging
LOG_LEVEL=info

# Ports
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
EOF
    
    chmod 600 .env
    log_success ".env file created"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    if docker-compose build --no-cache; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

# Start services
start_services() {
    log_info "Starting services..."
    
    if [ "$USE_POSTGRES" == "yes" ]; then
        docker-compose up -d postgres redis
        sleep 10  # Wait for databases to initialize
    fi
    
    if docker-compose up -d; then
        log_success "All services started successfully"
    else
        log_error "Failed to start services"
        docker-compose logs
        exit 1
    fi
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "Application is healthy"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    log_error "Application health check failed"
    docker-compose logs hydra-app
    return 1
}

# Display status
display_status() {
    echo ""
    echo "================================================"
    echo "   Deployment Status"
    echo "================================================"
    echo ""
    
    docker-compose ps
    
    echo ""
    echo "================================================"
    echo "   Access Information"
    echo "================================================"
    echo ""
    echo "  🌐 Web Interface: http://localhost:${HTTP_PORT}"
    echo "  🔐 API: http://localhost:3000/api"
    echo "  📊 Database: PostgreSQL (if enabled)"
    echo "  💾 Data Directory: $DATA_DIR"
    echo ""
    echo "================================================"
    echo ""
}

# Auto-fix common issues
auto_fix() {
    log_info "Running auto-fix..."
    
    # Fix permissions
    sudo chown -R "$(whoami)":"$(whoami)" "$DATA_DIR" 2>/dev/null || true
    
    # Clean up old containers
    docker-compose down 2>/dev/null || true
    
    # Prune unused Docker resources
    docker system prune -f 2>/dev/null || true
    
    log_success "Auto-fix complete"
}

# Main deployment function
main() {
    echo "🚀 Hydra-Termux Docker Deployment Script"
    echo ""
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Load or create configuration
    if ! load_config; then
        interactive_config
    else
        read -rp "Use saved configuration? (y/n): " use_saved
        if [[ "$use_saved" != "y" ]]; then
            interactive_config
        fi
    fi
    
    # Create environment file
    create_env_file
    
    # Auto-fix common issues
    auto_fix
    
    # Build and start
    build_images
    start_services
    
    # Health check
    check_health
    
    # Display status
    display_status
    
    log_success "Deployment complete!"
    echo ""
    log_info "Useful commands:"
    echo "  docker-compose logs -f          # View logs"
    echo "  docker-compose ps               # View status"
    echo "  docker-compose restart          # Restart services"
    echo "  docker-compose down             # Stop all services"
    echo "  ./scripts/deploy-docker.sh      # Re-run deployment"
    echo ""
}

# Run main function
main
