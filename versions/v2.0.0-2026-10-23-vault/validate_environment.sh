#!/usr/bin/env bash

# ==============================================================================
# SECURE ENVIRONMENT & FILE VALIDATION UTILITY
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# CONSTANTS & CONFIGURATION
# ------------------------------------------------------------------------------
readonly ENV_FILE="./.env"
readonly LOG_DIR="./logs"
readonly ALLOWED_BASE_DIR="/data/data/com.termux/files/home"

# UI Color Codes for Professional Console Output
readonly COLOR_RESET="\033[0m"
readonly COLOR_SUCCESS="\033[1;32m"
readonly COLOR_ERROR="\033[1;31m"
readonly COLOR_WARN="\033[1;33m"
readonly COLOR_INFO="\033[1;34m"

# ------------------------------------------------------------------------------
# CORE HELPER FUNCTIONS
# ------------------------------------------------------------------------------
log_info()    { echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $*"; }
log_success() { echo -e "${COLOR_SUCCESS}[SUCCESS]${COLOR_RESET} $*"; }
log_warn()    { echo -e "${COLOR_WARN}[WARN]${COLOR_RESET} $*"; }
log_error()   { echo -e "${COLOR_ERROR}[ERROR]${COLOR_RESET} $*" >&2; }

# Fail-Fast Termination Cleanup Handler
cleanup() {
    local -r exit_code=$?
    if [ "${exit_code}" -ne 0 ]; then
        log_error "Pipeline execution aborted prematurely with status code: ${exit_code}."
    fi
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# STEP 1: CONTEXT & DIRECTORY TRAVERSAL SANITIZATION
# ------------------------------------------------------------------------------
sanitize_path() {
    local target_path
    target_path=$(realpath -m "$1")

    log_info "Resolving realpath for resource: ${target_path}..."

    # Mitigate directory traversal by validating the path stays inside the home scope
    if [[ "${target_path}" != "${ALLOWED_BASE_DIR}"* ]]; then
        log_error "Security violation detected: Path traversal attempted outside approved boundaries."
        exit 1
    fi
}

# ------------------------------------------------------------------------------
# STEP 2: PERSISTENT CONFIG PROPERTIES VALIDATION
# ------------------------------------------------------------------------------
validate_configuration_keys() {
    log_info "Initiating environment config scan..."

    if [ ! -f "${ENV_FILE}" ]; then
        log_error "Missing file exception: Configuration blueprint '${ENV_FILE}' not found."
        exit 1
    fi

    # Explicit array check for critical required baseline keys
    local -r required_keys=("ETH_PROVIDER_URL" "ARBITRUM_RPC_URL" "PRIVATE_KEY")
    local missing_keys=0

    for key in "${required_keys[@]}"; do
        if ! grep -q "^${key}=" "${ENV_FILE}"; then
            log_warn "Missing environment structure key definition: ${key}"
            ((missing_keys++))
        fi
    done

    if [ "${missing_keys}" -gt 0 ]; then
        log_error "Environment verification rejected: ${missing_keys} critical structural key(s) are missing."
        exit 1
    fi

    log_success "Structural identity parsing passed: Key definitions validated successfully."
}

# ------------------------------------------------------------------------------
# MAIN EXECUTION ROUTINE
# ------------------------------------------------------------------------------
main() {
    log_info "Initializing production-grade local diagnostic routine..."
    
    # Run Path Sanitization on runtime folders
    sanitize_path "${LOG_DIR}"

    # Verify Configuration Keys
    validate_configuration_keys

    log_success "System architecture operational baseline completely validated."
}

# Execute main process loop with clean argument parsing array
main "$@"
