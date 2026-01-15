# Script Development Guide for Hydra-Termux

## Table of Contents
1. [Variable Naming Conventions](#variable-naming-conventions)
2. [Safe Script Sourcing](#safe-script-sourcing)
3. [Error Handling Best Practices](#error-handling-best-practices)
4. [Path Resolution](#path-resolution)
5. [Common Utility Library](#common-utility-library)
6. [Testing Your Scripts](#testing-your-scripts)

---

## Variable Naming Conventions

### The SCRIPT_DIR Collision Problem

When bash scripts source other scripts, variable definitions can collide. This is especially problematic with `SCRIPT_DIR` and `PROJECT_ROOT` variables.

**❌ WRONG - Causes Collision:**
```bash
# parent_script.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # /path/to/scripts
source "$SCRIPT_DIR/logger.sh"  # This will overwrite SCRIPT_DIR!

# logger.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # Also /path/to/scripts
# Now parent's SCRIPT_DIR is overwritten!
```

**✅ CORRECT - Use Private Variable Names:**
```bash
# parent_script.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/logger.sh"

# logger.sh (utility script that will be sourced)
_LOGGER_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$_LOGGER_SCRIPT_DIR")"
# Parent's SCRIPT_DIR remains unchanged!
```

### Standard Variable Naming Rules

| Variable Type | Naming Convention | Example | When to Use |
|--------------|-------------------|---------|-------------|
| **Main script variables** | `SCRIPT_DIR`, `PROJECT_ROOT` | `SCRIPT_DIR="/path/to/scripts"` | In standalone scripts that are executed |
| **Utility module variables** | `_MODULENAME_SCRIPT_DIR` | `_LOGGER_SCRIPT_DIR="/path"` | In scripts that will be sourced by others |
| **Configuration variables** | `UPPER_CASE` | `DEFAULT_THREADS=16` | For settings and configuration |
| **Local function variables** | `lower_case` or `local var` | `local target=""` | Inside functions only |
| **Private/internal variables** | `_PRIVATE_NAME` | `_INTERNAL_STATE=1` | For module-internal use |
| **Exported variables** | `UPPER_CASE` | `export LOG_DIR="/path"` | When child processes need access |
| **Constants** | `readonly UPPER_CASE` | `readonly VERSION="2.0.0"` | For values that never change |

### Module-Specific Private Variable Prefixes

Each utility module should use its own prefix to avoid collisions:

| Module | Prefix | Example Variables |
|--------|--------|-------------------|
| `logger.sh` | `_LOGGER_` | `_LOGGER_SCRIPT_DIR`, `_LOGGER_INIT` |
| `ai_assistant.sh` | `_AI_` | `_AI_SCRIPT_DIR`, `_AI_STATE` |
| `vpn_check.sh` | `_VPN_` | `_VPN_SCRIPT_DIR`, `_VPN_CHECKED` |
| `target_manager.sh` | `_TARGET_` | `_TARGET_SCRIPT_DIR`, `_TARGET_LIST` |
| `common.sh` | `_COMMON_` | `_COMMON_SCRIPT_DIR`, `_COMMON_SH_LOADED` |

---

## Safe Script Sourcing

### Always Validate Before Sourcing

**❌ WRONG - Unsafe Sourcing:**
```bash
source "$SCRIPT_DIR/logger.sh"  # Fails silently or with cryptic error
```

**✅ CORRECT - Safe Sourcing:**
```bash
if [ ! -f "$SCRIPT_DIR/logger.sh" ]; then
    echo "ERROR: logger.sh not found at $SCRIPT_DIR/logger.sh" >&2
    exit 1
fi
source "$SCRIPT_DIR/logger.sh"
```

**✅ BETTER - Use Common Utility:**
```bash
# Source common.sh first
source "$SCRIPT_DIR/common.sh" || exit 1

# Then use safe_source function
safe_source "$SCRIPT_DIR/logger.sh" "logging utility" || exit 1
```

### Standard Script Template

Every script should follow this template:

```bash
#!/bin/bash

# Script Name and Description
# Brief description of what this script does

# Strict error handling (recommended for critical scripts)
set -euo pipefail

# Get script directory with symlink resolution
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" 2>/dev/null && pwd)" || {
    echo "ERROR: Unable to determine script directory" >&2
    exit 1
}
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source common utilities first
if [ -f "$SCRIPT_DIR/common.sh" ]; then
    source "$SCRIPT_DIR/common.sh" || exit 1
else
    echo "ERROR: common.sh not found at $SCRIPT_DIR/common.sh" >&2
    exit 1
fi

# Source other required modules using safe_source
safe_source "$SCRIPT_DIR/logger.sh" "logging utility" || exit 1
safe_source "$SCRIPT_DIR/vpn_check.sh" "VPN checker" || exit 1

# Validate environment
validate_environment || {
    log_error "Environment validation failed"
    exit 1
}

# Configuration
readonly VERSION="1.0.0"
DEFAULT_TIMEOUT=30
DEFAULT_THREADS=16

# Load configuration if available
load_config "$PROJECT_ROOT/config/hydra.conf"

# Trap for cleanup on exit
cleanup() {
    local exit_code=$?
    # Perform cleanup here
    cleanup_temp_files "${temp_files[@]}"
    exit $exit_code
}
trap cleanup EXIT INT TERM

# Main functions
show_help() {
    cat << EOF
Script Name - Brief Description

Usage: $0 [OPTIONS]

Options:
  -t, --target TARGET    Target IP or hostname
  -p, --port PORT        Port number (default: 22)
  -v, --verbose          Enable verbose output
  -h, --help             Show this help message

Examples:
  $0 -t 192.168.1.1
  $0 -t example.com -p 8080

EOF
}

# Main logic
main() {
    # Parse arguments
    # Execute functionality
    # Handle errors
    return 0
}

# Run main if script is executed (not sourced)
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
```

---

## Error Handling Best Practices

### Use `set -euo pipefail` for Critical Scripts

```bash
set -e          # Exit immediately if any command fails
set -u          # Error on undefined variables
set -o pipefail # Catch errors in pipes
```

**When to use:**
- ✅ Attack scripts that must not continue on error
- ✅ Installation/setup scripts
- ✅ Scripts that modify system state
- ❌ Interactive menu scripts (may interfere with user input)
- ❌ Scripts that intentionally test for failures

### Trap Handlers for Cleanup

```bash
# Array to track temporary files
declare -a temp_files=()

# Cleanup function
cleanup() {
    local exit_code=$?
    
    # Remove temporary files
    for file in "${temp_files[@]}"; do
        [ -f "$file" ] && rm -f "$file" 2>/dev/null
    done
    
    # Log exit status
    if [ $exit_code -eq 0 ]; then
        log_info "Script completed successfully"
    else
        log_error "Script exited with error code: $exit_code"
    fi
    
    return $exit_code
}

# Set trap for all exit scenarios
trap cleanup EXIT INT TERM

# Create temp file and track it
temp_file=$(mktemp /tmp/hydra.XXXXXX)
temp_files+=("$temp_file")
```

### Validate All Critical Inputs

```bash
validate_inputs() {
    # Check target
    if [ -z "$TARGET" ]; then
        log_error "Target is required"
        return 1
    fi
    
    # Validate IP or hostname
    if ! validate_ip "$TARGET" && ! validate_hostname "$TARGET"; then
        log_error "Invalid target format: $TARGET"
        return 1
    fi
    
    # Validate port
    if ! validate_port "$PORT"; then
        log_error "Invalid port: $PORT (must be 1-65535)"
        return 1
    fi
    
    # Check wordlist exists
    if [ ! -f "$WORDLIST" ]; then
        log_error "Wordlist not found: $WORDLIST"
        return 1
    fi
    
    return 0
}
```

---

## Path Resolution

### Handle Symlinks Correctly

The repository includes sophisticated symlink resolution in `hydra.sh` that should be replicated in other scripts:

```bash
# Comprehensive symlink resolution
SCRIPT_PATH="${BASH_SOURCE[0]}"
resolved_path=""

# Try realpath (most reliable)
if command -v realpath >/dev/null; then
    resolved_path="$(realpath "$SCRIPT_PATH" 2>/dev/null)"
fi

# Fallback to readlink
if [ -z "$resolved_path" ] && command -v readlink >/dev/null; then
    if resolved="$(readlink -f "$SCRIPT_PATH" 2>/dev/null)" && [ -n "$resolved" ]; then
        resolved_path="$resolved"
    elif resolved="$(readlink "$SCRIPT_PATH" 2>/dev/null)" && [ -n "$resolved" ]; then
        # Handle relative symlinks
        if [ "${resolved#/}" != "$resolved" ]; then
            resolved_path="$resolved"  # Absolute
        else
            link_dir="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
            resolved_path="$link_dir/$resolved"  # Make absolute
        fi
    fi
fi

# Use resolved path or original
[ -n "$resolved_path" ] && SCRIPT_PATH="$resolved_path"

# Get directory
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" 2>/dev/null && pwd)" || {
    echo "ERROR: Unable to determine script directory" >&2
    exit 1
}
```

**Or use the common.sh helper:**

```bash
source "$SCRIPT_DIR/common.sh" || exit 1
SCRIPT_DIR="$(get_script_dir "${BASH_SOURCE[0]}")" || exit 1
```

---

## Common Utility Library

The `scripts/common.sh` file provides standardized utility functions that should be used across all scripts.

### Key Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `safe_source` | Source files with validation | `safe_source "$SCRIPT_DIR/logger.sh" "logger"` |
| `validate_var` | Check variable is set | `validate_var "TARGET" "$TARGET" "target IP"` |
| `validate_dir` | Check directory exists | `validate_dir "$PROJECT_ROOT" "project root"` |
| `validate_file` | Check file exists | `validate_file "$WORDLIST" "password list"` |
| `validate_environment` | Check SCRIPT_DIR/PROJECT_ROOT | `validate_environment` |
| `resolve_script_path` | Resolve symlinks | `path=$(resolve_script_path "$BASH_SOURCE")` |
| `get_script_dir` | Get script directory | `dir=$(get_script_dir "$BASH_SOURCE")` |
| `load_config` | Load config safely | `load_config "$PROJECT_ROOT/config/hydra.conf"` |
| `safe_mkdir` | Create directory | `safe_mkdir "$LOG_DIR" "log directory"` |
| `command_exists` | Check if command available | `command_exists hydra` |
| `check_commands` | Check multiple commands | `check_commands hydra nmap git` |
| `validate_ip` | Validate IP address | `validate_ip "192.168.1.1"` |
| `validate_hostname` | Validate hostname | `validate_hostname "example.com"` |
| `validate_port` | Validate port number | `validate_port "22"` |
| `make_temp_file` | Create temp file | `tmp=$(make_temp_file "prefix")` |
| `cleanup_temp_files` | Remove temp files | `cleanup_temp_files file1 file2` |
| `debug_log` | Debug logging | `debug_log "Debug message"` |

### Usage Example

```bash
#!/bin/bash

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh" || exit 1

# Use utility functions
safe_source "$SCRIPT_DIR/logger.sh" || exit 1

# Validate input
TARGET="$1"
validate_var "TARGET" "$TARGET" "target IP/hostname" || exit 1

if validate_ip "$TARGET"; then
    log_info "Valid IP address: $TARGET"
elif validate_hostname "$TARGET"; then
    log_info "Valid hostname: $TARGET"
else
    log_error "Invalid target format"
    exit 1
fi

# Check dependencies
check_commands hydra nmap || exit 1

# Create temp file
temp_output=$(make_temp_file "attack_output") || exit 1
trap "cleanup_temp_files '$temp_output'" EXIT

# Execute attack
log_info "Starting attack on $TARGET"
# ... attack logic ...
```

---

## Testing Your Scripts

### Manual Testing Checklist

Before committing any script changes, verify:

- [ ] Script executes without errors
- [ ] All sourced files are found
- [ ] SCRIPT_DIR and PROJECT_ROOT are correct
- [ ] Error messages are clear and helpful
- [ ] Cleanup occurs on exit/interrupt
- [ ] Help text displays correctly
- [ ] Invalid inputs are rejected
- [ ] Required commands are checked
- [ ] Temporary files are cleaned up
- [ ] Symlinked execution works

### Test Script Template

```bash
#!/bin/bash

# Test script for [script_name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Testing [script_name]..."

# Test 1: Script exists and is executable
if [ ! -x "$SCRIPT_DIR/[script_name].sh" ]; then
    echo "❌ FAIL: Script not found or not executable"
    exit 1
fi
echo "✓ Script exists and is executable"

# Test 2: Help displays correctly
if ! bash "$SCRIPT_DIR/[script_name].sh" --help >/dev/null 2>&1; then
    echo "❌ FAIL: Help option failed"
    exit 1
fi
echo "✓ Help displays correctly"

# Test 3: Invalid input rejected
if bash "$SCRIPT_DIR/[script_name].sh" --invalid-option 2>&1 | grep -q "ERROR"; then
    echo "✓ Invalid input rejected correctly"
else
    echo "❌ FAIL: Invalid input not rejected"
    exit 1
fi

# Test 4: Required dependencies checked
if bash "$SCRIPT_DIR/[script_name].sh" 2>&1 | grep -q "hydra.*not.*installed"; then
    echo "✓ Dependency check works (hydra not installed)"
else
    echo "⚠ Warning: Dependency check may not be working"
fi

echo ""
echo "All tests passed! ✓"
```

### Integration Testing

```bash
# Test script sourcing chain
bash -c "
    SCRIPT_DIR='$PROJECT_ROOT/scripts'
    source \"\$SCRIPT_DIR/common.sh\" || exit 1
    safe_source \"\$SCRIPT_DIR/logger.sh\" || exit 1
    safe_source \"\$SCRIPT_DIR/ai_assistant.sh\" || exit 1
    echo 'Sourcing chain successful'
"
```

---

## Quick Reference

### Do's and Don'ts

#### ✅ DO:

- Use `_MODULE_SCRIPT_DIR` in utility scripts
- Validate all inputs before use
- Check file existence before sourcing
- Use `safe_source` from common.sh
- Add cleanup trap handlers
- Quote all variable references: `"$VAR"`
- Use `readonly` for constants
- Validate environment with `validate_environment`
- Use `set -euo pipefail` in critical scripts
- Document all functions with comments

#### ❌ DON'T:

- Overwrite parent script variables (use private names)
- Source files without checking existence
- Use bare `source` commands without error handling
- Ignore exit codes from critical commands
- Use undefined variables
- Leave temporary files without cleanup
- Hard-code paths (use SCRIPT_DIR/PROJECT_ROOT)
- Skip input validation
- Use `$VAR` without quotes in paths
- Commit debugging code

---

## Additional Resources

- **Main launcher:** `hydra.sh` - Reference implementation for symlink handling
- **Utility library:** `scripts/common.sh` - Standardized helper functions
- **Logger:** `scripts/logger.sh` - Example of proper private variable usage
- **AI Assistant:** `scripts/ai_assistant.sh` - Example of proper private variable usage
- **Examples:** See any script in `scripts/` directory for working implementations

## Getting Help

If you're unsure about implementation:

1. Check existing scripts for patterns
2. Review this guide
3. Test your changes thoroughly
4. Ask for code review before committing

---

**Remember:** Proper variable naming and error handling prevents 99% of script failures!
