#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# SSL/TLS CERTIFICATE ANALYZER - ONE LINE CHANGE
# Analyzes SSL/TLS certificates and security
# ═══════════════════════════════════════════════════════════════════

TARGET="example.com"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
PORT=443
OUTPUT_DIR="$PROJECT_ROOT/results/ssl"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/ssl_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).txt"

echo "════════════════════════════════════════════════════════"
echo "  SSL/TLS CERTIFICATE ANALYZER"
echo "  Target: $TARGET:$PORT"
echo "════════════════════════════════════════════════════════"

# Check if openssl exists
if ! command -v openssl &>/dev/null; then
    echo "[!] OpenSSL not installed. Run: pkg install openssl"
    exit 1
fi

{
    echo "═══ SSL/TLS Analysis for $TARGET ═══"
    echo "Date: $(date)"
    echo ""
    
    echo "─── Certificate Information ───"
    echo | openssl s_client -connect "$TARGET:$PORT" -servername "$TARGET" 2>/dev/null | openssl x509 -noout -text
    
    echo ""
    echo "─── Certificate Chain ───"
    echo | openssl s_client -connect "$TARGET:$PORT" -servername "$TARGET" -showcerts 2>/dev/null
    
    echo ""
    echo "─── Supported Ciphers ───"
    nmap --script ssl-enum-ciphers -p "$PORT" "$TARGET" 2>/dev/null || echo "Nmap not available for cipher scan"
    
    echo ""
    echo "─── SSL/TLS Vulnerabilities ───"
    nmap --script ssl-* -p "$PORT" "$TARGET" 2>/dev/null || echo "Nmap not available for vulnerability scan"
    
} | tee "$OUTPUT_FILE"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ANALYSIS COMPLETE"
echo "  Results saved to: $OUTPUT_FILE"
echo "════════════════════════════════════════════════════════"
