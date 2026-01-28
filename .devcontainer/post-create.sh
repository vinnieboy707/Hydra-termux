#!/bin/bash

# Post-create script for dev container
# Runs after the container is created

set -e

echo "🚀 Running post-create setup..."

# Change to workspace directory
cd /workspace

# Install project dependencies if not already installed
if [ -f "fullstack-app/backend/package.json" ]; then
    echo "📦 Installing backend dependencies..."
    cd fullstack-app/backend
    npm install
    cd /workspace
fi

if [ -f "fullstack-app/frontend/package.json" ]; then
    echo "📦 Installing frontend dependencies..."
    cd fullstack-app/frontend
    npm install
    cd /workspace
fi

# Make all scripts executable
echo "🔧 Setting script permissions..."
find /workspace/scripts -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
chmod +x /workspace/hydra.sh 2>/dev/null || true
chmod +x /workspace/install.sh 2>/dev/null || true

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p \
    /workspace/results \
    /workspace/wordlists \
    /workspace/logs \
    /workspace/config \
    /data/database \
    /data/backups

# Initialize git hooks if .git exists
if [ -d "/workspace/.git" ]; then
    echo "🔗 Setting up git configuration..."
    git config --local core.autocrlf input
    git config --local core.fileMode false
fi

# Create a welcome message file
cat > /workspace/.devcontainer/welcome.txt << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          🚀 HYDRA-TERMUX DEVELOPMENT CONTAINER 🚀            ║
║                                                               ║
║  Welcome to your fully configured development environment!   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Quick Start Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Development:
   npm run dev          - Start development servers
   npm run dev:backend  - Start backend only
   npm run dev:frontend - Start frontend only
   npm test             - Run tests
   npm run lint         - Run linters

🔧 Hydra Tools:
   ./hydra.sh           - Main Hydra interface
   ./install.sh         - Install dependencies
   bash scripts/onboarding.sh - Interactive onboarding

📦 Database:
   Adminer:       http://localhost:8080
   PostgreSQL:    localhost:5432 (hydra_dev/hydra_dev_pass)
   Redis Insight: http://localhost:8001
   Redis:         localhost:6379

🌐 Services:
   Backend API:   http://localhost:3000
   Frontend:      http://localhost:3001
   API Docs:      http://localhost:3000/api/docs

💡 Tips:
   • All penetration testing tools are pre-installed
   • ShellCheck is enabled for bash scripts
   • Hot reload is enabled for development
   • Use 'onboard-dev' command to run dev onboarding

📚 Documentation:
   README.md              - Project overview
   QUICKSTART.md          - Quick start guide
   docs/                  - Full documentation

EOF

# Create convenience commands
echo "📝 Creating convenience commands..."
cat > ~/.local/bin/onboard-dev << 'EOF'
#!/bin/bash
bash /workspace/scripts/onboarding.sh
EOF
chmod +x ~/.local/bin/onboard-dev

cat > ~/.local/bin/hydra-status << 'EOF'
#!/bin/bash
echo "=== Hydra Development Status ==="
echo ""
echo "Services:"
docker-compose -f /workspace/.devcontainer/docker-compose.dev.yml ps
echo ""
echo "Ports:"
ss -tlnp 2>/dev/null | grep -E ":(3000|3001|5432|6379|8080|8001)" || echo "No services listening"
EOF
chmod +x ~/.local/bin/hydra-status

# Show welcome message
cat /workspace/.devcontainer/welcome.txt

echo ""
echo "✅ Post-create setup complete!"
echo "💡 Type 'onboard-dev' to start the development onboarding"
