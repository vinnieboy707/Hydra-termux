#!/usr/bin/env bash
# Master test runner for all test suites

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Test suite counters
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

echo "=========================================="
echo "Hydra-Termux Comprehensive Test Suite"
echo "=========================================="
echo ""

# Run unit tests
if [[ -d "$SCRIPT_DIR/unit" ]]; then
    echo "Running Unit Tests..."
    ((TOTAL_SUITES++))
    if find "$SCRIPT_DIR/unit" -name "test-*.sh" -type f -exec {} \;; then
        ((PASSED_SUITES++))
        echo -e "${GREEN}✓ Unit tests passed${NC}"
    else
        ((FAILED_SUITES++))
        echo -e "${RED}✗ Unit tests failed${NC}"
    fi
    echo ""
fi

# Run integration tests
if [[ -d "$SCRIPT_DIR/integration" ]]; then
    echo "Running Integration Tests..."
    ((TOTAL_SUITES++))
    if find "$SCRIPT_DIR/integration" -name "test-*.sh" -type f -exec {} \;; then
        ((PASSED_SUITES++))
        echo -e "${GREEN}✓ Integration tests passed${NC}"
    else
        ((FAILED_SUITES++))
        echo -e "${RED}✗ Integration tests failed${NC}"
    fi
    echo ""
fi

# Run performance tests
if [[ -d "$SCRIPT_DIR/performance" ]]; then
    echo "Running Performance Tests..."
    ((TOTAL_SUITES++))
    if find "$SCRIPT_DIR/performance" -name "benchmark-*.sh" -type f -exec {} \;; then
        ((PASSED_SUITES++))
        echo -e "${GREEN}✓ Performance tests passed${NC}"
    else
        ((FAILED_SUITES++))
        echo -e "${RED}✗ Performance tests failed${NC}"
    fi
    echo ""
fi

# Run security tests
if [[ -d "$SCRIPT_DIR/security" ]]; then
    echo "Running Security Tests..."
    ((TOTAL_SUITES++))
    if find "$SCRIPT_DIR/security" -name "test-*.sh" -type f -exec {} \;; then
        ((PASSED_SUITES++))
        echo -e "${GREEN}✓ Security tests passed${NC}"
    else
        ((FAILED_SUITES++))
        echo -e "${RED}✗ Security tests failed${NC}"
    fi
    echo ""
fi

# Print summary
echo "=========================================="
echo "Test Suite Summary"
echo "=========================================="
echo "Total Suites: $TOTAL_SUITES"
echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
echo -e "Failed: ${RED}$FAILED_SUITES${NC}"
echo "=========================================="

if [[ $FAILED_SUITES -eq 0 ]]; then
    echo -e "${GREEN}ALL TEST SUITES PASSED${NC}"
    exit 0
else
    echo -e "${RED}SOME TEST SUITES FAILED${NC}"
    exit 1
fi
