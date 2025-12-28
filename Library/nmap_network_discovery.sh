#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# NMAP NETWORK DISCOVERY - ONE LINE CHANGE
# Discovers all live hosts on a network
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.0/24"  # <-- CHANGE THIS TO YOUR TARGET NETWORK

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/nmap"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/discovery_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S)"

echo "════════════════════════════════════════════════════════"
echo "  NMAP NETWORK DISCOVERY"
echo "  Target: $TARGET"
echo "  Discovering live hosts..."
echo "════════════════════════════════════════════════════════"

# Check if nmap exists
if ! command -v nmap &>/dev/null; then
    echo "[!] Nmap not installed. Run: bash install.sh"
    exit 1
fi

# Execute network discovery
nmap -sn \
    -PE -PP -PS21,22,23,25,80,113,443,31339 \
    -PA80,113,443,10042 \
    --source-port 53 \
    -T4 \
    -oA "$OUTPUT_FILE" \
    -oN "$OUTPUT_FILE.txt" \
    "$TARGET"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  DISCOVERY COMPLETE"
echo "  Results saved to: $OUTPUT_FILE.*"
echo "════════════════════════════════════════════════════════"

# Show live hosts
if [ -f "$OUTPUT_FILE.txt" ]; then
    echo ""
    echo "Live hosts found:"
    grep "Nmap scan report" "$OUTPUT_FILE.txt" | awk '{print $NF}' | tr -d '()'
    
    host_count=$(grep -c "Nmap scan report" "$OUTPUT_FILE.txt")
    echo ""
    echo "Total: $host_count live hosts"
fi
