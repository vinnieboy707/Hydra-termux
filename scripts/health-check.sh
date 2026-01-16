#!/bin/bash
# ============================================================================
# Hydra-Termux Health Check Script
# ============================================================================
# Comprehensive system health check for the fullstack application
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Hydra-Termux Health Check                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

ISSUES_FOUND=0

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    ((ISSUES_FOUND++))
fi

# Check npm
echo -e "${BLUE}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    ((ISSUES_FOUND++))
fi

echo ""

# Check backend dependencies
echo -e "${BLUE}Checking backend dependencies...${NC}"
if [ -d "fullstack-app/backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend node_modules exists"
    
    # Check for bcryptjs specifically
    if [ -d "fullstack-app/backend/node_modules/bcryptjs" ]; then
        echo -e "${GREEN}✓${NC} bcryptjs is installed"
    else
        echo -e "${YELLOW}⚠${NC} bcryptjs not found in node_modules"
        ((ISSUES_FOUND++))
    fi
    
    # Check for bcrypt (should NOT exist)
    if [ -d "fullstack-app/backend/node_modules/bcrypt" ]; then
        echo -e "${YELLOW}⚠${NC} native bcrypt found (should use bcryptjs)"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${RED}✗${NC} Backend node_modules not found"
    ((ISSUES_FOUND++))
fi

# Check frontend dependencies
echo -e "${BLUE}Checking frontend dependencies...${NC}"
if [ -d "fullstack-app/frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend node_modules exists"
else
    echo -e "${RED}✗${NC} Frontend node_modules not found"
    ((ISSUES_FOUND++))
fi

echo ""

# Check configuration files
echo -e "${BLUE}Checking configuration files...${NC}"
if [ -f "fullstack-app/backend/.env" ]; then
    echo -e "${GREEN}✓${NC} Backend .env exists"
else
    echo -e "${YELLOW}⚠${NC} Backend .env not found"
    ((ISSUES_FOUND++))
fi

if [ -f "fullstack-app/frontend/.env" ]; then
    echo -e "${GREEN}✓${NC} Frontend .env exists"
else
    echo -e "${YELLOW}⚠${NC} Frontend .env not found (optional)"
fi

echo ""

# Check ports
echo -e "${BLUE}Checking port availability...${NC}"
check_port() {
    local port=$1
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            return 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

if check_port 3000; then
    echo -e "${GREEN}✓${NC} Port 3000 (backend) is available"
else
    echo -e "${YELLOW}⚠${NC} Port 3000 is in use"
fi

if check_port 3001; then
    echo -e "${GREEN}✓${NC} Port 3001 (frontend) is available"
else
    echo -e "${YELLOW}⚠${NC} Port 3001 is in use"
fi

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}║  ✓ All checks passed! System is healthy.                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${YELLOW}║  ⚠ Found $ISSUES_FOUND issue(s). Review above for details.          ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Recommended action:${NC}"
    echo -e "  ${GREEN}npm run fix-termux${NC}  - Run the setup fix script"
    exit 1
fi
