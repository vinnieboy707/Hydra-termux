#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# NMAP OS DETECTION - ONE LINE CHANGE
# Detects operating system and version
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.1"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/nmap"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/os_detect_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S)"

echo "════════════════════════════════════════════════════════"
echo "  NMAP OS DETECTION"
echo "  Target: $TARGET"
echo "  Detecting operating system..."
echo "════════════════════════════════════════════════════════"

# Check if nmap exists
if ! command -v nmap &>/dev/null; then
    echo "[!] Nmap not installed. Run: bash install.sh"
    exit 1
fi

# Execute OS detection
nmap -O \
    --osscan-guess \
    --max-os-tries 3 \
    -sV \
    -T4 \
    -oA "$OUTPUT_FILE" \
    -oN "$OUTPUT_FILE.txt" \
    "$TARGET"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  OS DETECTION COMPLETE"
echo "  Results saved to: $OUTPUT_FILE.*"
echo "════════════════════════════════════════════════════════"

# Show OS info
if [ -f "$OUTPUT_FILE.txt" ]; then
    echo ""
    echo "Operating System:"
    grep "OS:" "$OUTPUT_FILE.txt" || grep "Running:" "$OUTPUT_FILE.txt"
fi
