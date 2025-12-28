#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# WEB HEADER ANALYZER - ONE LINE CHANGE
# Analyzes HTTP headers for security issues
# ═══════════════════════════════════════════════════════════════════

TARGET="https://example.com"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/web"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/headers_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).txt"

echo "════════════════════════════════════════════════════════"
echo "  WEB HEADER SECURITY ANALYZER"
echo "  Target: $TARGET"
echo "════════════════════════════════════════════════════════"

# Check if curl exists
if ! command -v curl &>/dev/null; then
    echo "[!] Curl not installed. Run: pkg install curl"
    exit 1
fi

{
    echo "═══ HTTP Header Analysis for $TARGET ═══"
    echo "Date: $(date)"
    echo ""
    
    echo "─── Response Headers ───"
    curl -I -L --max-time 10 "$TARGET" 2>/dev/null
    
    echo ""
    echo "─── Security Header Analysis ───"
    
    headers=$(curl -I -L -s --max-time 10 "$TARGET" 2>/dev/null)
    
    # Check for security headers
    echo "Checking security headers..."
    
    if echo "$headers" | grep -qi "X-Frame-Options"; then
        echo "[+] X-Frame-Options: Present"
    else
        echo "[-] X-Frame-Options: MISSING (Clickjacking risk)"
    fi
    
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        echo "[+] X-Content-Type-Options: Present"
    else
        echo "[-] X-Content-Type-Options: MISSING (MIME sniffing risk)"
    fi
    
    if echo "$headers" | grep -qi "Strict-Transport-Security"; then
        echo "[+] Strict-Transport-Security: Present"
    else
        echo "[-] Strict-Transport-Security: MISSING (HTTPS not enforced)"
    fi
    
    if echo "$headers" | grep -qi "Content-Security-Policy"; then
        echo "[+] Content-Security-Policy: Present"
    else
        echo "[-] Content-Security-Policy: MISSING (XSS risk)"
    fi
    
    if echo "$headers" | grep -qi "X-XSS-Protection"; then
        echo "[+] X-XSS-Protection: Present"
    else
        echo "[-] X-XSS-Protection: MISSING"
    fi
    
    echo ""
    echo "─── Server Information ───"
    echo "$headers" | grep -i "Server:"
    echo "$headers" | grep -i "X-Powered-By:"
    
    echo ""
    echo "─── Cookies ───"
    echo "$headers" | grep -i "Set-Cookie:"
    
} | tee "$OUTPUT_FILE"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ANALYSIS COMPLETE"
echo "  Results saved to: $OUTPUT_FILE"
echo "════════════════════════════════════════════════════════"
