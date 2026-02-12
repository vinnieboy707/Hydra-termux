#!/usr/bin/env bash
# Bash Unit Testing Framework
# Provides testing utilities for bash scripts

set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly NC='\033[0m' # No Color

# Test statistics
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
CURRENT_TEST=""

# Initialize test suite
init_test_suite() {
    TESTS_RUN=0
    TESTS_PASSED=0
    TESTS_FAILED=0
    echo "==============================================="
    echo "Starting Test Suite: $1"
    echo "==============================================="
}

# Mark the start of a test
test_start() {
    CURRENT_TEST="$1"
    echo -n "Running: $CURRENT_TEST ... "
}

# Mark test as passed
test_pass() {
    ((TESTS_RUN++))
    ((TESTS_PASSED++))
    echo -e "${GREEN}PASSED${NC}"
}

# Mark test as failed
test_fail() {
    local message="${1:-}"
    ((TESTS_RUN++))
    ((TESTS_FAILED++))
    echo -e "${RED}FAILED${NC}"
    if [[ -n "$message" ]]; then
        echo "  Error: $message"
    fi
}

# Assert equal
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Values not equal}"
    
    if [[ "$expected" == "$actual" ]]; then
        return 0
    else
        echo "  Expected: '$expected'"
        echo "  Actual:   '$actual'"
        echo "  Message:  $message"
        return 1
    fi
}

# Assert not equal
assert_not_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Values should not be equal}"
    
    if [[ "$expected" != "$actual" ]]; then
        return 0
    else
        echo "  Message: $message"
        return 1
    fi
}

# Assert true
assert_true() {
    local condition="$1"
    local message="${2:-Condition is not true}"
    
    if [[ "$condition" == "true" ]] || [[ "$condition" == "0" ]]; then
        return 0
    else
        echo "  Message: $message"
        return 1
    fi
}

# Assert false
assert_false() {
    local condition="$1"
    local message="${2:-Condition is not false}"
    
    if [[ "$condition" == "false" ]] || [[ "$condition" != "0" ]]; then
        return 0
    else
        echo "  Message: $message"
        return 1
    fi
}

# Assert file exists
assert_file_exists() {
    local file="$1"
    local message="${2:-File does not exist: $file}"
    
    if [[ -f "$file" ]]; then
        return 0
    else
        echo "  Message: $message"
        return 1
    fi
}

# Assert directory exists
assert_dir_exists() {
    local dir="$1"
    local message="${2:-Directory does not exist: $dir}"
    
    if [[ -d "$dir" ]]; then
        return 0
    else
        echo "  Message: $message"
        return 1
    fi
}

# Assert command succeeds
assert_success() {
    if "$@"; then
        return 0
    else
        echo "  Command failed: $*"
        return 1
    fi
}

# Assert command fails
assert_failure() {
    if ! "$@"; then
        return 0
    else
        echo "  Command succeeded but should have failed: $*"
        return 1
    fi
}

# Assert output contains string
assert_output_contains() {
    local expected="$1"
    local output="$2"
    local message="${3:-Output does not contain expected string}"
    
    if [[ "$output" == *"$expected"* ]]; then
        return 0
    else
        echo "  Expected substring: '$expected'"
        echo "  Output: '$output'"
        echo "  Message: $message"
        return 1
    fi
}

# Mock a command
mock_command() {
    local command="$1"
    local return_value="${2:-0}"
    local output="${3:-}"
    
    eval "$command() { echo '$output'; return $return_value; }"
}

# Stub a function
stub_function() {
    local function_name="$1"
    local replacement="$2"
    
    eval "$function_name() { $replacement; }"
}

# Setup function (run before each test)
setup() {
    :
}

# Teardown function (run after each test)
teardown() {
    :
}

# Run a test with setup and teardown
run_test() {
    local test_name="$1"
    
    test_start "$test_name"
    
    # Run setup
    setup
    
    # Run the test and capture result
    if "$test_name"; then
        test_pass
    else
        test_fail
    fi
    
    # Run teardown
    teardown
}

# Print test summary
print_summary() {
    echo ""
    echo "==============================================="
    echo "Test Summary"
    echo "==============================================="
    echo "Tests Run:    $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo "==============================================="
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}ALL TESTS PASSED${NC}"
        return 0
    else
        echo -e "${RED}SOME TESTS FAILED${NC}"
        return 1
    fi
}

# Export functions for use in test files
export -f init_test_suite test_start test_pass test_fail
export -f assert_equals assert_not_equals assert_true assert_false
export -f assert_file_exists assert_dir_exists assert_success assert_failure
export -f assert_output_contains mock_command stub_function
export -f setup teardown run_test print_summary
