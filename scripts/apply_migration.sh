#!/bin/bash
# Script to apply the deliveries_bras schema migration
# This fixes the critical bug where delivery tracking was completely broken

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Deliveries Schema Migration ===${NC}"
echo ""
echo "This migration will:"
echo "  1. Rename 'date' → 'valid_from' (integer → date)"
echo "  2. Rename 'timestamp' → 'delivery_timestamp'"
echo "  3. Add PRIMARY KEY constraint (prevents duplicate deliveries)"
echo "  4. Add performance indexes"
echo "  5. Add foreign key constraints"
echo ""
echo -e "${RED}WARNING: Any existing data in deliveries_bras will be affected.${NC}"
echo -e "${RED}However, this table should be empty due to the schema bug.${NC}"
echo ""

# Get database connection details
read -p "Database host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database name: " DB_NAME
read -p "Database user: " DB_USER
read -sp "Database password: " DB_PASSWORD
echo ""

# Check if we can connect
echo -e "\n${YELLOW}Testing database connection...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to connect to database.${NC}"
    exit 1
fi

echo -e "${GREEN}Connected successfully.${NC}"

# Show current schema
echo -e "\n${YELLOW}Current deliveries_bras schema:${NC}"
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "\d deliveries_bras"

# Check for existing data
echo -e "\n${YELLOW}Checking for existing data...${NC}"
ROW_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM deliveries_bras;")
echo "Found $ROW_COUNT rows in deliveries_bras"

if [ "$ROW_COUNT" -gt 0 ]; then
    echo -e "${RED}WARNING: Table contains data that will be lost!${NC}"
    read -p "Continue anyway? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Migration cancelled."
        exit 1
    fi
fi

# Apply migration
echo -e "\n${YELLOW}Applying migration...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/migrate_deliveries_schema.sql"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Migration completed successfully!${NC}"

    # Show new schema
    echo -e "\n${YELLOW}New deliveries_bras schema:${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "\d deliveries_bras"

    echo -e "\n${GREEN}✓ Delivery tracking is now fixed!${NC}"
    echo "The cron job will now:"
    echo "  ✓ Track all deliveries correctly"
    echo "  ✓ Retry failed deliveries on next run"
    echo "  ✓ Never send duplicate bulletins"
else
    echo -e "${RED}Migration failed!${NC}"
    exit 1
fi
