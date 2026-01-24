#!/bin/bash

# Complete Validation Script for Hydra-Termux Platform
# Validates all JavaScript files, dependencies, and configurations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   🔍 HYDRA PLATFORM VALIDATION                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Function to check and report
check() {
    local name="$1"
    local command="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "%-50s" "Checking $name..."
    
    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Prerequisites
echo -e "${BLUE}=== Prerequisites ===${NC}"
check "Node.js installation" "command -v node"
check "npm installation" "command -v npm"
check "Node.js version (>=14)" "node -p 'process.versions.node.split(\".\")[0] >= 14'"
echo ""

# Directory structure
echo -e "${BLUE}=== Directory Structure ===${NC}"
check "Backend directory" "[ -d backend ]"
check "Frontend directory" "[ -d frontend ]"
check "Backend routes" "[ -d backend/routes ]"
check "Backend middleware" "[ -d backend/middleware ]"
check "Backend services" "[ -d backend/services ]"
check "Frontend src" "[ -d frontend/src ]"
echo ""

# Configuration files
echo -e "${BLUE}=== Configuration Files ===${NC}"
check "Backend package.json" "[ -f backend/package.json ]"
check "Frontend package.json" "[ -f frontend/package.json ]"
check "Backend .env.example" "[ -f backend/.env.example ]"
check "Frontend .env.example" "[ -f frontend/.env.example ]"
check "Quickstart script" "[ -f quickstart.sh ]"
check "Quickstart executable" "[ -x quickstart.sh ]"
echo ""

# Core files
echo -e "${BLUE}=== Core Backend Files ===${NC}"
check "server.js" "[ -f backend/server.js ]"
check "database.js" "[ -f backend/database.js ]"
check "database-pg.js" "[ -f backend/database-pg.js ]"
echo ""

# Backend routes
echo -e "${BLUE}=== Backend Routes ===${NC}"
ROUTES=(attacks auth config dashboard logs results security system targets webhooks wordlists)
for route in "${ROUTES[@]}"; do
    check "routes/$route.js" "[ -f backend/routes/$route.js ]"
done
echo ""

# Middleware
echo -e "${BLUE}=== Middleware ===${NC}"
MIDDLEWARE=(auth rbac waf)
for mw in "${MIDDLEWARE[@]}"; do
    check "middleware/$mw.js" "[ -f backend/middleware/$mw.js ]"
done
echo ""

# Services
echo -e "${BLUE}=== Services ===${NC}"
SERVICES=(encryption protocolEnforcement attackService)
for service in "${SERVICES[@]}"; do
    check "services/$service.js" "[ -f backend/services/$service.js ]"
done
echo ""

# Frontend files
echo -e "${BLUE}=== Frontend Files ===${NC}"
check "App.js" "[ -f frontend/src/App.js ]"
check "index.js" "[ -f frontend/src/index.js ]"
check "API service" "[ -f frontend/src/services/api.js ]"
check "AuthContext" "[ -f frontend/src/contexts/AuthContext.js ]"
echo ""

# JavaScript syntax validation
echo -e "${BLUE}=== JavaScript Syntax Validation ===${NC}"

# Backend files
for file in backend/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        check "Syntax: $filename" "node --check $file"
    fi
done

# Backend routes
for file in backend/routes/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        check "Syntax: routes/$filename" "node --check $file"
    fi
done

# Backend middleware
for file in backend/middleware/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        check "Syntax: middleware/$filename" "node --check $file"
    fi
done

# Backend services
for file in backend/services/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        check "Syntax: services/$filename" "node --check $file"
    fi
done

# Frontend files
for file in $(find frontend/src -name "*.js" -type f 2>/dev/null || echo ""); do
    if [ -f "$file" ]; then
        filename=$(echo "$file" | sed 's|frontend/src/||')
        check "Syntax: frontend/$filename" "node --check $file"
    fi
done

echo ""

# Documentation
echo -e "${BLUE}=== Documentation ===${NC}"
DOCS=(GETTING_STARTED.md API_DOCUMENTATION.md SECURITY_PROTOCOLS.md ONBOARDING_TUTORIAL.md POSTGRESQL_SETUP.md DEPLOYMENT_GUIDE.md)
for doc in "${DOCS[@]}"; do
    check "$doc" "[ -f $doc ]"
done
echo ""

# Menu Items Mapping
echo -e "${BLUE}=== Menu Items to API Mapping ===${NC}"
echo "Menu 1: SSH Attack          → POST /api/attacks (type: ssh)"
echo "Menu 2: FTP Attack          → POST /api/attacks (type: ftp)"
echo "Menu 3: Web Attack          → POST /api/attacks (type: http)"
echo "Menu 4: RDP Attack          → POST /api/attacks (type: rdp)"
echo "Menu 5: MySQL Attack        → POST /api/attacks (type: mysql)"
echo "Menu 6: PostgreSQL Attack   → POST /api/attacks (type: postgres)"
echo "Menu 7: SMB Attack          → POST /api/attacks (type: smb)"
echo "Menu 8: Auto Attack         → POST /api/attacks (type: auto)"
echo "Menu 9: Download Wordlists  → POST /api/wordlists/scan"
echo "Menu 11: Scan Target        → POST /api/targets"
echo "Menu 12: View Results       → GET /api/results"
echo "Menu 13: View Config        → GET /api/config"
echo "Menu 14: View Logs          → GET /api/logs"
echo "Menu 15: Export Results     → GET /api/results/export"
echo "Menu 16: Update System      → GET/POST /api/system/update/*"
echo "Menu 17: Help               → GET /api/system/help"
echo "Menu 18: About              → GET /api/system/about"
echo ""

# Summary
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   📊 VALIDATION SUMMARY                                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Checks:  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:        $PASSED_CHECKS${NC}"
if [ $FAILED_CHECKS -gt 0 ]; then
    echo -e "${RED}Failed:        $FAILED_CHECKS${NC}"
else
    echo -e "${GREEN}Failed:        $FAILED_CHECKS${NC}"
fi
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ ALL CHECKS PASSED - PLATFORM READY FOR DEPLOYMENT       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ❌ SOME CHECKS FAILED - PLEASE FIX ISSUES ABOVE            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
