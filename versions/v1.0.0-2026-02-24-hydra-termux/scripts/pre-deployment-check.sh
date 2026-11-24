#!/bin/bash

# Pre-Deployment Checklist Script
# Ensures all guardrails and best practices are followed before deployment

# Don't use set -e as we handle errors explicitly with return codes
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Track failures
FAILURES=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_failure() {
    echo -e "${RED}✗${NC} $1"
    ((FAILURES++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running in correct directory
check_directory() {
    print_header "Checking Directory"
    
    if [ ! -f "$PROJECT_ROOT/hydra.sh" ]; then
        print_failure "Not in Hydra-Termux root directory"
        return 1
    fi
    
    print_success "Running from correct directory"
}

# Legal and ethical checks
check_legal_compliance() {
    print_header "Legal and Ethical Compliance"
    
    # Check if legal disclaimer exists
    if [ -f "$PROJECT_ROOT/LEGAL_DISCLAIMER.md" ]; then
        print_success "Legal disclaimer present"
    else
        print_failure "Legal disclaimer missing"
    fi
    
    # Check if code of conduct exists
    if [ -f "$PROJECT_ROOT/CODE_OF_CONDUCT.md" ]; then
        print_success "Code of Conduct present"
    else
        print_warning "Code of Conduct missing"
    fi
    
    # Check for authorization documentation
    if [ -f "$PROJECT_ROOT/.authorization_accepted" ] || [ -f "$PROJECT_ROOT/.disclaimer_accepted" ]; then
        print_success "User has accepted legal terms"
    else
        print_warning "Legal terms acceptance not recorded"
    fi
}

# Security checks
check_security() {
    print_header "Security Checks"
    
    # Check for exposed secrets in environment files
    if [ -f "$PROJECT_ROOT/.env" ]; then
        print_warning "Found .env file - ensure it's not committed to git"
        
        # Check if .env is in .gitignore
        if grep -q "^\.env$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
            print_success ".env is in .gitignore"
        else
            print_failure ".env is NOT in .gitignore - SECURITY RISK!"
        fi
    fi
    
    # Check for default passwords in docker-compose
    if grep -q "CHANGE_ME\|changeme\|password123\|admin123" "$PROJECT_ROOT"/docker-compose*.yml 2>/dev/null; then
        print_failure "Default passwords found in docker-compose files - MUST CHANGE!"
    else
        print_success "No obvious default passwords in docker-compose files"
    fi
    
    # Check for exposed secrets in code
    if grep -r "password.*=.*['\"]" "$PROJECT_ROOT/scripts/" 2>/dev/null | grep -v "^#" | grep -v "example" | grep -v "template" | grep -q .; then
        print_warning "Possible hardcoded credentials found in scripts"
    fi
    
    # Check file permissions on sensitive files
    if [ -f "$PROJECT_ROOT/.env" ]; then
        perms=$(stat -c "%a" "$PROJECT_ROOT/.env" 2>/dev/null || stat -f "%OLp" "$PROJECT_ROOT/.env" 2>/dev/null)
        if [ "$perms" = "600" ] || [ "$perms" = "400" ]; then
            print_success ".env has secure permissions ($perms)"
        else
            print_warning ".env permissions are $perms (should be 600 or 400)"
        fi
    fi
}

# Code quality checks
check_code_quality() {
    print_header "Code Quality Checks"
    
    # Check if shellcheck is available
    if command -v shellcheck &> /dev/null; then
        print_info "Running ShellCheck on scripts..."
        
        error_count=0
        for script in "$PROJECT_ROOT"/scripts/*.sh "$PROJECT_ROOT"/*.sh; do
            if [ -f "$script" ]; then
                if ! shellcheck -S warning "$script" &>/dev/null; then
                    ((error_count++))
                fi
            fi
        done
        
        if [ $error_count -eq 0 ]; then
            print_success "All scripts pass ShellCheck"
        else
            print_failure "$error_count script(s) have ShellCheck warnings"
        fi
    else
        print_warning "ShellCheck not installed - skipping script validation"
    fi
    
    # Check for syntax errors
    print_info "Checking bash syntax..."
    syntax_errors=0
    for script in "$PROJECT_ROOT"/scripts/*.sh "$PROJECT_ROOT"/*.sh; do
        if [ -f "$script" ]; then
            if ! bash -n "$script" 2>/dev/null; then
                print_failure "Syntax error in: $(basename "$script")"
                ((syntax_errors++))
            fi
        fi
    done
    
    if [ $syntax_errors -eq 0 ]; then
        print_success "No syntax errors found"
    fi
}

# Git checks
check_git_status() {
    print_header "Git Status Checks"
    
    if [ -d "$PROJECT_ROOT/.git" ]; then
        # Check for uncommitted changes
        if git -C "$PROJECT_ROOT" diff-index --quiet HEAD -- 2>/dev/null; then
            print_success "No uncommitted changes"
        else
            print_warning "You have uncommitted changes"
            git -C "$PROJECT_ROOT" status --short
        fi
        
        # Check current branch
        branch=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
        print_info "Current branch: $branch"
        
        # Check if on main/master
        if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
            print_warning "You are on $branch branch - consider using a feature branch"
        fi
        
        # Check for large files
        large_files=$(git -C "$PROJECT_ROOT" ls-files | xargs -I{} find "$PROJECT_ROOT/{}" -size +10M 2>/dev/null)
        if [ -n "$large_files" ]; then
            print_warning "Large files found in git:"
            echo "$large_files"
        fi
    else
        print_info "Not a git repository"
    fi
}

# Docker checks
check_docker() {
    print_header "Docker Configuration Checks"
    
    # Check if Docker is installed
    if command -v docker &> /dev/null; then
        print_success "Docker is installed"
        docker --version
        
        # Check if Docker is running
        if docker info &>/dev/null; then
            print_success "Docker daemon is running"
        else
            print_failure "Docker daemon is not running"
        fi
    else
        print_warning "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
        docker-compose --version
        
        # Validate docker-compose files
        if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
            if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" config &>/dev/null; then
                print_success "docker-compose.yml is valid"
            else
                print_failure "docker-compose.yml has errors"
            fi
        fi
        
        if [ -f "$PROJECT_ROOT/docker-compose.production.yml" ]; then
            if docker-compose -f "$PROJECT_ROOT/docker-compose.production.yml" config &>/dev/null; then
                print_success "docker-compose.production.yml is valid"
            else
                print_failure "docker-compose.production.yml has errors"
            fi
        fi
    else
        print_warning "Docker Compose is not installed - skipping compose file validation"
    fi
}

# Environment checks
check_environment() {
    print_header "Environment Configuration Checks"
    
    # Check for required environment files
    if [ -f "$PROJECT_ROOT/.env.production.template" ]; then
        print_success "Production environment template exists"
    else
        print_warning "Production environment template missing"
    fi
    
    if [ -f "$PROJECT_ROOT/.env.development" ]; then
        print_success "Development environment file exists"
    else
        print_warning "Development environment file missing"
    fi
    
    # Check .gitignore
    if [ -f "$PROJECT_ROOT/.gitignore" ]; then
        print_success ".gitignore exists"
        
        # Check for important entries
        important_entries=(".env" "*.log" "node_modules" ".env.local" ".env.production")
        for entry in "${important_entries[@]}"; do
            if grep -q "$entry" "$PROJECT_ROOT/.gitignore"; then
                print_success ".gitignore includes $entry"
            else
                print_warning ".gitignore missing $entry"
            fi
        done
    else
        print_failure ".gitignore is missing!"
    fi
}

# Documentation checks
check_documentation() {
    print_header "Documentation Checks"
    
    required_docs=("README.md" "CONTRIBUTING.md" "LICENSE" "DEPLOYMENT.md")
    
    for doc in "${required_docs[@]}"; do
        if [ -f "$PROJECT_ROOT/$doc" ]; then
            print_success "$doc exists"
        else
            print_warning "$doc is missing"
        fi
    done
    
    # Check if README has deployment instructions
    if [ -f "$PROJECT_ROOT/README.md" ]; then
        if grep -qi "deployment\|install\|setup" "$PROJECT_ROOT/README.md"; then
            print_success "README includes deployment information"
        else
            print_warning "README may be missing deployment instructions"
        fi
    fi
}

# Dependency checks
check_dependencies() {
    print_header "Dependency Checks"
    
    # Check for package.json
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        print_success "package.json exists"
        
        # Check for vulnerabilities if npm is installed
        if command -v npm &> /dev/null; then
            print_info "Checking for npm vulnerabilities..."
            if cd "$PROJECT_ROOT"; then
                if npm audit --audit-level=high &>/dev/null; then
                    print_success "No high-severity npm vulnerabilities"
                else
                    print_warning "npm vulnerabilities found - run 'npm audit' for details"
                fi
            else
                print_warning "Could not change to project directory"
            fi
        fi
    fi
}

# Deployment readiness summary
deployment_summary() {
    print_header "Deployment Readiness Summary"
    
    echo ""
    if [ $FAILURES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ ALL CHECKS PASSED - READY TO DEPLOY      ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
        return 0
    elif [ $FAILURES -eq 0 ]; then
        echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  ⚠ WARNINGS FOUND - REVIEW BEFORE DEPLOY    ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        return 1
    else
        echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ FAILURES FOUND - DO NOT DEPLOY           ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${RED}Failures: $FAILURES${NC}"
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        return 2
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  HYDRA-TERMUX PRE-DEPLOYMENT CHECKLIST${NC}"
    echo -e "${BLUE}  Ensuring best practices and proper etiquette${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    check_directory
    check_legal_compliance
    check_security
    check_code_quality
    check_git_status
    check_docker
    check_environment
    check_documentation
    check_dependencies
    
    deployment_summary
    exit_code=$?
    
    echo ""
    echo "Run this checklist before every deployment!"
    echo "For more information, see DEPLOYMENT.md"
    echo ""
    
    exit $exit_code
}

# Run main function
main
