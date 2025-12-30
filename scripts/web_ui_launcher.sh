#!/bin/bash

# Web UI Launcher for Hydra-Termux
# Starts a local web server for the configuration interface

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_UI_DIR="$PROJECT_ROOT/web_ui"

# Source logger
source "$SCRIPT_DIR/logger.sh"

# Default port
PORT=8080

# Function to display help
show_help() {
    print_banner "Web UI Launcher"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT    Port number (default: 8080)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                 # Start on default port 8080"
    echo "  $0 -p 9090         # Start on port 9090"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
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

# Check if Python is installed
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    log_error "Python is not installed. Installing..."
    pkg install python -y
fi

# Determine Python command
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Check if web_ui directory exists
if [ ! -d "$WEB_UI_DIR" ]; then
    log_error "Web UI directory not found: $WEB_UI_DIR"
    exit 1
fi

# Display banner
clear
print_banner "Hydra-Termux Web Configuration"
echo ""
log_info "Starting web server..."
log_info "Web UI Directory: $WEB_UI_DIR"
log_info "Port: $PORT"
echo ""
print_message "════════════════════════════════════════════════" "$CYAN"
print_message "  🌐 Access the Web UI at:" "$GREEN"
print_message "     http://localhost:$PORT" "$YELLOW"
print_message "     http://127.0.0.1:$PORT" "$YELLOW"
echo ""
log_info "If you're using Termux on Android:"
print_message "  1. Open your browser (Chrome, Firefox, etc.)" "$CYAN"
print_message "  2. Go to: http://localhost:$PORT" "$YELLOW"
print_message "  3. Configure your attack parameters" "$CYAN"
print_message "  4. Copy the generated command" "$CYAN"
print_message "  5. Paste it in Termux to execute" "$CYAN"
echo ""
print_message "════════════════════════════════════════════════" "$CYAN"
echo ""
log_warning "Press Ctrl+C to stop the server"
echo ""

# Start Python HTTP server
cd "$WEB_UI_DIR"

# Check Python version and use appropriate method
if $PYTHON_CMD -c "import sys; exit(0 if sys.version_info >= (3,0) else 1)" 2>/dev/null; then
    # Python 3
    $PYTHON_CMD -m http.server $PORT
else
    # Python 2
    $PYTHON_CMD -m SimpleHTTPServer $PORT
fi
