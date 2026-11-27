#!/bin/bash
set -e

# Hydra-Termux Docker Entrypoint Script
# Handles initialization, health checks, and error recovery

echo "🚀 Starting Hydra-Termux in Docker..."

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local max_attempts=30
    local attempt=0

    echo "⏳ Waiting for $host:$port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "✅ $host:$port is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo "❌ Timeout waiting for $host:$port"
    return 1
}

# Function to initialize database
init_database() {
    echo "📊 Initializing database..."
    
    cd /app/fullstack-app/backend || exit 1
    
    # Run migrations if database exists
    if [ -f "schema/supreme-features-schema.sql" ]; then
        echo "Running database migrations..."
        if command -v psql &> /dev/null && [ "$DATABASE_URL" != "sqlite:./database.sqlite" ]; then
            # PostgreSQL migrations
            psql "$DATABASE_URL" < schema/supreme-features-schema.sql || echo "⚠️ Migration may have already run"
        else
            # SQLite migrations
            sqlite3 database.sqlite < schema/supreme-features-schema.sql 2>/dev/null || echo "⚠️ Migration may have already run"
        fi
    fi
    
    echo "✅ Database initialized"
}

# Function to check and fix permissions
fix_permissions() {
    echo "🔧 Fixing permissions..."
    
    # Ensure directories are writable
    for dir in /app/results /app/logs /data /app/wordlists; do
        if [ -d "$dir" ]; then
            chmod 755 "$dir" 2>/dev/null || true
        fi
    done
    
    # Ensure scripts are executable
    find /app -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    echo "✅ Permissions fixed"
}

# Function to create required files
create_required_files() {
    echo "📝 Creating required files..."
    
    # Create .env if it doesn't exist
    if [ ! -f /app/fullstack-app/backend/.env ]; then
        cp /app/fullstack-app/backend/.env.example /app/fullstack-app/backend/.env 2>/dev/null || true
    fi
    
    # Create necessary directories
    mkdir -p /app/results /app/logs /app/wordlists /data/backups
    
    echo "✅ Required files created"
}

# Main initialization
main() {
    echo "🎯 Hydra-Termux Docker Initialization"
    echo "===================================="
    
    # Fix permissions
    fix_permissions
    
    # Create required files
    create_required_files
    
    # Wait for database if using PostgreSQL
    if [[ "$DATABASE_URL" == postgresql://* ]]; then
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        wait_for_service "${DB_HOST:-postgres}" "${DB_PORT:-5432}" || exit 1
    fi
    
    # Wait for Redis if configured
    if [ -n "$REDIS_URL" ]; then
        REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
        wait_for_service "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" || echo "⚠️ Redis not available, continuing..."
    fi
    
    # Initialize database
    init_database
    
    # Show configuration
    echo ""
    echo "📋 Configuration:"
    echo "  NODE_ENV: ${NODE_ENV:-production}"
    echo "  PORT: ${PORT:-3000}"
    echo "  DATABASE: ${DATABASE_URL:-sqlite:./database.sqlite}"
    echo ""
    
    # Display legal disclaimer
    if [ -f /app/LEGAL_DISCLAIMER.md ]; then
        echo "⚖️  Legal Disclaimer:"
        echo "   Please review /app/LEGAL_DISCLAIMER.md"
        echo "   By using this tool, you accept all terms and conditions."
        echo ""
    fi
    
    echo "✅ Initialization complete"
    echo "🚀 Starting application..."
    echo ""
    
    # Execute the command passed to docker run
    exec "$@"
}

# Run main function
main
