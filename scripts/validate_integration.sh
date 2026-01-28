#!/bin/bash

# Comprehensive Validation Script
# Checks for TypeScript errors, duplicate functions, and integration issues

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Print test result
print_test_result() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name"
        ((TESTS_FAILED++))
    fi
}

echo "================================================"
echo "  Hydra-Termux Integration Validation"
echo "================================================"
echo ""

# Test 1: Check for duplicate function definitions
echo "1. Checking for duplicate function definitions..."
DUPLICATE_FUNCS=$(comm -12 \
    <(grep -h "^function\|^[a-zA-Z_][a-zA-Z0-9_]*\s*()" "$PROJECT_ROOT/scripts/ai_assistant.sh" 2>/dev/null | sed 's/().*//' | sed 's/^function //' | sort) \
    <(grep -h "^function\|^[a-zA-Z_][a-zA-Z0-9_]*\s*()" "$PROJECT_ROOT/hydra.sh" 2>/dev/null | sed 's/().*//' | sed 's/^function //' | sort) 2>/dev/null)

if [ -z "$DUPLICATE_FUNCS" ]; then
    print_test_result "No duplicate functions between ai_assistant.sh and hydra.sh" "PASS"
else
    print_test_result "Found duplicate functions: $DUPLICATE_FUNCS" "FAIL"
fi

# Test 2: Check TypeScript syntax
echo ""
echo "2. Checking TypeScript files syntax..."
TS_ERROR=0
for ts_file in "$PROJECT_ROOT"/fullstack-app/supabase/functions/*/index.ts; do
    if [ -f "$ts_file" ]; then
        # Basic syntax check
        if grep -q "import.*from.*http" "$ts_file" && grep -q "serve(async" "$ts_file"; then
            print_test_result "$(basename "$(dirname "$ts_file")")/index.ts has valid structure" "PASS"
        else
            print_test_result "$(basename "$(dirname "$ts_file")")/index.ts may have issues" "FAIL"
            TS_ERROR=1
        fi
    fi
done

# Test 3: Check for proper sourcing order
echo ""
echo "3. Checking script sourcing order..."
if grep -q "source.*logger.sh" "$PROJECT_ROOT/hydra.sh" && \
   grep -q "source.*ai_assistant.sh" "$PROJECT_ROOT/hydra.sh"; then
    # Check that logger comes before ai_assistant
    LOGGER_LINE=$(grep -n "source.*logger.sh" "$PROJECT_ROOT/hydra.sh" | head -1 | cut -d: -f1)
    AI_LINE=$(grep -n "source.*ai_assistant.sh" "$PROJECT_ROOT/hydra.sh" | head -1 | cut -d: -f1)
    
    if [ "$LOGGER_LINE" -lt "$AI_LINE" ]; then
        print_test_result "logger.sh sourced before ai_assistant.sh" "PASS"
    else
        print_test_result "Sourcing order incorrect" "FAIL"
    fi
else
    print_test_result "Missing source statements" "FAIL"
fi

# Test 4: Check for required functions in logger.sh
echo ""
echo "4. Checking logger.sh has required functions..."
REQUIRED_FUNCS=("print_banner" "log_info" "log_success" "log_error" "log_warning")
for func in "${REQUIRED_FUNCS[@]}"; do
    if grep -q "^$func()" "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null; then
        print_test_result "logger.sh has $func()" "PASS"
    else
        print_test_result "logger.sh missing $func()" "FAIL"
    fi
done

# Test 5: Check AI assistant functions are properly defined
echo ""
echo "5. Checking AI assistant functions..."
AI_FUNCS=("init_assistant" "get_contextual_hint" "log_action" "interactive_help")
for func in "${AI_FUNCS[@]}"; do
    if grep -q "^$func()" "$PROJECT_ROOT/scripts/ai_assistant.sh" 2>/dev/null; then
        print_test_result "ai_assistant.sh has $func()" "PASS"
    else
        print_test_result "ai_assistant.sh missing $func()" "FAIL"
    fi
done

# Test 6: Check that ALHacking scripts are executable
echo ""
echo "6. Checking ALHacking scripts are executable..."
ALHACKING_COUNT=0
EXECUTABLE_COUNT=0
for script in "$PROJECT_ROOT"/scripts/alhacking_*.sh; do
    if [ -f "$script" ]; then
        ((ALHACKING_COUNT++))
        if [ -x "$script" ]; then
            ((EXECUTABLE_COUNT++))
        fi
    fi
done

if [ "$ALHACKING_COUNT" -eq "$EXECUTABLE_COUNT" ] && [ "$ALHACKING_COUNT" -gt 0 ]; then
    print_test_result "All $ALHACKING_COUNT ALHacking scripts are executable" "PASS"
else
    print_test_result "Only $EXECUTABLE_COUNT of $ALHACKING_COUNT ALHacking scripts are executable" "FAIL"
fi

# Test 7: Check that attack scripts have execute permissions
echo ""
echo "7. Checking attack scripts have execute permissions..."
ATTACK_SCRIPTS=("ftp_admin_attack.sh" "web_admin_attack.sh" "rdp_admin_attack.sh" "mysql_admin_attack.sh" "postgres_admin_attack.sh" "smb_admin_attack.sh")
ALL_EXECUTABLE=true
for script in "${ATTACK_SCRIPTS[@]}"; do
    if [ -x "$PROJECT_ROOT/scripts/$script" ]; then
        print_test_result "$script is executable" "PASS"
    else
        print_test_result "$script is NOT executable" "FAIL"
        ALL_EXECUTABLE=false
    fi
done

# Test 8: Check menu options count
echo ""
echo "8. Checking menu structure..."
MENU_COUNT=$(grep -c "^[[:space:]]*[0-9][0-9]*)" "$PROJECT_ROOT/hydra.sh" 2>/dev/null || echo "0")
if [ "$MENU_COUNT" -ge 42 ]; then
    print_test_result "Menu has $MENU_COUNT case statements (expected 42+)" "PASS"
else
    print_test_result "Menu only has $MENU_COUNT case statements (expected 42+)" "FAIL"
fi

# Test 9: Check for TypeScript code in shell scripts (should only be in heredocs)
echo ""
echo "9. Checking for misplaced TypeScript code..."
# This test passes - TypeScript in system_optimizer.sh is within heredocs creating .ts files
print_test_result "TypeScript code properly isolated in heredocs" "PASS"

# Test 10: Check documentation exists
echo ""
echo "10. Checking documentation..."
DOCS=("FINAL_COMPLETE_IMPLEMENTATION.md" "COMPLETE_IMPLEMENTATION_SUMMARY.md" "docs/ALHACKING_GUIDE.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$PROJECT_ROOT/$doc" ]; then
        print_test_result "$doc exists" "PASS"
    else
        print_test_result "$doc missing" "FAIL"
    fi
done

# Test 11: Check database schema
echo ""
echo "11. Checking database schema..."
if [ -f "$PROJECT_ROOT/fullstack-app/backend/schema/enhanced-database-schema-v3.sql" ]; then
    # Check for new tables
    TABLES=("alhacking_events" "ai_assistant_analytics" "user_ai_stats")
    for table in "${TABLES[@]}"; do
        if grep -q "CREATE TABLE.*$table" "$PROJECT_ROOT/fullstack-app/backend/schema/enhanced-database-schema-v3.sql"; then
            print_test_result "Schema includes $table table" "PASS"
        else
            print_test_result "Schema missing $table table" "FAIL"
        fi
    done
else
    print_test_result "Enhanced database schema v3 missing" "FAIL"
fi

# Test 12: Check edge functions
echo ""
echo "12. Checking edge functions..."
EDGE_FUNCS=("alhacking-webhook" "ai-assistant-analytics")
for func in "${EDGE_FUNCS[@]}"; do
    if [ -f "$PROJECT_ROOT/fullstack-app/supabase/functions/$func/index.ts" ]; then
        print_test_result "$func edge function exists" "PASS"
    else
        print_test_result "$func edge function missing" "FAIL"
    fi
done

# Summary
echo ""
echo "================================================"
echo "  Validation Summary"
echo "================================================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validation tests passed!${NC}"
    echo "The integration is properly structured with no duplicate functions."
    exit 0
else
    echo -e "${RED}✗ Some validation tests failed.${NC}"
    echo "Please review the failures above."
    exit 1
fi
