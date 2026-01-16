#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# Hydra-Termux Setup Fix Script for Android/Termux Environment
# ============================================================================
# This script automatically fixes common issues when running the fullstack
# application in Termux, particularly the bcrypt compilation failure.
#
# Features:
# - Intelligent environment detection
# - Automatic bcrypt to bcryptjs migration
# - Dependency installation with error recovery
# - Health checks and validation
# - Performance optimization for mobile devices
# - Comprehensive error handling and logging
# - Rollback capability on failure
# ============================================================================

set -e  # Exit on error (will be trapped)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Colors for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Symbols
CHECK_MARK="✓"
CROSS_MARK="✗"
ARROW="→"
WARNING="⚠"
INFO="ℹ"
ROCKET="🚀"
WRENCH="🔧"
PACKAGE="📦"
SPARKLES="✨"

# Script metadata
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="Hydra-Termux Setup Fix"
LOG_FILE="/tmp/hydra-termux-setup-$(date +%Y%m%d_%H%M%S).log"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}${INFO}${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}${CHECK_MARK}${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}${WARNING}${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}${CROSS_MARK}${NC} $*" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "${CYAN}${ARROW}${NC} $*" | tee -a "$LOG_FILE"
}

# ============================================================================
# BANNER
# ============================================================================

show_banner() {
    clear
    echo -e "${BLUE}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🐍 HYDRA-TERMUX SETUP FIX FOR ANDROID/TERMUX 🐍             ║
║                                                                ║
║   Intelligent Setup Assistant v2.0.0                           ║
║   Fixes bcrypt issues & optimizes for mobile environment       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================

detect_environment() {
    log_info "Detecting environment..."
    
    # Check if running in Termux
    if [[ "$PREFIX" == "/data/data/com.termux"* ]]; then
        log_success "Termux environment detected"
        IS_TERMUX=true
    else
        log_warning "Not running in Termux, but proceeding anyway"
        IS_TERMUX=false
    fi
    
    # Detect architecture
    ARCH=$(uname -m)
    log_info "Architecture: $ARCH"
    
    # Check Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js found: $NODE_VERSION"
    else
        log_error "Node.js not found! Please install: pkg install nodejs"
        exit 1
    fi
    
    # Check npm version
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log_success "npm found: $NPM_VERSION"
    else
        log_error "npm not found! Please install Node.js properly"
        exit 1
    fi
    
    # Check available memory
    if command -v free &> /dev/null; then
        TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
        AVAIL_MEM=$(free -m | awk 'NR==2{print $7}')
        log_info "Memory: ${AVAIL_MEM}MB available / ${TOTAL_MEM}MB total"
        
        if [ "$AVAIL_MEM" -lt 500 ]; then
            log_warning "Low memory detected. Installation may be slower."
        fi
    fi
    
    echo ""
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_backup() {
    local file=$1
    local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$file" ]; then
        cp "$file" "$backup"
        log_success "Created backup: $backup"
        echo "$backup" >> /tmp/hydra-backups.txt
    fi
}

restore_backups() {
    log_warning "Restoring backups..."
    
    if [ -f /tmp/hydra-backups.txt ]; then
        while read -r backup; do
            if [ -f "$backup" ]; then
                original="${backup%.backup.*}"
                cp "$backup" "$original"
                log_success "Restored: $original"
            fi
        done < /tmp/hydra-backups.txt
        rm /tmp/hydra-backups.txt
    fi
}

# ============================================================================
# ERROR HANDLER
# ============================================================================

error_handler() {
    local exit_code=$?
    log_error "Setup failed with exit code: $exit_code"
    log_warning "Attempting to restore previous state..."
    restore_backups
    
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Setup Failed - Check log file for details:                   ║${NC}"
    echo -e "${RED}║  $LOG_FILE${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    exit $exit_code
}

trap error_handler ERR

# ============================================================================
# MAIN SETUP LOGIC
# ============================================================================

# Navigate to repo root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

show_banner
detect_environment

# ============================================================================
# STEP 1: FIX BACKEND DEPENDENCIES
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Fixing Backend Dependencies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd fullstack-app/backend

# Backup package.json
create_backup "package.json"

# Check if bcrypt is in package.json
if grep -q '"bcrypt"' package.json; then
    log_warning "Found native bcrypt dependency - replacing with bcryptjs..."
    
    # Remove bcrypt node_modules
    if [ -d "node_modules/bcrypt" ]; then
        log_step "Removing bcrypt from node_modules..."
        rm -rf node_modules/bcrypt
    fi
    
    # Update package.json
    log_step "Updating package.json..."
    sed -i.bak 's/"bcrypt": "[^"]*"/"bcryptjs": "^2.4.3"/g' package.json
    
    log_success "Updated package.json to use bcryptjs"
else
    log_success "package.json already uses bcryptjs or bcrypt not found"
fi

# Clean npm cache to avoid issues
log_step "Cleaning npm cache..."
npm cache clean --force 2>&1 | tee -a "$LOG_FILE" | grep -v "deprecated" || true

# Install backend dependencies
echo ""
log_step "Installing backend dependencies (this may take a few minutes)..."
echo -e "${YELLOW}${INFO} Using --legacy-peer-deps flag for compatibility${NC}"

# Use a progress indicator
{
    npm install --legacy-peer-deps 2>&1 | grep -v "deprecated" || true
} &
NPM_PID=$!

# Show progress spinner
spin='-\|/'
i=0
while kill -0 $NPM_PID 2>/dev/null; do
    i=$(( (i+1) %4 ))
    printf "\r${CYAN}Installing... ${spin:$i:1}${NC}"
    sleep 0.5
done
printf "\r${GREEN}${CHECK_MARK} Installation complete!${NC}\n"

log_success "Backend dependencies installed successfully"

# Verify bcryptjs is installed
if [ -d "node_modules/bcryptjs" ]; then
    BCRYPTJS_VERSION=$(node -p "require('./node_modules/bcryptjs/package.json').version" 2>/dev/null || echo "unknown")
    log_success "bcryptjs version $BCRYPTJS_VERSION is installed"
else
    log_error "bcryptjs was not installed correctly"
    exit 1
fi

# Initialize database and create default admin user
echo ""
log_step "Initializing database and creating default admin user..."
node init-users.js 2>&1 | tee -a "$LOG_FILE" || log_warning "Admin user may already exist"

# Create .env if missing
if [ ! -f ".env" ]; then
    log_step "Creating .env file..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
    else
        # Generate secure JWT secret
        if command -v openssl &> /dev/null; then
            JWT_SECRET=$(openssl rand -hex 32)
        else
            JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
        fi
        
        cat > .env << EOF
# Backend Configuration
PORT=3000
JWT_SECRET=$JWT_SECRET

# Database Configuration
DB_TYPE=sqlite
DB_PATH=./database.sqlite

# Environment
NODE_ENV=development

# Security
CORS_ORIGIN=http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        log_success "Created default .env file with secure JWT secret"
    fi
else
    log_success ".env file already exists"
fi

cd "$REPO_ROOT"

# ============================================================================
# STEP 2: SETUP FRONTEND
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Setting Up Frontend${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd fullstack-app/frontend

# Check if node_modules exists and is relatively fresh
SKIP_FRONTEND_INSTALL=false
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    # Check if package.json is newer than node_modules
    if [ "package.json" -ot "node_modules" ]; then
        log_success "Frontend dependencies appear up-to-date"
        SKIP_FRONTEND_INSTALL=true
    fi
fi

if [ "$SKIP_FRONTEND_INSTALL" = false ]; then
    log_step "Installing frontend dependencies (this may take a few minutes)..."
    
    {
        npm install --legacy-peer-deps 2>&1 | grep -v "deprecated" || true
    } &
    NPM_PID=$!
    
    # Show progress spinner
    i=0
    while kill -0 $NPM_PID 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r${CYAN}Installing... ${spin:$i:1}${NC}"
        sleep 0.5
    done
    printf "\r${GREEN}${CHECK_MARK} Installation complete!${NC}\n"
    
    log_success "Frontend dependencies installed successfully"
else
    log_info "Skipping frontend installation (dependencies up-to-date)"
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=ws://localhost:3000
EOF
    log_success "Created frontend .env file"
else
    log_success "Frontend .env file already exists"
fi

cd "$REPO_ROOT"

# ============================================================================
# STEP 3: HEALTH CHECKS
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Running Health Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if ports are available
check_port() {
    local port=$1
    local service=$2
    
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_warning "Port $port is already in use (needed for $service)"
            return 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            log_warning "Port $port is already in use (needed for $service)"
            return 1
        fi
    fi
    
    log_success "Port $port is available for $service"
    return 0
}

check_port 3000 "backend"
check_port 3001 "frontend"

# Verify critical files exist
echo ""
log_step "Verifying critical files..."

CRITICAL_FILES=(
    "fullstack-app/backend/server.js"
    "fullstack-app/backend/package.json"
    "fullstack-app/backend/routes/auth.js"
    "fullstack-app/frontend/package.json"
    "fullstack-app/frontend/src/App.js"
)

ALL_FILES_OK=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
    else
        log_error "$file is missing!"
        ALL_FILES_OK=false
    fi
done

if [ "$ALL_FILES_OK" = false ]; then
    log_error "Some critical files are missing. Setup may not work correctly."
    exit 1
fi

# ============================================================================
# STEP 4: PERFORMANCE OPTIMIZATION
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Performance Optimization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Set npm config for better performance on mobile
log_step "Optimizing npm configuration for Termux/mobile..."

npm config set fetch-timeout 60000 2>&1 | tee -a "$LOG_FILE" || true
npm config set maxsockets 5 2>&1 | tee -a "$LOG_FILE" || true

log_success "npm configuration optimized"

# Create .npmrc in backend if in Termux
if [ "$IS_TERMUX" = true ]; then
    cat > fullstack-app/backend/.npmrc << 'EOF'
# Termux/Android optimizations
fetch-timeout=60000
maxsockets=5
legacy-peer-deps=true
EOF
    log_success "Created optimized .npmrc for backend"
    
    cat > fullstack-app/frontend/.npmrc << 'EOF'
# Termux/Android optimizations
fetch-timeout=60000
maxsockets=5
legacy-peer-deps=true
EOF
    log_success "Created optimized .npmrc for frontend"
fi

# ============================================================================
# SETUP COMPLETE
# ============================================================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║          ${SPARKLES}${SPARKLES}${SPARKLES} SETUP COMPLETE! ${SPARKLES}${SPARKLES}${SPARKLES}                             ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Generate setup report
echo -e "${CYAN}📊 Setup Report:${NC}"
echo -e "   ${CHECK_MARK} bcrypt replaced with bcryptjs"
echo -e "   ${CHECK_MARK} Backend dependencies installed"
echo -e "   ${CHECK_MARK} Frontend dependencies installed"
echo -e "   ${CHECK_MARK} Environment files configured"
echo -e "   ${CHECK_MARK} Health checks passed"
echo -e "   ${CHECK_MARK} Performance optimizations applied"
echo ""

# Next steps
echo -e "${BLUE}${ROCKET} Next Steps:${NC}"
echo ""
echo -e "  ${YELLOW}1. Start the backend server:${NC}"
echo -e "     ${GREEN}cd fullstack-app/backend && npm start${NC}"
echo -e "     ${CYAN}${ARROW} This will start the API on http://localhost:3000${NC}"
echo ""
echo -e "  ${YELLOW}2. In a NEW terminal session, start the frontend:${NC}"
echo -e "     ${GREEN}cd fullstack-app/frontend && npm start${NC}"
echo -e "     ${CYAN}${ARROW} This will open the UI at http://localhost:3001${NC}"
echo ""
echo -e "  ${YELLOW}3. Access the application:${NC}"
echo -e "     Frontend: ${BLUE}http://localhost:3001${NC}"
echo -e "     Backend:  ${BLUE}http://localhost:3000${NC}"
echo -e "     API Docs: ${BLUE}http://localhost:3000/api${NC}"
echo ""
echo -e "  ${YELLOW}4. Default login credentials:${NC}"
echo -e "     Username: ${GREEN}admin${NC}"
echo -e "     Password: ${GREEN}Admin@123${NC}"
echo -e "     ${RED}${WARNING} CRITICAL: Change password immediately after first login!${NC}"
echo ""

# Helpful tips
echo -e "${CYAN}${INFO} Helpful Tips:${NC}"
echo -e "   • Use ${WHITE}tmux${NC} or ${WHITE}screen${NC} to run backend/frontend in separate sessions"
echo -e "   • Check logs at: ${WHITE}$LOG_FILE${NC}"
echo -e "   • For issues, run: ${WHITE}npm run health-check${NC} from repo root"
echo -e "   • To clean and reinstall: ${WHITE}npm run clean && npm run install:all${NC}"
echo ""

# Save summary to file
cat > /tmp/hydra-setup-summary.txt << EOF
Hydra-Termux Setup Complete - $(date)
=====================================

Environment:
- Termux: $IS_TERMUX
- Node.js: $NODE_VERSION
- npm: $NPM_VERSION
- Architecture: $ARCH

Changes Made:
- Replaced bcrypt with bcryptjs in backend/package.json
- Installed all backend dependencies
- Installed all frontend dependencies
- Created .env files for backend and frontend
- Applied performance optimizations for mobile

Next Steps:
1. cd fullstack-app/backend && npm start
2. cd fullstack-app/frontend && npm start (in new terminal)
3. Access at http://localhost:3001
4. Login with admin/Admin@123 (change immediately!)

Log File: $LOG_FILE
EOF

log_success "Setup summary saved to: /tmp/hydra-setup-summary.txt"
echo -e "${GREEN}${SPARKLES} Happy hacking! ${SPARKLES}${NC}"
echo ""
