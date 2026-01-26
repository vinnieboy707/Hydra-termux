#!/bin/bash

# ALHacking Usage Help
# Opens YouTube tutorial

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC2034
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source logger
source "$SCRIPT_DIR/logger.sh"

print_banner "ALHacking Usage Help"
echo ""

log_info "Opening YouTube tutorial..."
echo ""
echo "YouTube Video: https://www.youtube.com/watch?v=zgdq6ErscqY"
echo ""

# Try to open in browser
if command -v python3 >/dev/null 2>&1; then
    python3 -m webbrowser https://www.youtube.com/watch?v=zgdq6ErscqY 2>/dev/null &
    log_success "Browser opened. If it didn't open, visit the URL above."
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open https://www.youtube.com/watch?v=zgdq6ErscqY 2>/dev/null &
    log_success "Browser opened. If it didn't open, visit the URL above."
else
    log_info "Please visit the URL above in your browser."
fi

echo ""
