#!/bin/bash

# Hydra Full Stack Application Startup Script

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🐍 HYDRA PENETRATION TESTING PLATFORM 🐍                   ║"
echo "║   Full Stack Application Launcher                            ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js first: pkg install nodejs -y"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Function to check if dependencies are installed
check_dependencies() {
    local dir=$1
    if [ ! -d "$dir/node_modules" ]; then
        echo "📦 Installing dependencies for $dir..."
        cd "$dir"
        npm install
        cd "$SCRIPT_DIR"
    else
        echo "✅ Dependencies already installed for $dir"
    fi
}

# Setup backend
echo "🔧 Setting up backend..."
check_dependencies "$SCRIPT_DIR/backend"

# Create .env if it doesn't exist
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    echo "📝 Creating backend .env file..."
    cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
    echo "⚠️  Please edit backend/.env with your settings!"
fi

# Setup frontend
echo ""
echo "🔧 Setting up frontend..."
check_dependencies "$SCRIPT_DIR/frontend"

# Create default admin user in database
echo ""
echo "👤 Creating default admin user..."
cd "$SCRIPT_DIR/backend"
node init-users.js || echo "⚠️  Note: Admin user may already exist"
cd "$SCRIPT_DIR"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🚀 Ready to launch!                                         ║"
echo "║                                                               ║"
echo "║   Backend API: http://localhost:3000                          ║"
echo "║   Frontend UI: http://localhost:3001                          ║"
echo "║                                                               ║"
echo "║   Default credentials:                                        ║"
echo "║   Username: admin                                             ║"
echo "║   Password: Admin@123                                         ║"
echo "║                                                               ║"
echo "║   ⚠️  Change the default password immediately!                ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Choose an option:"
echo "1) Start backend only"
echo "2) Start frontend only"
echo "3) Start both (recommended)"
echo "4) Exit"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo "🚀 Starting backend..."
        cd "$SCRIPT_DIR/backend"
        npm start
        ;;
    2)
        echo "🚀 Starting frontend..."
        cd "$SCRIPT_DIR/frontend"
        npm start
        ;;
    3)
        echo "🚀 Starting both backend and frontend..."
        echo "Backend will start on port 3000"
        echo "Frontend will start on port 3001"
        echo ""
        
        # Start backend in background
        cd "$SCRIPT_DIR/backend"
        npm start &
        BACKEND_PID=$!
        
        # Wait a bit for backend to start
        sleep 3
        
        # Start frontend
        cd "$SCRIPT_DIR/frontend"
        npm start
        
        # Clean up on exit
        trap "kill $BACKEND_PID 2>/dev/null" EXIT
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
