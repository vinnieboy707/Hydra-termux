#!/bin/bash

# Post-start script for dev container
# Runs every time the container starts

set -e

echo "🔄 Running post-start tasks..."

# Ensure proper permissions
sudo chown -R vscode:vscode /workspace/results /workspace/logs /workspace/wordlists 2>/dev/null || true

# Start background services if needed
# (Most services are handled by docker-compose)

# Check database connectivity
if command -v psql &> /dev/null; then
    echo "🗄️  Checking database connection..."
    until PGPASSWORD=hydra_dev_pass psql -h postgres-dev -U hydra_dev -d hydra_dev_db -c '\q' 2>/dev/null; do
        echo "⏳ Waiting for PostgreSQL..."
        sleep 2
    done
    echo "✅ PostgreSQL is ready"
fi

# Check Redis connectivity
if command -v redis-cli &> /dev/null; then
    echo "📮 Checking Redis connection..."
    until redis-cli -h redis-dev ping &>/dev/null; do
        echo "⏳ Waiting for Redis..."
        sleep 2
    done
    echo "✅ Redis is ready"
fi

# Display status
echo ""
echo "✅ Development environment is ready!"
echo "💡 Run 'onboard-dev' for development-specific onboarding"
