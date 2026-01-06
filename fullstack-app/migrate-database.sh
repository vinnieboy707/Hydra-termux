#!/bin/bash
# Database Migration Script
# Applies database schema to PostgreSQL or Supabase

# Note: Not using 'set -e' to allow graceful error handling and user interaction

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Database Migration Tool                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --type <postgres|supabase>  Database type (default: postgres)"
    echo "  --host <hostname>           Database host (for postgres)"
    echo "  --port <port>              Database port (default: 5432)"
    echo "  --user <username>          Database user (default: postgres)"
    echo "  --db <database>            Database name (default: hydra_termux)"
    echo "  --password <password>      Database password"
    echo "  --file <schema_file>       Schema file to apply"
    echo "  --help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --type postgres --host localhost --password mypass"
    echo "  $0 --type supabase"
    echo ""
}

# Default values
DB_TYPE="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="hydra_termux"
DB_PASSWORD=""
SCHEMA_FILE="backend/schema/complete-database-schema.sql"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DB_TYPE="$2"
            shift 2
            ;;
        --host)
            DB_HOST="$2"
            shift 2
            ;;
        --port)
            DB_PORT="$2"
            shift 2
            ;;
        --user)
            DB_USER="$2"
            shift 2
            ;;
        --db)
            DB_NAME="$2"
            shift 2
            ;;
        --password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --file)
            SCHEMA_FILE="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}✗ Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Schema file found: $SCHEMA_FILE${NC}"

# Migration for Supabase
if [ "$DB_TYPE" = "supabase" ]; then
    echo ""
    echo "Migrating to Supabase..."
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}✗ Supabase CLI not found${NC}"
        echo "Install with: npm install -g supabase"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Supabase CLI found${NC}"
    
    # Check authentication
    if ! supabase projects list &> /dev/null; then
        echo -e "${YELLOW}⚠ Not logged in to Supabase${NC}"
        echo "Please login:"
        supabase login
    fi
    
    echo ""
    echo "Applying schema to Supabase..."
    
    # Apply schema
    if supabase db push; then
        echo -e "${GREEN}✓ Schema applied successfully to Supabase${NC}"
    else
        echo -e "${RED}✗ Failed to apply schema to Supabase${NC}"
        exit 1
    fi
    
# Migration for PostgreSQL
elif [ "$DB_TYPE" = "postgres" ]; then
    echo ""
    echo "Migrating to PostgreSQL..."
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}✗ PostgreSQL client (psql) not found${NC}"
        echo "Install PostgreSQL client to continue"
        exit 1
    fi
    
    echo -e "${GREEN}✓ PostgreSQL client found${NC}"
    
    # Prompt for password if not provided
    if [ -z "$DB_PASSWORD" ]; then
        echo ""
        read -s -p "Enter PostgreSQL password for user $DB_USER: " DB_PASSWORD
        echo ""
    fi
    
    # Test connection
    echo ""
    echo "Testing database connection..."
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" &> /dev/null; then
        echo -e "${GREEN}✓ Connected to database successfully${NC}"
    else
        echo -e "${RED}✗ Failed to connect to database${NC}"
        echo "Please check your connection parameters"
        exit 1
    fi
    
    # Apply schema
    echo ""
    echo "Applying schema to PostgreSQL..."
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"; then
        echo ""
        echo -e "${GREEN}✓ Schema applied successfully to PostgreSQL${NC}"
    else
        echo ""
        echo -e "${RED}✗ Failed to apply schema to PostgreSQL${NC}"
        exit 1
    fi
    
    unset PGPASSWORD
else
    echo -e "${RED}✗ Unknown database type: $DB_TYPE${NC}"
    echo "Supported types: postgres, supabase"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Database migration completed successfully! ✓     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Show next steps
echo "Next steps:"
if [ "$DB_TYPE" = "supabase" ]; then
    echo "1. Verify schema in Supabase dashboard"
    echo "2. Set Row Level Security (RLS) policies"
    echo "3. Configure authentication providers"
    echo "4. Test database connection from backend"
else
    echo "1. Configure backend .env file:"
    echo "   DB_TYPE=postgres"
    echo "   POSTGRES_HOST=$DB_HOST"
    echo "   POSTGRES_PORT=$DB_PORT"
    echo "   POSTGRES_USER=$DB_USER"
    echo "   POSTGRES_DB=$DB_NAME"
    echo "   POSTGRES_PASSWORD=<your_password>"
    echo ""
    echo "2. Test backend connection"
    echo "3. Create initial admin user"
fi
echo ""
