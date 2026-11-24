# Contributing to Hydra-Termux

Thank you for your interest in contributing to Hydra-Termux Ultimate Edition! We welcome contributions from the community.

## 📜 Code of Conduct

Before contributing, please read and agree to our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## 🎯 Contribution Philosophy

### Proper Etiquette
- **Be respectful**: Treat all contributors with respect and professionalism
- **Be constructive**: Provide helpful feedback, not criticism
- **Be patient**: Remember that everyone has different experience levels
- **Be ethical**: Only contribute features that promote legal, ethical use
- **Be responsible**: Test your changes thoroughly before submitting

### What We're Looking For
- ✅ Bug fixes and security improvements
- ✅ Documentation enhancements
- ✅ Performance optimizations
- ✅ New ethical testing features
- ✅ Code quality improvements
- ✅ Test coverage improvements

### What We Don't Accept
- ❌ Malicious code or backdoors
- ❌ Features that encourage illegal activity
- ❌ Poorly tested changes
- ❌ Code without proper documentation
- ❌ Breaking changes without discussion
- ❌ Plagiarized code

## 🚀 Getting Started

### Prerequisites
1. Read the [Code of Conduct](CODE_OF_CONDUCT.md)
2. Read the [Legal Disclaimer](LEGAL_DISCLAIMER.md)
3. Familiarize yourself with the project structure
4. Set up your development environment (see [Dev Container](.devcontainer/README.md))

### Development Environment

#### Option 1: VS Code Dev Container (Recommended)
```bash
# Open in VS Code
code .

# Press F1 and select "Dev Containers: Reopen in Container"
# Everything will be configured automatically!
```

#### Option 2: Local Setup
```bash
# Clone the repository
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux

# Install dependencies
./install.sh

# Run pre-deployment checks
bash scripts/pre-deployment-check.sh
```

## 📝 How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- **Clear title**: Brief description of the issue
- **Description**: Detailed explanation of the problem
- **Steps to reproduce**: Exact steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: 
  - OS and version
  - Bash version
  - Relevant tool versions
- **Logs**: Include relevant error messages
- **Screenshots**: If applicable

**Template:**
```markdown
## Bug Description
[Clear description]

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: Ubuntu 22.04
- Bash: 5.1.16
- Hydra: 9.4

## Logs
```
[error logs]
```
```

### Suggesting Features

We welcome feature suggestions! Please:
1. **Search existing issues** to avoid duplicates
2. **Create a detailed proposal** with:
   - Clear use case
   - Benefits to the project
   - Potential implementation approach
   - Any security or ethical considerations
3. **Engage in discussion** with maintainers
4. **Wait for approval** before implementing

**Template:**
```markdown
## Feature Proposal: [Feature Name]

### Problem Statement
[What problem does this solve?]

### Proposed Solution
[How would this work?]

### Benefits
- Benefit 1
- Benefit 2

### Ethical Considerations
[Any legal or ethical concerns?]

### Implementation Ideas
[Optional: Technical approach]
```

### Contributing Code

#### 1. Fork and Clone
```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/Hydra-termux.git
cd Hydra-termux

# Add upstream remote
git remote add upstream https://github.com/vinnieboy707/Hydra-termux.git
```

#### 2. Create a Feature Branch
```bash
# Always branch from main
git checkout main
git pull upstream main

# Create descriptive branch name
git checkout -b feature/add-ssh-key-auth
# or
git checkout -b fix/memory-leak-in-scanner
# or
git checkout -b docs/improve-deployment-guide
```

**Branch Naming Convention:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/fixes
- `security/` - Security fixes

#### 3. Make Your Changes

Follow our coding standards:

**Bash Scripts:**
```bash
#!/bin/bash

# Script Purpose: Brief description
# Author: Your Name
# Date: YYYY-MM-DD

set -e  # Exit on error

# Get script directory (standard pattern)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source dependencies
source "$SCRIPT_DIR/logger.sh"

# Constants (UPPER_CASE)
readonly MAX_RETRIES=3
readonly TIMEOUT=30

# Configuration (UPPER_CASE)
TARGET=""
PORT=22

# Functions (snake_case)
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -t, --target    Target host
    -p, --port      Port (default: 22)
    -h, --help      Show this help

Examples:
    $0 -t example.com
    $0 -t 192.168.1.1 -p 2222
EOF
}

# Input validation (always validate!)
validate_input() {
    if [ -z "$TARGET" ]; then
        log_error "Target is required"
        show_help
        exit 1
    fi
    
    if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
        log_error "Invalid port: $PORT"
        exit 1
    fi
}

# Main logic
main() {
    validate_input
    
    # Your code here
    log_info "Starting operation..."
    
    # Use error handling
    if ! some_command; then
        log_error "Operation failed"
        return 1
    fi
    
    log_success "Operation completed"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute main
main
```

**Code Quality Checklist:**
- [ ] Code follows existing style
- [ ] All functions have comments
- [ ] Input validation is present
- [ ] Error handling is comprehensive
- [ ] No hardcoded credentials
- [ ] No security vulnerabilities
- [ ] Shellcheck passes
- [ ] Manual testing completed

#### 4. Test Your Changes

```bash
# Run syntax check
bash -n your-script.sh

# Run shellcheck
shellcheck your-script.sh

# Run pre-deployment checks
bash scripts/pre-deployment-check.sh

# Test manually
bash your-script.sh --help
bash your-script.sh [test parameters]
```

#### 5. Commit Your Changes

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Maintenance tasks
- `security`: Security fixes

**Examples:**
```bash
git commit -m "feat(ssh): add SSH key authentication support

- Added function to parse SSH keys
- Implemented key-based authentication
- Updated documentation

Closes #123"
```

```bash
git commit -m "fix(scanner): resolve memory leak in port scanner

The scanner was not properly closing sockets, causing memory
usage to grow over time.

Fixes #456"
```

```bash
git commit -m "docs(deployment): improve production deployment guide

- Added SSL configuration steps
- Clarified backup procedures
- Added troubleshooting section"
```

#### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR on GitHub with:
# - Clear title
# - Detailed description
# - Reference to related issues
# - Screenshots if UI changes
```

**Pull Request Template:**
```markdown
## Description
[Clear description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123
Related to #456

## Testing
- [ ] Tested locally
- [ ] All checks pass
- [ ] Documentation updated
- [ ] No security issues

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] Ethical use verified
```

## 🔍 Code Review Process

### What We Look For
1. **Functionality**: Does it work as intended?
2. **Code Quality**: Is it clean, readable, maintainable?
3. **Security**: Are there any vulnerabilities?
4. **Ethics**: Does it promote responsible use?
5. **Documentation**: Is it properly documented?
6. **Tests**: Is it adequately tested?

### Review Timeline
- Initial review: Within 3-5 business days
- Follow-up reviews: Within 2 business days
- Approval: Requires 1-2 maintainer approvals

### Addressing Feedback
- Respond to all comments
- Make requested changes
- Push updates to the same branch
- Re-request review when ready

## 📚 Code Guidelines

### Shell Script Standards

#### Naming Conventions
- **Variables**: `UPPER_CASE` for constants, `lower_case` for variables
- **Functions**: `snake_case`
- **Files**: `kebab-case.sh`

#### Best Practices
```bash
# ✅ Good
readonly MAX_ATTEMPTS=3
local target="example.com"
function validate_input() { ... }

# ❌ Bad
MaxAttempts=3
TARGET="example.com"  # Not a constant
function ValidateInput() { ... }
```

#### Error Handling
```bash
# Always use error handling
set -e  # Exit on error
set -u  # Error on undefined variables
set -o pipefail  # Catch errors in pipes

# Trap errors
trap 'echo "Error on line $LINENO"' ERR

# Check command success
if ! command; then
    log_error "Command failed"
    exit 1
fi
```

#### Security
```bash
# ✅ Sanitize input
if ! [[ "$input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "Invalid input"
    exit 1
fi

# ✅ Use quotes
rm -rf "$directory"  # Not: rm -rf $directory

# ✅ Secure temp files
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# ❌ Never hardcode credentials
PASSWORD="secret"  # NEVER DO THIS
```

### Documentation Standards

#### Script Documentation
Every script must have:
```bash
#!/bin/bash

# =============================================================================
# Script Name: example-script.sh
# Description: Brief one-line description
# Author: Your Name
# Date: YYYY-MM-DD
# Version: 1.0.0
#
# Usage: ./example-script.sh [OPTIONS]
#
# Options:
#   -t, --target    Target host
#   -h, --help      Show help
#
# Examples:
#   ./example-script.sh -t example.com
#
# Notes:
#   - Requires root privileges
#   - Only use on authorized systems
# =============================================================================
```

#### Function Documentation
```bash
# Brief description of what function does
#
# Arguments:
#   $1 - Description of first argument
#   $2 - Description of second argument
#
# Returns:
#   0 on success, 1 on failure
#
# Example:
#   my_function "arg1" "arg2"
my_function() {
    local arg1="$1"
    local arg2="$2"
    
    # Function body
}
```

## 🧪 Testing

### Manual Testing
1. Test all code paths
2. Test error conditions
3. Test with invalid input
4. Test on clean environment
5. Verify no side effects

### Automated Testing
```bash
# Run all checks
bash scripts/pre-deployment-check.sh

# Individual checks
shellcheck scripts/*.sh
bash -n script.sh
```

## 📄 Documentation

### What to Document
- New features and how to use them
- Configuration options
- Breaking changes
- Migration guides
- Examples

### Where to Update
- `README.md` - Overview and quick start
- `QUICKSTART.md` - Getting started guide  
- `docs/USAGE.md` - Detailed usage
- `docs/EXAMPLES.md` - Usage examples
- `DEPLOYMENT.md` - Deployment guide
- `CHANGELOG.md` - Version history

## 🔐 Security

### Reporting Security Issues
**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email maintainers privately
2. Provide detailed description
3. Include proof of concept (if safe)
4. Allow time for fixes before disclosure

### Security Best Practices
- Never commit secrets
- Validate all input
- Use secure defaults
- Follow principle of least privilege
- Document security considerations

## ⚖️ Legal Compliance

### Requirements
All contributions must:
- ✅ Be your original work or properly licensed
- ✅ Not infringe on copyrights or patents
- ✅ Comply with export control laws
- ✅ Promote ethical, legal use
- ✅ Include appropriate warnings

### License
By contributing, you agree that your contributions will be licensed under the project's license.

## 🎉 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Git commit history

Significant contributions may earn:
- Maintainer status
- Special recognition
- Project leadership opportunities

## 📞 Questions?

- 💬 Open a discussion issue
- 📧 Contact maintainers
- 📚 Check existing documentation

## 🙏 Thank You!

Every contribution, no matter how small, helps make Hydra-Termux better. We appreciate your time and effort!

---

**Remember**: Always follow proper etiquette, test thoroughly, and ensure ethical use.

