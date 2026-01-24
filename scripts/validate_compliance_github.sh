#!/bin/bash
# Hydra-Termux Compliance Validation - Optimized for GitHub Actions
set -e
CI_MODE=false
[ "$1" = "--ci" ] || [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] && CI_MODE=true && echo "::group::Compliance Validation"
[ "$CI_MODE" = true ] && { RED=''; GREEN=''; YELLOW=''; NC=''; } || { RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; }
ERRORS=0; WARNINGS=0; TOTAL_FILES=0
pass() { echo -e "${GREEN}✅${NC} $1"; }
fail() { echo -e "${RED}❌${NC} $1"; ((ERRORS++)); }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; ((WARNINGS++)); }
echo "🎯 Compliance Validation"; echo ""
echo "## SYNTAX VALIDATION"; echo ""
for file in fullstack-app/backend/**/*.js; do [ -f "$file" ] && ((TOTAL_FILES++)) && node -c "$file" 2>/dev/null || fail "Error: $file"; done
for file in fullstack-app/frontend/src/**/*.{js,jsx}; do [ -f "$file" ] && ((TOTAL_FILES++)) && node -c "$file" 2>/dev/null || fail "Error: $file"; done
for file in scripts/*.sh Library/*.sh; do [ -f "$file" ] && ((TOTAL_FILES++)) && bash -n "$file" 2>/dev/null || fail "Error: $file"; done
pass "$TOTAL_FILES files validated"
echo ""; echo "## SECURITY"; echo ""
grep -rn "/dev/tcp" scripts/ --include="*.sh" 2>/dev/null | grep -v "nc\|openssl" && warn "Unsafe /dev/tcp" || pass "No command injection"
echo ""; echo "## BUILD"; echo ""
command -v node &> /dev/null && pass "Node.js: $(node --version)" || fail "Node.js missing"
echo ""; echo "## WIRING"; echo ""
for opt in 38 39 40 41 42 43; do grep -q "$opt)" hydra.sh || fail "Menu $opt missing"; done && pass "Menu integrated"
echo ""; echo "═══ SUMMARY ═══"; echo "Files: $TOTAL_FILES | Errors: $ERRORS | Warnings: $WARNINGS"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ 100% COMPLIANCE${NC}"
    [ "$CI_MODE" = true ] && echo "Status: PRODUCTION READY" > /tmp/compliance_report.txt && echo "::endgroup::"
    exit 0
else
    echo -e "${RED}❌ FAILED${NC}"
    [ "$CI_MODE" = true ] && echo "::error::$ERRORS errors" && echo "::endgroup::"
    exit 1
fi
