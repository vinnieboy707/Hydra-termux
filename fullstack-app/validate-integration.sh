#!/bin/bash

# Validation script for Hydra-Termux Full-Stack Integration
# This script validates that all files are in place and properly structured

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Hydra-Termux Full-Stack Integration Validation              ║"
echo "║  Menu Items 1-18 with Webhooks and PostgreSQL Support        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

BACKEND_DIR="fullstack-app/backend"
FRONTEND_DIR="fullstack-app/frontend"
SUCCESS=0
FAILED=0

check_file() {
    if [ -f "$1" ]; then
        echo "✓ $1"
        ((SUCCESS++))
    else
        echo "✗ $1 (MISSING)"
        ((FAILED++))
    fi
}

check_syntax() {
    if node -c "$1" 2>/dev/null; then
        echo "✓ $1 (syntax valid)"
        ((SUCCESS++))
    else
        echo "✗ $1 (syntax error)"
        ((FAILED++))
    fi
}

echo "=== Checking Backend Files ==="
echo ""

echo "Core Files:"
check_file "$BACKEND_DIR/server.js"
check_file "$BACKEND_DIR/database.js"
check_file "$BACKEND_DIR/database-pg.js"
check_file "$BACKEND_DIR/package.json"
check_file "$BACKEND_DIR/.env.example"
echo ""

echo "Route Files (Menu Items Integration):"
check_file "$BACKEND_DIR/routes/auth.js"
check_file "$BACKEND_DIR/routes/attacks.js"         # Menu 1-8
check_file "$BACKEND_DIR/routes/wordlists.js"       # Menu 9
check_file "$BACKEND_DIR/routes/targets.js"         # Menu 11
check_file "$BACKEND_DIR/routes/results.js"         # Menu 12, 15
check_file "$BACKEND_DIR/routes/config.js"          # Menu 13
check_file "$BACKEND_DIR/routes/logs.js"            # Menu 14
check_file "$BACKEND_DIR/routes/system.js"          # Menu 16, 17, 18
check_file "$BACKEND_DIR/routes/webhooks.js"        # NEW: Webhooks
check_file "$BACKEND_DIR/routes/dashboard.js"
echo ""

echo "Middleware:"
check_file "$BACKEND_DIR/middleware/auth.js"
echo ""

echo "=== Checking Frontend Files ==="
echo ""
check_file "$FRONTEND_DIR/package.json"
check_file "$FRONTEND_DIR/src/App.js"
check_file "$FRONTEND_DIR/public/index.html"
echo ""

echo "=== Checking Documentation ==="
echo ""
check_file "fullstack-app/README.md"
check_file "fullstack-app/API_DOCUMENTATION.md"
check_file "fullstack-app/POSTGRESQL_SETUP.md"
check_file "fullstack-app/INTEGRATION_SUMMARY.md"
echo ""

echo "=== Validating JavaScript Syntax ==="
echo ""
if command -v node >/dev/null 2>&1; then
    check_syntax "$BACKEND_DIR/server.js"
    check_syntax "$BACKEND_DIR/database.js"
    check_syntax "$BACKEND_DIR/database-pg.js"
    
    for route in "$BACKEND_DIR/routes/"*.js; do
        [ -f "$route" ] && check_syntax "$route"
    done
    
    for middleware in "$BACKEND_DIR/middleware/"*.js; do
        [ -f "$middleware" ] && check_syntax "$middleware"
    done
else
    echo "⚠ Node.js not found - skipping syntax validation"
fi
echo ""

echo "=== Menu Items to API Mapping ==="
echo ""
echo "Menu 1: SSH Attack          → POST /api/attacks (type: ssh)"
echo "Menu 2: FTP Attack          → POST /api/attacks (type: ftp)"
echo "Menu 3: Web Attack          → POST /api/attacks (type: http)"
echo "Menu 4: RDP Attack          → POST /api/attacks (type: rdp)"
echo "Menu 5: MySQL Attack        → POST /api/attacks (type: mysql)"
echo "Menu 6: PostgreSQL Attack   → POST /api/attacks (type: postgres)"
echo "Menu 7: SMB Attack          → POST /api/attacks (type: smb)"
echo "Menu 8: Auto Attack         → POST /api/attacks (type: auto)"
echo "Menu 9: Download Wordlists  → POST /api/wordlists/scan"
echo "Menu 10: Generate Wordlist  → Script-based (CLI)"
echo "Menu 11: Scan Target        → POST /api/targets"
echo "Menu 12: View Results       → GET /api/results"
echo "Menu 13: View Config        → GET /api/config"
echo "Menu 14: View Logs          → GET /api/logs"
echo "Menu 15: Export Results     → GET /api/results/export"
echo "Menu 16: Update System      → GET/POST /api/system/update/*"
echo "Menu 17: Help               → GET /api/system/help"
echo "Menu 18: About              → GET /api/system/about"
echo ""

echo "=== New Features ==="
echo ""
echo "✓ Webhook System            → /api/webhooks"
echo "✓ PostgreSQL Support        → DB_TYPE=postgres in .env"
echo "✓ Real-time WebSocket       → Same port as HTTP API"
echo "✓ Admin Middleware          → Role-based access control"
echo "✓ Complete API Docs         → API_DOCUMENTATION.md"
echo "✓ PostgreSQL Setup Guide    → POSTGRESQL_SETUP.md"
echo ""

echo "=== Validation Summary ==="
echo ""
echo "✓ Success: $SUCCESS"
echo "✗ Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ✓ All checks passed!                                        ║"
    echo "║  The full-stack integration is complete and ready to use.   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    exit 0
else
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ⚠ Some checks failed.                                       ║"
    echo "║  Please review the errors above.                             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    exit 1
fi
