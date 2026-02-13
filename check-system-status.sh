#!/bin/bash
# System Status Check Script
# Verifies all components of Hydra-Termux are properly configured

# Don't exit on errors - we want to complete all checks
set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Hydra-Termux System Status Check              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNING_CHECKS++))
    ((TOTAL_CHECKS++))
}

section_header() {
    echo ""
    echo -e "${BLUE}═══ $1 ═══${NC}"
}

# Check 1: Core Files
section_header "Core Files"

if [ -f "hydra.sh" ]; then
    check_pass "hydra.sh exists"
else
    check_fail "hydra.sh missing"
fi

if [ -f "install.sh" ]; then
    check_pass "install.sh exists"
else
    check_fail "install.sh missing"
fi

if [ -d "scripts" ]; then
    script_count=$(find scripts -name "*.sh" | wc -l)
    check_pass "scripts directory exists ($script_count scripts)"
else
    check_fail "scripts directory missing"
fi

if [ -d "config" ]; then
    check_pass "config directory exists"
else
    check_fail "config directory missing"
fi

# Check 2: Full-Stack Application
section_header "Full-Stack Application"

if [ -d "fullstack-app/backend" ]; then
    check_pass "Backend directory exists"
    
    if [ -f "fullstack-app/backend/server.js" ]; then
        check_pass "Backend server.js exists"
    else
        check_fail "Backend server.js missing"
    fi
    
    if [ -f "fullstack-app/backend/package.json" ]; then
        check_pass "Backend package.json exists"
        
        if [ -d "fullstack-app/backend/node_modules" ]; then
            check_pass "Backend dependencies installed"
        else
            check_warn "Backend dependencies not installed (run: npm install)"
        fi
    else
        check_fail "Backend package.json missing"
    fi
else
    check_fail "Backend directory missing"
fi

if [ -d "fullstack-app/frontend" ]; then
    check_pass "Frontend directory exists"
    
    if [ -d "fullstack-app/frontend/src" ]; then
        check_pass "Frontend source directory exists"
    else
        check_fail "Frontend src directory missing"
    fi
    
    if [ -f "fullstack-app/frontend/package.json" ]; then
        check_pass "Frontend package.json exists"
        
        if [ -d "fullstack-app/frontend/node_modules" ]; then
            check_pass "Frontend dependencies installed"
        else
            check_warn "Frontend dependencies not installed (run: npm install)"
        fi
    else
        check_fail "Frontend package.json missing"
    fi
else
    check_fail "Frontend directory missing"
fi

# Check 3: Database Schema
section_header "Database Schema"

if [ -d "fullstack-app/backend/schema" ]; then
    check_pass "Schema directory exists"
    
    if [ -f "fullstack-app/backend/schema/complete-database-schema.sql" ]; then
        check_pass "Complete schema file exists"
    else
        check_fail "Complete schema file missing"
    fi
    
    if [ -f "fullstack-app/backend/schema/optimization-enhancements.sql" ]; then
        check_pass "Optimization enhancements schema exists"
    else
        check_warn "Optimization enhancements schema missing"
    fi
else
    check_fail "Schema directory missing"
fi

# Check 4: Supabase Edge Functions
section_header "Supabase Edge Functions"

if [ -d "fullstack-app/supabase/functions" ]; then
    check_pass "Edge functions directory exists"
    
    if [ -d "fullstack-app/supabase/functions/attack-webhook" ]; then
        check_pass "attack-webhook function exists"
    else
        check_fail "attack-webhook function missing"
    fi
    
    if [ -d "fullstack-app/supabase/functions/cleanup-sessions" ]; then
        check_pass "cleanup-sessions function exists"
    else
        check_fail "cleanup-sessions function missing"
    fi
    
    if [ -d "fullstack-app/supabase/functions/send-notification" ]; then
        check_pass "send-notification function exists"
    else
        check_fail "send-notification function missing"
    fi
else
    check_fail "Edge functions directory missing"
fi

# Check 5: API Routes
section_header "API Routes"

if [ -d "fullstack-app/backend/routes" ]; then
    route_count=$(find fullstack-app/backend/routes -name "*.js" | wc -l)
    check_pass "Routes directory exists ($route_count routes)"
    
    required_routes=("auth.js" "attacks.js" "targets.js" "results.js" "webhooks.js" "wordlists.js")
    for route in "${required_routes[@]}"; do
        if [ -f "fullstack-app/backend/routes/$route" ]; then
            check_pass "Route $route exists"
        else
            check_fail "Route $route missing"
        fi
    done
else
    check_fail "Routes directory missing"
fi

# Check 6: Documentation
section_header "Documentation"

required_docs=(
    "README.md"
    "fullstack-app/README.md"
    "fullstack-app/API_DOCUMENTATION.md"
    "fullstack-app/SUPABASE_SETUP.md"
    "fullstack-app/DEPLOYMENT_GUIDE.md"
    "fullstack-app/COMPLETE_DEPLOYMENT_GUIDE.md"
)

for doc in "${required_docs[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "Documentation: $(basename "$doc")"
    else
        check_warn "Documentation missing: $doc"
    fi
done

# Check 7: GitHub Workflows
section_header "GitHub Workflows"

if [ -d ".github/workflows" ]; then
    workflow_count=$(find .github/workflows -name "*.yml" | wc -l)
    check_pass "Workflows directory exists ($workflow_count workflows)"
    
    if [ -f ".github/workflows/ci.yml" ]; then
        check_pass "CI workflow exists"
    else
        check_fail "CI workflow missing"
    fi
    
    if [ -f ".github/workflows/security.yml" ]; then
        check_pass "Security workflow exists"
    else
        check_fail "Security workflow missing"
    fi
    
    if [ -f ".github/workflows/deploy.yml" ]; then
        check_pass "Deploy workflow exists"
    else
        check_fail "Deploy workflow missing"
    fi
else
    check_fail "Workflows directory missing"
fi

# Check 8: Environment Configuration
section_header "Environment Configuration"

if [ -f "fullstack-app/backend/.env.example" ]; then
    check_pass "Backend .env.example exists"
else
    check_warn "Backend .env.example missing"
fi

if [ -f "fullstack-app/frontend/.env.example" ]; then
    check_pass "Frontend .env.example exists"
else
    check_warn "Frontend .env.example missing"
fi

# Check 9: Deployment Scripts
section_header "Deployment Scripts"

if [ -f "fullstack-app/deploy-edge-functions.sh" ]; then
    check_pass "Edge functions deployment script exists"
    if [ -x "fullstack-app/deploy-edge-functions.sh" ]; then
        check_pass "Deploy script is executable"
    else
        check_warn "Deploy script not executable"
    fi
else
    check_fail "Edge functions deployment script missing"
fi

if [ -f "fullstack-app/migrate-database.sh" ]; then
    check_pass "Database migration script exists"
    if [ -x "fullstack-app/migrate-database.sh" ]; then
        check_pass "Migration script is executable"
    else
        check_warn "Migration script not executable"
    fi
else
    check_fail "Database migration script missing"
fi

# Check 10: Node.js Syntax
section_header "JavaScript Syntax Validation"

if command -v node &> /dev/null; then
    check_pass "Node.js is installed"
    
    # Check backend files
    for file in fullstack-app/backend/*.js; do
        if [ -f "$file" ]; then
            if node -c "$file" 2>/dev/null; then
                check_pass "Syntax OK: $(basename "$file")"
            else
                check_fail "Syntax error: $(basename "$file")"
            fi
        fi
    done
else
    check_warn "Node.js not installed - skipping syntax checks"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Summary                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total checks:   $TOTAL_CHECKS"
echo -e "${GREEN}Passed:         $PASSED_CHECKS${NC}"
echo -e "${RED}Failed:         $FAILED_CHECKS${NC}"
echo -e "${YELLOW}Warnings:       $WARNING_CHECKS${NC}"
echo ""

# Calculate percentage
if [ $TOTAL_CHECKS -gt 0 ]; then
    PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo -e "Success rate:   ${PERCENTAGE}%"
    echo ""
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${GREEN}✓ System is in excellent condition!${NC}"
    elif [ $PERCENTAGE -ge 75 ]; then
        echo -e "${YELLOW}⚠ System is functional but needs attention${NC}"
    else
        echo -e "${RED}✗ System has significant issues${NC}"
    fi
fi

echo ""
echo "For more details, see:"
echo "  - fullstack-app/COMPLETE_DEPLOYMENT_GUIDE.md"
echo "  - fullstack-app/API_DOCUMENTATION.md"
echo "  - README.md"
echo ""

# Exit with appropriate code
if [ $FAILED_CHECKS -gt 0 ]; then
    exit 1
else
    exit 0
fi
