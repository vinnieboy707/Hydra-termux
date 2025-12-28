#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# NMAP VULNERABILITY SCAN - ONE LINE CHANGE
# Scans for known vulnerabilities using NSE scripts
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

OUTPUT_FILE="$OUTPUT_DIR/vuln_scan_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S)"

echo "════════════════════════════════════════════════════════"
echo "  NMAP VULNERABILITY SCAN"
echo "  Target: $TARGET"
echo "  Checking for known vulnerabilities..."
echo "════════════════════════════════════════════════════════"

# Check if nmap exists
if ! command -v nmap &>/dev/null; then
    echo "[!] Nmap not installed. Run: bash install.sh"
    exit 1
fi

# Execute vulnerability scan
nmap -sV \
    --script vuln \
    --script-args=unsafe=1 \
    -T4 \
    -oA "$OUTPUT_FILE" \
    -oN "$OUTPUT_FILE.txt" \
    "$TARGET"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  VULNERABILITY SCAN COMPLETE"
echo "  Results saved to: $OUTPUT_FILE.*"
echo "════════════════════════════════════════════════════════"

# Show vulnerabilities found
if [ -f "$OUTPUT_FILE.txt" ]; then
    echo ""
    echo "Vulnerabilities found:"
    grep -i "VULNERABLE" "$OUTPUT_FILE.txt" || echo "  No vulnerabilities detected"
fi
