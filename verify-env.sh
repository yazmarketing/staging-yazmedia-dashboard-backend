#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Environment Verification Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found!${NC}"
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 LOCAL ENVIRONMENT (.env.local):${NC}"
echo "---"
LOCAL_NODE_ENV=$(grep "NODE_ENV" .env.local | cut -d '=' -f 2)
LOCAL_DB=$(grep "DATABASE_URL" .env.local | grep -o "localhost:[0-9]*" || echo "Not local")
LOCAL_PORT=$(grep "PORT" .env.local | cut -d '=' -f 2)
LOCAL_CORS=$(grep "CORS_ORIGIN" .env.local | cut -d '=' -f 2)

echo "NODE_ENV: $LOCAL_NODE_ENV"
echo "DATABASE: $LOCAL_DB"
echo "PORT: $LOCAL_PORT"
echo "CORS_ORIGIN: $LOCAL_CORS"

echo -e "\n${YELLOW}📋 PRODUCTION ENVIRONMENT (.env.production):${NC}"
echo "---"
PROD_NODE_ENV=$(grep "NODE_ENV" .env.production | cut -d '=' -f 2)
PROD_DB=$(grep "DATABASE_URL" .env.production | grep -o "ondigitalocean.com" || echo "Not production")
PROD_PORT=$(grep "PORT" .env.production | cut -d '=' -f 2)
PROD_CORS=$(grep "CORS_ORIGIN" .env.production | cut -d '=' -f 2)

echo "NODE_ENV: $PROD_NODE_ENV"
echo "DATABASE: $PROD_DB"
echo "PORT: $PROD_PORT"
echo "CORS_ORIGIN: $PROD_CORS"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Available Commands${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}✅ LOCAL DEVELOPMENT:${NC}"
echo "   npm run dev"
echo "   (Uses .env.local with localhost database)"

echo -e "\n${GREEN}✅ PRODUCTION:${NC}"
echo "   npm run dev:prod"
echo "   (Uses .env.production with DigitalOcean database)"

echo -e "\n${YELLOW}⚠️  SAFETY TIPS:${NC}"
echo "   1. Always verify NODE_ENV in console output"
echo "   2. Check database host before running migrations"
echo "   3. Never run 'npm run dev' if .env.local points to production"
echo "   4. Stop the server before switching environments"

echo -e "\n${BLUE}========================================${NC}\n"

