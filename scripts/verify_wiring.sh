#!/bin/bash
# Wiring Verification Script
# Ensures all menu options are correctly wired to their scripts

echo "╔═══════════════════════════════════════════════════════╗"
echo "║         HYDRA-TERMUX WIRING VERIFICATION             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if file exists
check_file() {
    local file="$1"
    local description="$2"
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $description: $file"
        return 0
    else
        echo -e "${RED}❌${NC} $description: $file (MISSING)"
        ((ERRORS++))
        return 1
    fi
}

# Function to check if file is executable
check_executable() {
    local file="$1"
    
    if [ -x "$file" ]; then
        return 0
    else
        echo -e "${YELLOW}⚠️${NC}  Not executable: $file"
        ((WARNINGS++))
        return 1
    fi
}

echo "Checking Core Scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "$SCRIPT_DIR/hydra.sh" "Main Launcher"
check_file "$SCRIPT_DIR/install.sh" "Installation Script"
check_file "$SCRIPT_DIR/scripts/logger.sh" "Logger Module"
check_file "$SCRIPT_DIR/scripts/ai_assistant.sh" "AI Assistant"
echo ""

echo "Checking New Features (Menu 38-43)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "$SCRIPT_DIR/scripts/email_ip_attack.sh" "Option 38: Email & IP Attack"
check_file "$SCRIPT_DIR/Library/combo_supreme_email_web_db.sh" "Option 39: Corporate Stack"
check_file "$SCRIPT_DIR/Library/combo_supreme_cloud_infra.sh" "Option 40: Cloud Infrastructure"
check_file "$SCRIPT_DIR/Library/combo_supreme_network_complete.sh" "Option 41: Complete Network"
check_file "$SCRIPT_DIR/Library/combo_supreme_active_directory.sh" "Option 42: Active Directory"
check_file "$SCRIPT_DIR/Library/combo_supreme_webapp_api.sh" "Option 43: Web Apps & APIs"
echo ""

echo "Checking Quick Start Scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "$SCRIPT_DIR/Library/email_ip_pentest_quick.sh" "Quick Email/IP Script"
check_file "$SCRIPT_DIR/Library/combo_email_domain.sh" "Email Domain Combo"
echo ""

echo "Checking Support Scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "$SCRIPT_DIR/scripts/validate_compliance.sh" "Compliance Validation"
check_file "$SCRIPT_DIR/scripts/fix_hydra_dependencies.sh" "Dependency Fixer"
check_file "$SCRIPT_DIR/scripts/apply_security_patches.sh" "Security Patches"
echo ""

echo "Checking Executability..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for script in "$SCRIPT_DIR/hydra.sh" "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/scripts/email_ip_attack.sh" "$SCRIPT_DIR"/Library/combo_supreme_*.sh; do
    if [ -f "$script" ]; then
        check_executable "$script"
    fi
done
echo ""

echo "Checking Menu Wiring in hydra.sh..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "38)" "$SCRIPT_DIR/hydra.sh" && grep -q "run_email_ip_attack" "$SCRIPT_DIR/hydra.sh"; then
    echo -e "${GREEN}✅${NC} Option 38 wired to run_email_ip_attack"
else
    echo -e "${RED}❌${NC} Option 38 not properly wired"
    ((ERRORS++))
fi

for opt in 39 40 41 42 43; do
    if grep -q "$opt)" "$SCRIPT_DIR/hydra.sh" && grep -q "run_supreme_combo" "$SCRIPT_DIR/hydra.sh"; then
        echo -e "${GREEN}✅${NC} Option $opt wired to run_supreme_combo"
    else
        echo -e "${RED}❌${NC} Option $opt not properly wired"
        ((ERRORS++))
    fi
done
echo ""

echo "Checking Git Bash Compatibility..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for problematic commands
if grep -q "realpath" "$SCRIPT_DIR/hydra.sh"; then
    echo -e "${GREEN}✅${NC} Path resolution with realpath fallback"
else
    echo -e "${YELLOW}⚠️${NC}  No realpath found (may cause issues)"
    ((WARNINGS++))
fi

# Check shebang
if head -1 "$SCRIPT_DIR/hydra.sh" | grep -q "#!/bin/bash"; then
    echo -e "${GREEN}✅${NC} Correct shebang (#!/bin/bash)"
else
    echo -e "${RED}❌${NC} Incorrect shebang"
    ((ERRORS++))
fi

# Check for Windows line endings
if file "$SCRIPT_DIR/hydra.sh" | grep -q "CRLF"; then
    echo -e "${YELLOW}⚠️${NC}  Windows line endings detected (may need dos2unix)"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅${NC} Unix line endings (LF)"
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo "VERIFICATION SUMMARY"
echo "═══════════════════════════════════════════════════════"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL WIRING VERIFIED - SYSTEM READY${NC}"
    exit 0
else
    echo -e "${RED}❌ ERRORS FOUND - PLEASE FIX BEFORE PROCEEDING${NC}"
    exit 1
fi
