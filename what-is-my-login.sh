#!/bin/bash

# Quick access to login credentials helper
# Usage: ./what-is-my-login.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/scripts/show_login_info.sh"
