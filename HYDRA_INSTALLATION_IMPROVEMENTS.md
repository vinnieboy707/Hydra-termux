# Hydra Installation Error Improvements

## Problem Statement
The original installation script (`install.sh`) had several issues that made it difficult for users to diagnose and fix hydra installation failures:

1. **Silent Installation** - All package manager output was suppressed (`> /dev/null 2>&1`)
2. **Single Attempt** - Only tried `pkg install hydra` once with no retries
3. **No Alternative Names** - Didn't try `thc-hydra` or other package names
4. **Limited Error Context** - Users couldn't see actual error messages
5. **No Repository Checks** - Didn't verify if hydra was available before trying to install

## Solutions Implemented

### 1. Enhanced `install.sh`

#### New `install_hydra()` Function
Created a dedicated function with multiple retry strategies:

```bash
install_hydra() {
    # Create a secure temporary log file for this installation attempt
    log_file="$(mktemp /tmp/hydra_install.XXXXXX.log)"

    # Attempt 1: Standard 'hydra' package
    pkg install hydra -y 2>&1 | tee "$log_file"
    
    # Attempt 2: Alternative name 'thc-hydra'
    pkg install thc-hydra -y 2>&1 | tee -a "$log_file"
    
    # Attempt 3: Search for any hydra package in repos
    available_hydra=$(pkg search hydra 2>/dev/null | grep -i "^hydra")
    pkg install "$available_hydra" -y
    
    # Show error output on failure
    tail -10 "$log_file"
}
```

**Benefits:**
- ✅ **Visible Errors** - Users see actual error messages via `tee`
- ✅ **Multiple Attempts** - Tries 3 different methods automatically
- ✅ **Better Diagnostics** - Logs installation attempts for debugging
- ✅ **Sleep Delays** - Gives time for package installation to complete

#### Improved Error Messages

**Before:**
```
❌ hydra installation FAILED
2. Try installing hydra manually:
   pkg install hydra -y
```

**After:**
```
🚨 CRITICAL: Hydra installation FAILED!

═══ AUTOMATIC FIX AVAILABLE ═══
🔧 Run the automatic fixer to try advanced installation methods:
   bash scripts/auto_fix.sh

This will attempt:
  • Multiple package repository updates
  • Alternative package names (thc-hydra, etc.)
  • Compilation from source if needed
  • Pre-built binary downloads

═══ MANUAL TROUBLESHOOTING STEPS ═══
1. Update package repositories
2. Try installing hydra manually
3. Check for package availability
4. Try alternative package names
5. Install from root repo
6. Compile from source (advanced)
```

### 2. Enhanced `scripts/auto_fix.sh`

#### Added Root Repository Attempt (Termux)
Many users don't have the `root-repo` enabled, which often contains hydra:

```bash
# NEW: Attempt 2 - Try root repository
pkg install root-repo -y
pkg update -y
pkg install hydra -y
```

**Attempt Sequence:**
1. Standard package manager
2. **Root repository (NEW)** ← Added for Termux users
3. Alternative package names
4. Compile from source
5. Pre-built binary
6. Manual intervention guide

Updated `MAX_ATTEMPTS` from 5 to 6 to accommodate the new step.

## User Impact

### Before (Problems)
- ❌ Users saw "installation failed" with no context
- ❌ Had to manually try alternative package names
- ❌ Couldn't see actual error messages from package manager
- ❌ No automatic retry logic

### After (Solutions)
- ✅ Users see detailed error output
- ✅ Automatic retry with 3 different methods
- ✅ Pointed to `auto_fix.sh` for advanced fixes
- ✅ Better guidance with 6 different solutions
- ✅ Root repository automatically attempted

## Testing

### Manual Testing
Tested the `install_hydra()` function with mocked `pkg` command:
```bash
bash /tmp/test_install_hydra.sh
# Result: Function correctly tries 3 methods and shows error output
```

### Syntax Validation
```bash
bash -n install.sh           # ✅ OK
bash -n scripts/auto_fix.sh  # ✅ OK
```

## Files Modified

1. **`install.sh`** (main changes)
   - Added `install_hydra()` function (60 lines)
   - Enhanced error messages
   - Better troubleshooting guidance

2. **`scripts/auto_fix.sh`** (enhancement)
   - Added root-repo installation attempt
   - Updated attempt counter to 6
   - Improved user guidance

## Backward Compatibility

✅ **Fully backward compatible** - No breaking changes:
- Existing functionality preserved
- New features are additive only
- Error handling is improved, not replaced
- All existing scripts continue to work

## Documentation Updates

Enhanced error messages now reference:
- `./fix-hydra.sh` - Interactive help tool
- `bash scripts/auto_fix.sh` - Automatic fixer
- `bash scripts/check_dependencies.sh` - Dependency check
- `bash scripts/system_diagnostics.sh` - System health check

## Future Improvements (Optional)

1. Add timeout handling for slow package installations
2. Cache successful package names for faster retries
3. Add telemetry for most common installation failures
4. Create installation log file for later review
5. Add support for more Linux distributions

## Summary

These changes significantly improve the hydra installation experience by:
1. **Making errors visible** instead of silent
2. **Trying multiple methods automatically** instead of failing immediately
3. **Providing actionable guidance** instead of generic errors
4. **Integrating with existing tools** like `auto_fix.sh` and `fix-hydra.sh`

Users experiencing "hydra installation error" will now:
- See what actually went wrong
- Have automatic retries with alternative approaches
- Get clear guidance on next steps
- Be pointed to automated fix tools
