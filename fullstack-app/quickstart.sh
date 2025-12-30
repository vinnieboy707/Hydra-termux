#!/bin/bash

# Hydra-Termux Quick Start - One Command Deployment
# This script handles everything needed to get the platform running

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🐍 HYDRA PENETRATION TESTING PLATFORM 🐍                   ║"
echo "║   Quick Start - Complete Setup & Deployment                  ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
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

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install --production
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${YELLOW}ℹ️  Backend dependencies already installed${NC}"
fi

# Setup backend environment
if [ ! -f ".env" ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << 'ENV_EOF'
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

# Security - Generate secure JWT secret
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

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
    echo -e "${GREEN}✅ Backend .env created${NC}"
    echo -e "${YELLOW}⚠️  Edit backend/.env to customize settings${NC}"
else
    echo -e "${YELLOW}ℹ️  Backend .env already exists${NC}"
fi

cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install --production
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}ℹ️  Frontend dependencies already installed${NC}"
fi

# Setup frontend environment
if [ ! -f ".env" ]; then
    echo "📝 Creating frontend .env file..."
    echo "PORT=3001" > .env
    echo "REACT_APP_API_URL=http://localhost:3000" >> .env
    echo -e "${GREEN}✅ Frontend .env created${NC}"
else
    echo -e "${YELLOW}ℹ️  Frontend .env already exists${NC}"
fi

cd ..

# Initialize database and create super admin
echo ""
echo "🔧 Initializing database..."
cd backend

# Get super admin credentials
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   SUPER ADMIN ACCOUNT SETUP                                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Enter super admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Enter super admin email [admin@hydra.local]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@hydra.local}

read -sp "Enter super admin password [will generate secure password]: " ADMIN_PASS
echo ""

# Generate secure password if not provided
if [ -z "$ADMIN_PASS" ]; then
    # Use Node.js crypto for secure password generation
    ADMIN_PASS=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64').slice(0,16))" 2>/dev/null || openssl rand -base64 16)
    echo -e "${YELLOW}Generated secure password: ${ADMIN_PASS}${NC}"
    echo -e "${RED}⚠️  SAVE THIS PASSWORD NOW! Write it down or save to password manager.${NC}"
fi

# Create initialization script
cat > init-super-admin.js << 'INIT_EOF'
const bcrypt = require('bcrypt');
const { run, get } = require('./database');

const username = process.argv[2];
const password = process.argv[3];
const email = process.argv[4];

async function createSuperAdmin() {
  try {
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if user exists
    const existing = await get('SELECT id, role FROM users WHERE username = ?', [username]);
    
    if (existing) {
      // Update to super_admin if exists
      console.log(`ℹ️  User '${username}' exists - upgrading to super_admin role...`);
      await run('UPDATE users SET role = ? WHERE username = ?', ['super_admin', username]);
      console.log('✅ User upgraded to super_admin');
    } else {
      // Create new super admin
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await run(
        'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, email, 'super_admin']
      );
      console.log('✅ Super admin account created successfully');
      console.log(`   Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   Role: super_admin`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
INIT_EOF

# Run initialization
node init-super-admin.js "$ADMIN_USER" "$ADMIN_PASS" "$ADMIN_EMAIL"
rm init-super-admin.js

cd ..

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   ✅ SETUP COMPLETE!                                          ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Your Credentials:"
echo "   Username: $ADMIN_USER"
echo "   Email: $ADMIN_EMAIL"
echo "   Role: super_admin"
echo ""
echo "🌐 Access URLs:"
echo "   Backend API: http://localhost:3000"
echo "   Frontend UI: http://localhost:3001"
echo ""
echo "🚀 Starting application..."
echo ""

# Start the application
cd backend
node server.js &
BACKEND_PID=$!

echo "⏳ Waiting for backend to start..."
sleep 5

cd ../frontend
PORT=3001 npm start &
FRONTEND_PID=$!

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   🎉 HYDRA PLATFORM IS RUNNING!                               ║"
echo "║                                                               ║"
echo "║   Open: http://localhost:3001                                 ║"
echo "║   Login with your super admin credentials                     ║"
echo "║                                                               ║"
echo "║   Press Ctrl+C to stop both servers                           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"

# Cleanup on exit
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# Wait for processes
wait
