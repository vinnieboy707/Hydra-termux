#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# WEB DIRECTORY BRUTE-FORCE - ONE LINE CHANGE
# Discovers hidden directories and files
# ═══════════════════════════════════════════════════════════════════

TARGET="http://example.com"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Auto-source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
WORDLIST="$PROJECT_ROOT/config/web_directories.txt"
OUTPUT_DIR="$PROJECT_ROOT/results/web"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/dirbrute_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).txt"

echo "════════════════════════════════════════════════════════"
echo "  WEB DIRECTORY BRUTE-FORCE"
echo "  Target: $TARGET"
echo "════════════════════════════════════════════════════════"

# Create wordlist if missing
if [ ! -f "$WORDLIST" ]; then
    cat > "$WORDLIST" << 'EOF'
admin
administrator
login
wp-admin
phpmyadmin
cpanel
dashboard
manager
backup
config
uploads
images
js
css
api
test
dev
.git
.env
robots.txt
sitemap.xml
wp-config.php
EOF
fi

# Check if curl exists
if ! command -v curl &>/dev/null; then
    echo "[!] Curl not installed. Run: pkg install curl"
    exit 1
fi

echo "Starting directory brute-force..."
echo "" | tee "$OUTPUT_FILE"

while IFS= read -r dir; do
    url="$TARGET/$dir"
    response=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 "$url" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
        echo "[+] Found [$response]: $url" | tee -a "$OUTPUT_FILE"
    elif [ "$response" = "403" ]; then
        echo "[!] Forbidden [$response]: $url" | tee -a "$OUTPUT_FILE"
    fi
done < "$WORDLIST"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  BRUTE-FORCE COMPLETE"
echo "  Results saved to: $OUTPUT_FILE"
echo "════════════════════════════════════════════════════════"
