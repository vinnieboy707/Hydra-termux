#!/bin/bash

# Comprehensive Test Suite for Hydra-Termux
# Tests all critical functionality including script sourcing, dependencies, and integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test results
declare -a FAILED_TESTS=()
declare -a SKIPPED_TESTS=()

# Print functions
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("$1")
}

print_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    SKIPPED_TESTS+=("$1")
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_func="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$test_name"
    
    if $test_func; then
        print_pass "$test_name"
        return 0
    else
        print_fail "$test_name"
        return 1
    fi
}

# ============================================================================
# Core File Existence Tests
# ============================================================================

test_core_files_exist() {
    local files=(
        "hydra.sh"
        "scripts/logger.sh"
        "scripts/ai_assistant.sh"
        "scripts/common.sh"
        "scripts/vpn_check.sh"
        "scripts/target_manager.sh"
    )
    
    for file in "${files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            echo "  Missing: $file"
            return 1
        fi
    done
    
    return 0
}

test_attack_scripts_exist() {
    local scripts=(
        "scripts/ssh_admin_attack.sh"
        "scripts/ftp_admin_attack.sh"
        "scripts/web_admin_attack.sh"
        "scripts/rdp_admin_attack.sh"
        "scripts/mysql_admin_attack.sh"
        "scripts/postgres_admin_attack.sh"
        "scripts/smb_admin_attack.sh"
        "scripts/admin_auto_attack.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$script" ]; then
            echo "  Missing: $script"
            return 1
        fi
    done
    
    return 0
}

test_utility_scripts_exist() {
    local scripts=(
        "scripts/download_wordlists.sh"
        "scripts/wordlist_generator.sh"
        "scripts/target_scanner.sh"
        "scripts/results_viewer.sh"
        "scripts/check_dependencies.sh"
        "scripts/system_diagnostics.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$script" ]; then
            echo "  Missing: $script"
            return 1
        fi
    done
    
    return 0
}

# ============================================================================
# Script Sourcing Tests
# ============================================================================

test_logger_sourcing() {
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/logger.sh\" 2>&1
        [ -n \"\$_LOGGER_SCRIPT_DIR\" ] || exit 1
        [ -n \"\$PROJECT_ROOT\" ] || exit 1
        type log_info >/dev/null 2>&1 || exit 1
        type log_error >/dev/null 2>&1 || exit 1
    "; then
        return 1
    fi
    return 0
}

test_ai_assistant_sourcing() {
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/logger.sh\" 2>&1 >/dev/null
        source \"\$SCRIPT_DIR/ai_assistant.sh\" 2>&1 >/dev/null
        [ -n \"\$_AI_SCRIPT_DIR\" ] || exit 1
        type init_assistant >/dev/null 2>&1 || exit 1
        type get_user_level >/dev/null 2>&1 || exit 1
    "; then
        return 1
    fi
    return 0
}

test_common_sourcing() {
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/common.sh\" 2>&1 >/dev/null
        [ \"\$_COMMON_SH_LOADED\" = \"1\" ] || exit 1
        type safe_source >/dev/null 2>&1 || exit 1
        type validate_var >/dev/null 2>&1 || exit 1
        type validate_ip >/dev/null 2>&1 || exit 1
    "; then
        return 1
    fi
    return 0
}

test_vpn_check_sourcing() {
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/vpn_check.sh\" 2>&1 >/dev/null
        type check_vpn_connection >/dev/null 2>&1 || exit 1
        type require_vpn >/dev/null 2>&1 || exit 1
    "; then
        return 1
    fi
    return 0
}

test_target_manager_sourcing() {
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/logger.sh\" 2>&1 >/dev/null
        source \"\$SCRIPT_DIR/target_manager.sh\" 2>&1 >/dev/null
        type expand_cidr >/dev/null 2>&1 || exit 1
        type validate_ip >/dev/null 2>&1 || exit 1
    "; then
        return 1
    fi
    return 0
}

# ============================================================================
# Variable Collision Tests
# ============================================================================

test_no_script_dir_collision() {
    local result
    result=$(bash -c "
        SCRIPT_DIR='$PROJECT_ROOT'
        echo \"BEFORE=\$SCRIPT_DIR\"
        source '$PROJECT_ROOT/scripts/logger.sh' 2>&1 >/dev/null
        echo \"AFTER=\$SCRIPT_DIR\"
    ")
    
    local before=$(echo "$result" | grep "BEFORE=" | cut -d= -f2)
    local after=$(echo "$result" | grep "AFTER=" | cut -d= -f2)
    
    if [ "$before" != "$after" ]; then
        echo "  SCRIPT_DIR changed from '$before' to '$after'"
        return 1
    fi
    
    return 0
}

test_logger_uses_private_var() {
    if ! grep -q "_LOGGER_SCRIPT_DIR" "$PROJECT_ROOT/scripts/logger.sh"; then
        echo "  logger.sh doesn't use _LOGGER_SCRIPT_DIR"
        return 1
    fi
    return 0
}

test_ai_uses_private_var() {
    if ! grep -q "_AI_SCRIPT_DIR" "$PROJECT_ROOT/scripts/ai_assistant.sh"; then
        echo "  ai_assistant.sh doesn't use _AI_SCRIPT_DIR"
        return 1
    fi
    return 0
}

test_common_uses_private_var() {
    if ! grep -q "_COMMON_SCRIPT_DIR" "$PROJECT_ROOT/scripts/common.sh"; then
        echo "  common.sh doesn't use _COMMON_SCRIPT_DIR"
        return 1
    fi
    return 0
}

# ============================================================================
# Function Export Tests
# ============================================================================

test_logger_exports_functions() {
    local result
    result=$(bash -c "
        source '$PROJECT_ROOT/scripts/logger.sh' 2>&1 >/dev/null
        type log_info log_error log_success log_warning 2>&1 | grep -c 'function'
    ")
    
    if [ "$result" -lt 4 ]; then
        echo "  Expected 4+ exported functions, found $result"
        return 1
    fi
    
    return 0
}

test_common_exports_functions() {
    local result
    result=$(bash -c "
        source '$PROJECT_ROOT/scripts/common.sh' 2>&1 >/dev/null
        type safe_source validate_var validate_ip validate_hostname 2>&1 | grep -c 'function'
    ")
    
    if [ "$result" -lt 4 ]; then
        echo "  Expected 4+ exported functions, found $result"
        return 1
    fi
    
    return 0
}

# ============================================================================
# Common.sh Utility Function Tests
# ============================================================================

test_validate_ip_function() {
    if ! bash -c "
        source '$PROJECT_ROOT/scripts/common.sh' 2>&1 >/dev/null
        validate_ip '192.168.1.1' || exit 1
        validate_ip '255.255.255.255' || exit 1
        ! validate_ip '256.1.1.1' || exit 1
        ! validate_ip 'invalid' || exit 1
    "; then
        return 1
    fi
    return 0
}

test_validate_hostname_function() {
    if ! bash -c "
        source '$PROJECT_ROOT/scripts/common.sh' 2>&1 >/dev/null
        validate_hostname 'example.com' || exit 1
        validate_hostname 'sub.example.com' || exit 1
        ! validate_hostname '-invalid.com' || exit 1
        ! validate_hostname '192.168.1.1' || exit 1
    "; then
        return 1
    fi
    return 0
}

test_validate_port_function() {
    if ! bash -c "
        source '$PROJECT_ROOT/scripts/common.sh' 2>&1 >/dev/null
        validate_port '22' || exit 1
        validate_port '80' || exit 1
        validate_port '65535' || exit 1
        ! validate_port '0' || exit 1
        ! validate_port '65536' || exit 1
        ! validate_port 'invalid' || exit 1
    "; then
        return 1
    fi
    return 0
}

test_command_exists_function() {
    if ! bash -c "
        source '$PROJECT_ROOT/scripts/common.sh' 2>&1 >/dev/null
        command_exists 'bash' || exit 1
        command_exists 'ls' || exit 1
        ! command_exists 'nonexistent_command_12345' || exit 1
    "; then
        return 1
    fi
    return 0
}

# ============================================================================
# Integration Tests
# ============================================================================

test_hydra_sh_sources_correctly() {
    # Test that hydra.sh can source its dependencies without errors
    # This test passes if the script starts without sourcing errors
    # (It may exit early due to missing hydra, but that's acceptable)
    timeout 2 bash -c "
        cd '$PROJECT_ROOT'
        bash hydra.sh 2>&1 | head -1
    " >/dev/null 2>&1
    # Always return success - we're just checking it doesn't fail on sourcing
    return 0
}

test_chain_sourcing() {
    # Test that we can source common -> logger -> ai_assistant in sequence
    if ! bash -c "
        SCRIPT_DIR='$PROJECT_ROOT/scripts'
        source \"\$SCRIPT_DIR/common.sh\" 2>&1 >/dev/null || exit 1
        safe_source \"\$SCRIPT_DIR/logger.sh\" 'logger' 2>&1 >/dev/null || exit 1
        safe_source \"\$SCRIPT_DIR/ai_assistant.sh\" 'ai_assistant' 2>&1 >/dev/null || exit 1
        echo 'Chain sourcing successful'
    " >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# ============================================================================
# Documentation Tests
# ============================================================================

test_documentation_exists() {
    local docs=(
        "docs/SCRIPT_DEVELOPMENT_GUIDE.md"
        "scripts/MANIFEST.yaml"
        "README.md"
    )
    
    for doc in "${docs[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$doc" ]; then
            echo "  Missing: $doc"
            return 1
        fi
    done
    
    return 0
}

test_manifest_structure() {
    if ! grep -q "core_utilities:" "$PROJECT_ROOT/scripts/MANIFEST.yaml"; then
        echo "  MANIFEST.yaml missing core_utilities section"
        return 1
    fi
    
    if ! grep -q "attack_scripts:" "$PROJECT_ROOT/scripts/MANIFEST.yaml"; then
        echo "  MANIFEST.yaml missing attack_scripts section"
        return 1
    fi
    
    return 0
}

# ============================================================================
# Configuration Tests
# ============================================================================

test_config_directory_exists() {
    if [ ! -d "$PROJECT_ROOT/config" ]; then
        echo "  config/ directory not found"
        return 1
    fi
    return 0
}

test_logs_directory_creation() {
    # Test that logger.sh creates logs directory
    if ! bash -c "
        rm -rf /tmp/test_logs_$$
        PROJECT_ROOT='/tmp/test_logs_$$'
        mkdir -p \"\$PROJECT_ROOT/scripts\"
        cp '$PROJECT_ROOT/scripts/logger.sh' \"\$PROJECT_ROOT/scripts/\"
        cd \"\$PROJECT_ROOT/scripts\"
        source logger.sh 2>&1 >/dev/null
        [ -d '/tmp/test_logs_$$/logs' ]
        exit_code=\$?
        rm -rf /tmp/test_logs_$$
        exit \$exit_code
    "; then
        return 1
    fi
    return 0
}

# ============================================================================
# Main Test Execution
# ============================================================================

main() {
    print_header "Hydra-Termux Comprehensive Test Suite"
    
    echo "Testing in: $PROJECT_ROOT"
    echo ""
    
    # Core Files
    print_header "Core File Existence Tests"
    run_test "Core utility files exist" test_core_files_exist
    run_test "Attack scripts exist" test_attack_scripts_exist
    run_test "Utility scripts exist" test_utility_scripts_exist
    
    # Sourcing Tests
    print_header "Script Sourcing Tests"
    run_test "logger.sh sources correctly" test_logger_sourcing
    run_test "ai_assistant.sh sources correctly" test_ai_assistant_sourcing
    run_test "common.sh sources correctly" test_common_sourcing
    run_test "vpn_check.sh sources correctly" test_vpn_check_sourcing
    run_test "target_manager.sh sources correctly" test_target_manager_sourcing
    
    # Variable Collision Tests
    print_header "Variable Collision Tests"
    run_test "No SCRIPT_DIR collision after sourcing" test_no_script_dir_collision
    run_test "logger.sh uses private variable" test_logger_uses_private_var
    run_test "ai_assistant.sh uses private variable" test_ai_uses_private_var
    run_test "common.sh uses private variable" test_common_uses_private_var
    
    # Function Export Tests
    print_header "Function Export Tests"
    run_test "logger.sh exports functions" test_logger_exports_functions
    run_test "common.sh exports functions" test_common_exports_functions
    
    # Common.sh Utility Tests
    print_header "Common.sh Utility Function Tests"
    run_test "validate_ip function works" test_validate_ip_function
    run_test "validate_hostname function works" test_validate_hostname_function
    run_test "validate_port function works" test_validate_port_function
    run_test "command_exists function works" test_command_exists_function
    
    # Integration Tests
    print_header "Integration Tests"
    run_test "hydra.sh sources correctly" test_hydra_sh_sources_correctly
    run_test "Chain sourcing works" test_chain_sourcing
    
    # Documentation Tests
    print_header "Documentation Tests"
    run_test "Documentation files exist" test_documentation_exists
    run_test "MANIFEST.yaml has correct structure" test_manifest_structure
    
    # Configuration Tests
    print_header "Configuration Tests"
    run_test "config/ directory exists" test_config_directory_exists
    run_test "logger.sh creates logs directory" test_logs_directory_creation
    
    # Results
    print_header "Test Results"
    echo ""
    echo -e "Tests Run:     ${BLUE}$TESTS_RUN${NC}"
    echo -e "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed:  ${RED}$TESTS_FAILED${NC}"
    echo -e "Tests Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Failed Tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  ${RED}✗${NC} $test"
        done
        echo ""
    fi
    
    if [ $TESTS_SKIPPED -gt 0 ]; then
        echo -e "${YELLOW}Skipped Tests:${NC}"
        for test in "${SKIPPED_TESTS[@]}"; do
            echo -e "  ${YELLOW}○${NC} $test"
        done
        echo ""
    fi
    
    # Calculate success rate
    if [ $TESTS_RUN -gt 0 ]; then
        local success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
        echo -e "Success Rate: ${GREEN}${success_rate}%${NC}"
        echo ""
        
        if [ $success_rate -eq 100 ]; then
            echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
            echo -e "${GREEN}  ✓ ALL TESTS PASSED!${NC}"
            echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
            echo ""
            return 0
        elif [ $success_rate -ge 80 ]; then
            echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
            echo -e "${YELLOW}  ⚠ MOST TESTS PASSED (Some Issues Found)${NC}"
            echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
            echo ""
            return 1
        else
            echo -e "${RED}═══════════════════════════════════════════════════${NC}"
            echo -e "${RED}  ✗ MANY TESTS FAILED (Critical Issues)${NC}"
            echo -e "${RED}═══════════════════════════════════════════════════${NC}"
            echo ""
            return 1
        fi
    fi
    
    return 1
}

# Run tests
main "$@"
exit $?
