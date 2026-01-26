#!/bin/bash

# ============================================================================
# HYDRA-TERMUX SUPREME FEATURES MIGRATION SCRIPT
# Migrates database with all new supreme features
# ============================================================================

set -e

echo "=================================================="
echo "  HYDRA-TERMUX SUPREME FEATURES MIGRATION"
echo "=================================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo "⚠️  Warning: .env file not found. Using defaults."
fi

# Database connection parameters
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-hydra_termux}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD}

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: PostgreSQL client (psql) not found"
    echo "Please install PostgreSQL client tools first"
    exit 1
fi

# Function to execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2
    
    echo "📋 Executing: $description"
    
    if [ ! -f "$file" ]; then
        echo "❌ Error: SQL file not found: $file"
        return 1
    fi
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$file"
    
    if [ $? -eq 0 ]; then
        echo "✅ Success: $description"
        return 0
    else
        echo "❌ Failed: $description"
        return 1
    fi
}

# Backup existing database
echo "📦 Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "❌ Backup failed!"
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 Starting migration..."
echo ""

# Execute base schema if needed
if [ -f "backend/schema/complete-database-schema.sql" ]; then
    echo "Checking if base schema exists..."
    TABLE_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');")
    
    if [ "$TABLE_EXISTS" != "t" ]; then
        execute_sql_file "backend/schema/complete-database-schema.sql" "Base database schema"
        echo ""
    else
        echo "✓ Base schema already exists, skipping..."
        echo ""
    fi
fi

# Execute supreme features schema
execute_sql_file "backend/schema/supreme-features-schema.sql" "Supreme features schema"
echo ""

# Verify tables were created
echo "🔍 Verifying table creation..."

TABLES=(
    "email_ip_attacks"
    "supreme_combo_attacks"
    "combo_attack_results"
    "email_infrastructure_intel"
    "api_endpoints_tested"
    "cloud_service_attacks"
    "active_directory_attacks"
    "web_application_attacks"
    "attack_analytics"
    "credential_vault"
    "notification_settings"
)

ALL_TABLES_EXIST=true

for table in "${TABLES[@]}"; do
    EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');")
    
    if [ "$EXISTS" = "t" ]; then
        echo "  ✅ $table"
    else
        echo "  ❌ $table (NOT FOUND)"
        ALL_TABLES_EXIST=false
    fi
done

echo ""

if [ "$ALL_TABLES_EXIST" = true ]; then
    echo "=================================================="
    echo "  ✅ MIGRATION COMPLETED SUCCESSFULLY!"
    echo "=================================================="
    echo ""
    echo "New features available:"
    echo "  • Email-IP penetration testing"
    echo "  • Supreme combo attacks"
    echo "  • DNS intelligence gathering"
    echo "  • Attack analytics & reporting"
    echo "  • Credential vault management"
    echo "  • Cloud service attacks"
    echo "  • Active Directory attacks"
    echo "  • Web application attacks"
    echo ""
    echo "Backup file: $BACKUP_FILE"
    echo ""
else
    echo "=================================================="
    echo "  ⚠️  MIGRATION COMPLETED WITH WARNINGS"
    echo "=================================================="
    echo ""
    echo "Some tables may not have been created properly."
    echo "Please check the errors above and retry if needed."
    echo ""
    echo "To restore from backup:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME < $BACKUP_FILE"
    echo ""
fi

# Create initial notification settings for existing users
echo "📧 Setting up notification settings for existing users..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
INSERT INTO notification_settings (user_id, email_enabled, discord_enabled)
SELECT id, TRUE, FALSE FROM users
ON CONFLICT (user_id) DO NOTHING;
" &> /dev/null

echo "✅ Notification settings initialized"
echo ""

# Display statistics
echo "📊 Database Statistics:"
USER_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM users;")
echo "  Users: $USER_COUNT"

ATTACK_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM attacks;" 2>/dev/null || echo "0")
echo "  Legacy Attacks: $ATTACK_COUNT"

echo ""
echo "Next steps:"
echo "  1. Update your backend routes (already done if using provided files)"
echo "  2. Deploy Supabase edge functions"
echo "  3. Update frontend components"
echo "  4. Configure notification webhooks in user settings"
echo ""
echo "For more information, see:"
echo "  - API_DOCUMENTATION.md"
echo "  - SUPREME_FEATURES_GUIDE.md"
echo ""
