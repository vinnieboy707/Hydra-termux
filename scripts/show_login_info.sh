#!/bin/bash

# Hydra-Termux Login Information Helper
# Displays default credentials and login help

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Function to display banner
show_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                🔐 LOGIN CREDENTIALS HELPER 🔐                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Function to display CLI login info
show_cli_info() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}📱 CLI Tool (hydra.sh) - No Login Required${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}✓${NC} The main CLI tool ${BOLD}does not require authentication${NC}"
    echo -e "  Just run: ${CYAN}./hydra.sh${NC}"
    echo ""
    echo -e "  The command-line interface provides direct access to all"
    echo -e "  attack scripts and tools without needing to log in."
    echo ""
}

# Function to display web app login info
show_web_app_info() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}🌐 Web Application Login${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Access URL:${NC}"
    echo -e "  Frontend: ${CYAN}http://localhost:3001${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:3000${NC}"
    echo ""
    echo -e "${BOLD}Default Admin Credentials:${NC} ${YELLOW}(if using start.sh)${NC}"
    echo -e "  Username: ${GREEN}${BOLD}admin${NC}"
    echo -e "  Password: ${GREEN}${BOLD}admin${NC}"
    echo -e "  Role:     ${CYAN}admin${NC}"
    echo ""
    echo -e "${BOLD}Super Admin Credentials:${NC} ${YELLOW}(if using quickstart.sh)${NC}"
    echo -e "  Username: ${GREEN}${BOLD}[you chose during setup]${NC}"
    echo -e "  Password: ${GREEN}${BOLD}[you chose during setup]${NC}"
    echo -e "  Role:     ${CYAN}super_admin${NC}"
    echo -e "  ${BLUE}ℹ️  Default username: admin (if you pressed Enter)${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTICE:${NC}"
    echo -e "  ${RED}Change the default password immediately after first login!${NC}"
    echo ""
    echo -e "${BOLD}${RED}❌ Credentials Not Working?${NC}"
    echo -e "  ${YELLOW}1.${NC} Make sure you've run setup: ${CYAN}cd fullstack-app && bash start.sh${NC}"
    echo -e "  ${YELLOW}2.${NC} Check if database exists: ${CYAN}ls -la fullstack-app/database.sqlite${NC}"
    echo -e "  ${YELLOW}3.${NC} Verify backend is running on port 3000"
    echo -e "  ${YELLOW}4.${NC} Check browser console for errors (F12)"
    echo -e "  ${YELLOW}5.${NC} See 'Check Super Admin in Database' section below to verify users"
    echo ""
}

# Function to show how to start web app
show_web_app_startup() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}🚀 Starting the Web Application${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Quick Start:${NC}"
    echo -e "  ${CYAN}cd fullstack-app${NC}"
    echo -e "  ${CYAN}bash start.sh${NC}"
    echo ""
    echo -e "${BOLD}Manual Start:${NC}"
    echo -e "  Terminal 1 - Backend:"
    echo -e "    ${CYAN}cd fullstack-app/backend && npm start${NC}"
    echo ""
    echo -e "  Terminal 2 - Frontend:"
    echo -e "    ${CYAN}cd fullstack-app/frontend && npm start${NC}"
    echo ""
}

# Function to show how to reset password
show_reset_password() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}🔄 Reset/Change Password${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Method 1: Re-run Setup Script${NC}"
    echo -e "  ${CYAN}cd fullstack-app${NC}"
    echo -e "  ${CYAN}bash quickstart.sh${NC}"
    echo -e "  (Follow prompts to create new admin account)"
    echo ""
    echo -e "${BOLD}Method 2: Create New Admin/Super Admin User${NC}"
    echo -e "  Create a Node.js script in fullstack-app/backend:"
    echo -e "  ${CYAN}// create-user.js${NC}"
    echo -e "  const bcrypt = require('bcryptjs');"
    echo -e "  const { run } = require('./database');"
    echo -e "  const [user, pass, email, role] = process.argv.slice(2);"
    echo -e "  (async () => {"
    echo -e "    const hash = await bcrypt.hash(pass, 10);"
    echo -e "    await run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',"
    echo -e "      [user, hash, email, role || 'admin']);"
    echo -e "    console.log('✅ ' + (role || 'admin') + ' user created');"
    echo -e "    process.exit(0);"
    echo -e "  })();"
    echo -e ""
    echo -e "  Run for ${CYAN}admin${NC}:       ${CYAN}node create-user.js newadmin YourPassword admin@example.com admin${NC}"
    echo -e "  Run for ${GREEN}super_admin${NC}: ${CYAN}node create-user.js newsuperadmin YourPassword admin@example.com super_admin${NC}"
    echo ""
    echo -e "${BOLD}Method 3: Reset Database${NC}"
    echo -e "  ${CYAN}cd fullstack-app/backend${NC}"
    echo -e "  ${CYAN}rm ../database.sqlite${NC}  (deletes existing database)"
    echo -e "  ${CYAN}npm start${NC}   (will recreate with default admin/admin)"
    echo ""
}

# Function to check web app status
check_web_app_status() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}📊 Web Application Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Check if curl is available
    if ! command -v curl >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠ curl not available - cannot check service status${NC}"
        echo ""
        return
    fi
    
    # Check if backend is running
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
        echo -e "  Backend:  ${GREEN}✓ Running${NC} on http://localhost:3000"
    else
        echo -e "  Backend:  ${RED}✗ Not Running${NC}"
    fi
    
    # Check if frontend is running
    if curl -s http://localhost:3001 >/dev/null 2>&1; then
        echo -e "  Frontend: ${GREEN}✓ Running${NC} on http://localhost:3001"
    else
        echo -e "  Frontend: ${RED}✗ Not Running${NC}"
    fi
    
    echo ""
    
    # Database path
    local db_path="$PROJECT_ROOT/fullstack-app/database.sqlite"
    
    # Check if database exists
    if [ -f "$db_path" ]; then
        echo -e "  Database: ${GREEN}✓ Found${NC} (SQLite)"
    else
        echo -e "  Database: ${YELLOW}⚠ Not Found${NC} (run setup first)"
    fi
    echo ""
}

# Function to check super admin in database
check_super_admin_info() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}🔑 Check Super Admin in Database${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    local db_path="$PROJECT_ROOT/fullstack-app/database.sqlite"
    
    if [ ! -f "$db_path" ]; then
        echo -e "  ${YELLOW}⚠ Database not found${NC}"
        echo -e "  Run setup first: ${CYAN}cd fullstack-app && bash quickstart.sh${NC}"
        echo ""
        return
    fi
    
    # Check if sqlite3 is available
    if ! command -v sqlite3 >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠ sqlite3 not available - cannot query database${NC}"
        echo -e "  Install with: ${CYAN}pkg install sqlite -y${NC} (Termux)"
        echo -e "  Or: ${CYAN}sudo apt install sqlite3 -y${NC} (Debian/Ubuntu)"
        echo ""
        return
    fi
    
    echo -e "${BOLD}Current users in database:${NC}"
    echo ""
    
    # Query database for users with error handling
    if sqlite3 "$db_path" 2>/dev/null << 'SQL'
.mode column
.headers on
.width 15 30 10
SELECT username, email, role FROM users ORDER BY role DESC, username;
SQL
    then
        echo ""
        echo -e "${BLUE}ℹ️  Note: Passwords are hashed and cannot be displayed${NC}"
        echo -e "${BLUE}ℹ️  If you forgot your password, see reset methods below${NC}"
    else
        echo -e "${YELLOW}⚠ Unable to query database${NC}"
        echo -e "  Database may be corrupted or inaccessible"
    fi
    echo ""
}

# Function to show additional help
show_additional_help() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}📚 Additional Resources${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${BOLD}Documentation:${NC}"
    echo -e "    • Quick Start:    ${CYAN}fullstack-app/QUICKSTART.md${NC}"
    echo -e "    • Getting Started: ${CYAN}fullstack-app/GETTING_STARTED.md${NC}"
    echo -e "    • Main README:     ${CYAN}README.md${NC}"
    echo ""
    echo -e "  ${BOLD}For CLI Usage:${NC}"
    echo -e "    • Run: ${CYAN}./hydra.sh${NC}"
    echo -e "    • Select option 18 for Help & Documentation"
    echo ""
}

# Main execution
main() {
    show_banner
    
    echo -e "${BOLD}This tool helps you find login credentials for Hydra-Termux.${NC}"
    echo ""
    
    show_cli_info
    show_web_app_info
    show_web_app_startup
    check_web_app_status
    check_super_admin_info
    show_reset_password
    show_additional_help
    
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}Need more help?${NC} Run: ${CYAN}./hydra.sh${NC} and select option 18"
    echo ""
}

# Run main function
main
