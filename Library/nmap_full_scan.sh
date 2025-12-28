#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# NMAP FULL PORT SCAN - ONE LINE CHANGE
# Scans ALL 65535 ports with service/version detection
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

OUTPUT_FILE="$OUTPUT_DIR/full_scan_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S)"

echo "════════════════════════════════════════════════════════"
echo "  NMAP FULL PORT SCAN"
echo "  Target: $TARGET"
echo "  Scanning ALL 65535 ports..."
echo "════════════════════════════════════════════════════════"

# Check if nmap exists
if ! command -v nmap &>/dev/null; then
    echo "[!] Nmap not installed. Run: bash install.sh"
    exit 1
fi

# Execute full port scan
nmap -p- \
    -sV \
    -sC \
    -T4 \
    -A \
    --open \
    -oA "$OUTPUT_FILE" \
    -oN "$OUTPUT_FILE.txt" \
    "$TARGET"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  SCAN COMPLETE"
echo "  Results saved to: $OUTPUT_FILE.*"
echo "════════════════════════════════════════════════════════"

# Show summary
if [ -f "$OUTPUT_FILE.txt" ]; then
    echo ""
    echo "Open ports found:"
    grep "^[0-9]" "$OUTPUT_FILE.txt" | grep "open"
fi
