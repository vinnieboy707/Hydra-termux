#!/bin/bash

# Hydra Full Stack Application - Unified Startup & Setup Script
# Combines setup, installation, and deployment in one comprehensive script

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🐍 HYDRA PENETRATION TESTING PLATFORM 🐍                   ║"
echo "║   Full Stack Application - Setup & Deployment                ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Install with: pkg install nodejs -y (Termux) or download from nodejs.org"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version) found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version) found${NC}"
echo ""

# Function to install dependencies
install_dependencies() {
    local dir=$1
    local name=$2
    echo -e "${BLUE}📦 Installing $name dependencies...${NC}"
    cd "$dir"
    if [ ! -d "node_modules" ]; then
        npm install --production
        echo -e "${GREEN}✅ $name dependencies installed${NC}"
    else
        echo -e "${YELLOW}ℹ️  $name dependencies already installed${NC}"
    fi
    cd "$SCRIPT_DIR"
}

# Setup backend
echo -e "${BLUE}🔧 Setting up backend...${NC}"
install_dependencies "$SCRIPT_DIR/backend" "Backend"

# Create backend .env if it doesn't exist
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    echo -e "${BLUE}📝 Creating backend .env file...${NC}"
    cd "$SCRIPT_DIR/backend"
    
    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    cat > .env << ENV_EOF
# Database Configuration
DB_TYPE=sqlite
DB_PATH=../database.sqlite

# PostgreSQL (optional - uncomment if using PostgreSQL)
# DB_TYPE=postgres
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_DB=hydra_termux
# POSTGRES_USER=hydra_user
# POSTGRES_PASSWORD=your_secure_password

# Server Configuration
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=${JWT_SECRET}

# Paths
SCRIPTS_PATH=../../scripts
LOGS_PATH=../../logs
CONFIG_PATH=../../config

# 2FA Configuration
TOTP_ISSUER=Hydra-Termux

# External API Keys (optional)
# VIRUSTOTAL_API_KEY=
# SHODAN_API_KEY=
# ABUSEIPDB_API_KEY=
# CENSYS_API_ID=
# CENSYS_API_SECRET=
# MAXMIND_LICENSE_KEY=

# Email Alerts (optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password
ENV_EOF
    echo -e "${GREEN}✅ Backend .env created with secure JWT secret${NC}"
    cd "$SCRIPT_DIR"
else
    echo -e "${YELLOW}ℹ️  Backend .env already exists${NC}"
fi

# Setup frontend
echo ""
echo -e "${BLUE}🔧 Setting up frontend...${NC}"
install_dependencies "$SCRIPT_DIR/frontend" "Frontend"

# Create frontend .env if it doesn't exist
if [ ! -f "$SCRIPT_DIR/frontend/.env" ]; then
    echo -e "${BLUE}📝 Creating frontend .env file...${NC}"
    cat > "$SCRIPT_DIR/frontend/.env" << 'FRONTEND_ENV'
PORT=3001
REACT_APP_API_URL=http://localhost:3000
FRONTEND_ENV
    echo -e "${GREEN}✅ Frontend .env created${NC}"
else
    echo -e "${YELLOW}ℹ️  Frontend .env already exists${NC}"
fi

# Initialize database and create admin user
echo ""
echo -e "${BLUE}🔧 Initializing database...${NC}"
cd "$SCRIPT_DIR/backend"

# Check if we should run setup or just create default admin
SETUP_MODE="quick"
if [ ! -f "../database.sqlite" ] && [ "${1}" = "--setup" ]; then
    SETUP_MODE="interactive"
fi

if [ "$SETUP_MODE" = "interactive" ]; then
    # Interactive setup for first-time users
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║   SUPER ADMIN ACCOUNT SETUP                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    read -r -p "Enter super admin username [admin]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-admin}
    
    read -r -p "Enter super admin email [admin@hydra.local]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@hydra.local}
    
    read -r -sp "Enter super admin password [auto-generate]: " ADMIN_PASS
    echo ""
    
    # Generate secure password if not provided
    if [ -z "$ADMIN_PASS" ]; then
        ADMIN_PASS=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64').slice(0,16))" 2>/dev/null || echo "admin123")
        echo -e "${YELLOW}Generated secure password: ${ADMIN_PASS}${NC}"
        echo -e "${RED}⚠️  SAVE THIS PASSWORD NOW!${NC}"
    fi
else
    # Quick mode - use defaults
    ADMIN_USER="admin"
    ADMIN_EMAIL="admin@hydra.local"
    ADMIN_PASS="admin"
fi

# Create admin user
cat << 'CREATE_ADMIN_EOF' | ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" ADMIN_EMAIL="$ADMIN_EMAIL" node
const bcrypt = require('bcryptjs');
const { run, get } = require('./database');

const username = process.env.ADMIN_USER || 'admin';
const password = process.env.ADMIN_PASS || 'admin';
const email = process.env.ADMIN_EMAIL || 'admin@hydra.local';
const role = process.env.ADMIN_ROLE || 'super_admin';

async function createAdminUser() {
  try {
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const existing = await get('SELECT id, role FROM users WHERE username = ?', [username]);
    
    if (existing) {
      console.log(`ℹ️  User '${username}' exists - ensuring ${role} role...`);
      await run('UPDATE users SET role = ? WHERE username = ?', [role, username]);
      console.log('✅ User role updated');
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await run(
        'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, email, role]
      );
      console.log('✅ Admin user created successfully');
      console.log(`   Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   Role: ${role}`);
      if (password === 'admin') {
        console.log('⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY!');
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
CREATE_ADMIN_EOF
cd "$SCRIPT_DIR"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🚀 Ready to launch!                                         ║"
echo "║                                                               ║"
echo "║   Backend API: http://localhost:3000                          ║"
echo "║   Frontend UI: http://localhost:3001                          ║"
echo "║                                                               ║"
printf "║   Default credentials:                                        ║\n"
printf "║   Username: %-50s║\n" "$ADMIN_USER"
printf "║   Password: %-50s║\n" "$ADMIN_PASS"
echo "║                                                               ║"
if [ "$ADMIN_PASS" = "admin" ]; then
    echo "║   ⚠️  Change the default password immediately!                ║"
fi
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Choose an option:"
echo "1) Start backend only"
echo "2) Start frontend only"
echo "3) Start both (recommended)"
echo "4) Exit"
echo ""
read -r -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo -e "${BLUE}🚀 Starting backend...${NC}"
        cd "$SCRIPT_DIR/backend"
        npm start
        ;;
    2)
        echo -e "${BLUE}🚀 Starting frontend...${NC}"
        cd "$SCRIPT_DIR/frontend"
        npm start
        ;;
    3)
        echo -e "${BLUE}🚀 Starting both backend and frontend...${NC}"
        echo "Backend will start on port 3000"
        echo "Frontend will start on port 3001"
        echo ""
        
        # Start backend in background
        cd "$SCRIPT_DIR/backend"
        npm start &
        BACKEND_PID=$!
        
        echo "⏳ Waiting for backend to start..."
        sleep 5
        
        # Start frontend
        cd "$SCRIPT_DIR/frontend"
        PORT=3001 npm start &
        FRONTEND_PID=$!
        
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════╗"
        echo "║   🎉 HYDRA PLATFORM IS RUNNING!                               ║"
        echo "║                                                               ║"
        echo "║   Open: http://localhost:3001                                 ║"
        echo "║   Login with your credentials                                 ║"
        echo "║                                                               ║"
        echo "║   Press Ctrl+C to stop both servers                           ║"
        echo "╚═══════════════════════════════════════════════════════════════╝"
        
        # Cleanup on exit
        trap 'echo ""; echo "Stopping servers..."; kill '"$BACKEND_PID"' '"$FRONTEND_PID"' 2>/dev/null; exit 0' INT TERM
        
        # Wait for processes
        wait
        ;;
    4)
        echo -e "${YELLOW}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac
