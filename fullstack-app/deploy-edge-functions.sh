#!/bin/bash
# Supabase Edge Functions Deployment Script
# Deploys all edge functions to Supabase

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Supabase Edge Functions Deployment               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo "Install using the official instructions: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"

# Check if we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}✗ supabase/functions directory not found${NC}"
    echo "Please run this script from the fullstack-app directory"
    exit 1
fi

# Login check
echo ""
echo "Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to Supabase${NC}"
    echo "Please login:"
    supabase login
fi

echo -e "${GREEN}✓ Authenticated with Supabase${NC}"

# List available functions
echo ""
echo "Available edge functions:"
for func in supabase/functions/*; do
    if [ -d "$func" ]; then
        func_name=$(basename "$func")
        echo "  - $func_name"
    fi
done

# Deploy each function
echo ""
echo "Deploying edge functions..."
echo ""

# Deploy attack-webhook
echo -e "${YELLOW}Deploying attack-webhook...${NC}"
if supabase functions deploy attack-webhook --no-verify-jwt; then
    echo -e "${GREEN}✓ attack-webhook deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy attack-webhook${NC}"
    exit 1
fi

# Deploy cleanup-sessions
echo ""
echo -e "${YELLOW}Deploying cleanup-sessions...${NC}"
if supabase functions deploy cleanup-sessions --no-verify-jwt; then
    echo -e "${GREEN}✓ cleanup-sessions deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy cleanup-sessions${NC}"
    exit 1
fi

# Deploy send-notification
echo ""
echo -e "${YELLOW}Deploying send-notification...${NC}"
if supabase functions deploy send-notification --no-verify-jwt; then
    echo -e "${GREEN}✓ send-notification deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy send-notification${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All edge functions deployed successfully! ✓      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# List deployed functions
echo "Listing deployed functions:"
supabase functions list

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Set environment variables for each function in Supabase dashboard"
echo "2. Test functions using 'supabase functions invoke <function-name>'"
echo "3. Monitor function logs in Supabase dashboard"
echo ""
