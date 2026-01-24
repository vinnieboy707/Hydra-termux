#!/bin/bash
# 100% Compliance Validation Script
# Hydra-Termux Quality Assurance

set -e

echo "════════════════════════════════════════════════════════════"
echo "  HYDRA-TERMUX 100% COMPLIANCE VALIDATION"
echo "════════════════════════════════════════════════════════════"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((ERRORS++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

echo "1. SYNTAX VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Backend JavaScript
echo -n "  Backend JavaScript files... "
BACKEND_ERRORS=0
for file in fullstack-app/backend/modules/*.js fullstack-app/backend/routes/*.js fullstack-app/backend/services/*.js fullstack-app/backend/middleware/*.js fullstack-app/backend/*.js; do
    if [ -f "$file" ]; then
        if ! node -c "$file" 2>/dev/null; then
            ((BACKEND_ERRORS++))
        fi
    fi
done

if [ $BACKEND_ERRORS -eq 0 ]; then
    pass "All backend files syntax valid"
else
    fail "$BACKEND_ERRORS backend files have syntax errors"
fi

# Frontend JavaScript/JSX
echo -n "  Frontend React files... "
FRONTEND_ERRORS=0
for file in fullstack-app/frontend/src/**/*.js fullstack-app/frontend/src/**/*.jsx; do
    if [ -f "$file" ]; then
        if ! node -c "$file" 2>/dev/null; then
            ((FRONTEND_ERRORS++))
        fi
    fi
done

if [ $FRONTEND_ERRORS -eq 0 ]; then
    pass "All frontend files syntax valid"
else
    fail "$FRONTEND_ERRORS frontend files have syntax errors"
fi

# Bash Scripts
echo -n "  Bash scripts... "
BASH_ERRORS=0
for file in scripts/*.sh Library/*.sh; do
    if [ -f "$file" ]; then
        if ! bash -n "$file" 2>/dev/null; then
            ((BASH_ERRORS++))
        fi
    fi
done

if [ $BASH_ERRORS -eq 0 ]; then
    pass "All bash scripts syntax valid"
else
    fail "$BASH_ERRORS bash scripts have syntax errors"
fi

echo ""
echo "2. SECURITY VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Check for eval usage
echo -n "  Dangerous functions... "
EVAL_COUNT=$(grep -r "eval(" fullstack-app/backend --include="*.js" | grep -v node_modules | wc -l || echo "0")
if [ "$EVAL_COUNT" -eq 0 ]; then
    pass "No dangerous eval() usage"
else
    warn "$EVAL_COUNT eval() usages found (review recommended)"
fi

# Check for hardcoded passwords
echo -n "  Hardcoded secrets... "
SECRET_COUNT=$(grep -r "password.*=.*['\"]" fullstack-app/backend --include="*.js" | grep -v "process.env" | grep -v ".example" | grep -v "//" | wc -l || echo "0")
if [ "$SECRET_COUNT" -eq 0 ]; then
    pass "No hardcoded secrets found"
else
    warn "$SECRET_COUNT potential hardcoded secrets (review recommended)"
fi

# Check for SQL injection patterns
echo -n "  SQL injection risks... "
SQL_INJECT=$(grep -rn "\${" fullstack-app/backend/routes fullstack-app/backend/modules --include="*.js" | grep -E "(query|execute|SELECT|INSERT)" | grep -v "process.env" | wc -l || echo "0")
if [ "$SQL_INJECT" -eq 0 ]; then
    pass "No SQL injection patterns found"
else
    warn "$SQL_INJECT SQL patterns need review"
fi

# Check .env files not committed
echo -n "  Environment files... "
if [ -f "fullstack-app/backend/.env" ] || [ -f "fullstack-app/frontend/.env" ]; then
    warn ".env files exist (ensure they're in .gitignore)"
else
    pass "No .env files committed"
fi

echo ""
echo "3. BUILD VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Check package.json exists
echo -n "  Package files... "
if [ -f "fullstack-app/backend/package.json" ] && [ -f "fullstack-app/frontend/package.json" ]; then
    pass "Package files exist"
else
    fail "Missing package.json files"
fi

# Check for node_modules (should exist for validation but not committed)
echo -n "  Dependencies... "
if [ -d "fullstack-app/backend/node_modules" ]; then
    pass "Backend dependencies installed"
else
    warn "Backend node_modules not found (run npm install)"
fi

if [ -d "fullstack-app/frontend/node_modules" ]; then
    pass "Frontend dependencies installed"
else
    warn "Frontend node_modules not found (run npm install)"
fi

echo ""
echo "4. WIRING VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Check main menu integration
echo -n "  Main menu (hydra.sh)... "
if grep -q "run_email_ip_attack" hydra.sh && grep -q "run_supreme_combo" hydra.sh; then
    pass "Menu functions wired"
else
    fail "Menu functions missing"
fi

# Check frontend routing
echo -n "  Frontend routing... "
if grep -q "EmailIPAttacks" fullstack-app/frontend/src/App.js; then
    pass "EmailIPAttacks route exists"
else
    fail "EmailIPAttacks route missing"
fi

# Check navigation
echo -n "  Navigation menu... "
if grep -q "email-ip-attacks" fullstack-app/frontend/src/components/Layout.js; then
    pass "Navigation item exists"
else
    fail "Navigation item missing"
fi

echo ""
echo "5. CONSISTENCY VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Check for duplicate Dashboard
echo -n "  Duplicate dashboards... "
DASHBOARD_COUNT=$(find fullstack-app/frontend/src/pages -name "*ashboard*.js" | wc -l)
if [ "$DASHBOARD_COUNT" -eq 1 ]; then
    pass "Single Dashboard component"
else
    warn "$DASHBOARD_COUNT Dashboard-like components found"
fi

# Check for duplicate functions
echo -n "  Function naming... "
DUPLICATE_FUNCS=$(grep -rh "^function \|^const .* = " fullstack-app/frontend/src/pages --include="*.js" | sort | uniq -d | wc -l || echo "0")
if [ "$DUPLICATE_FUNCS" -eq 0 ]; then
    pass "No duplicate function names"
else
    warn "$DUPLICATE_FUNCS duplicate function names"
fi

echo ""
echo "6. DOCUMENTATION VALIDATION"
echo "────────────────────────────────────────────────────────────"

# Check for documentation files
DOC_FILES=(
    "docs/ENV_SETUP_GUIDE.md"
    "docs/EMAIL_IP_PENTEST_GUIDE.md"
    "docs/SUPREME_COMBO_SCRIPTS_GUIDE.md"
    "docs/COMPLIANCE_AUDIT.md"
    "fullstack-app/backend/.env.example"
    "fullstack-app/frontend/.env.example"
)

MISSING_DOCS=0
for doc in "${DOC_FILES[@]}"; do
    if [ -f "$doc" ]; then
        pass "$(basename "$doc") exists"
    else
        fail "$(basename "$doc") missing"
        ((MISSING_DOCS++))
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  COMPLIANCE SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 100% COMPLIANCE ACHIEVED${NC}"
    echo ""
    echo "  Errors:   0"
    echo "  Warnings: 0"
    echo ""
    echo "  Status: PRODUCTION READY ✅"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  COMPLIANCE WITH WARNINGS${NC}"
    echo ""
    echo "  Errors:   0"
    echo "  Warnings: $WARNINGS"
    echo ""
    echo "  Status: Review warnings before production"
    exit 0
else
    echo -e "${RED}❌ COMPLIANCE FAILED${NC}"
    echo ""
    echo "  Errors:   $ERRORS"
    echo "  Warnings: $WARNINGS"
    echo ""
    echo "  Status: Fix errors before production"
    exit 1
fi
