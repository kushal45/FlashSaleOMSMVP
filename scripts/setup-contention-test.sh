#!/bin/bash

# Flash Sale Contention Test Setup Script
# This script sets up products with very limited stock to maximize contention

set -e

echo "🔧 Setting up Flash Sale Contention Test Environment..."

# Set Docker path
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Current stock levels before setup:${NC}"
docker compose exec postgres psql -U postgres -d flash_sale_db -c "SELECT id, name, current_stock FROM products ORDER BY id;"

echo -e "${YELLOW}🗑️  Clearing existing orders and resetting stock...${NC}"

# Clear all existing orders
docker compose exec postgres psql -U postgres -d flash_sale_db -c "DELETE FROM orders;"

# Reset all product stock to create different contention scenarios
docker compose exec postgres psql -U postgres -d flash_sale_db -c "
UPDATE products SET 
  current_stock = CASE 
    WHEN id = 1 THEN 5    -- iPhone: EXTREME contention (5 units for 500+ users)
    WHEN id = 2 THEN 10   -- Samsung: HIGH contention (10 units) 
    WHEN id = 3 THEN 2    -- MacBook: MAXIMUM contention (2 units)
    WHEN id = 5 THEN 1    -- Apple Watch: SINGLE UNIT contention
    ELSE current_stock    -- Others unchanged
  END,
  initial_stock = current_stock
WHERE id IN (1, 2, 3, 5);
"

echo -e "${GREEN}✅ Stock levels configured for maximum contention testing:${NC}"
docker compose exec postgres psql -U postgres -d flash_sale_db -c "
SELECT 
  id, 
  name, 
  current_stock as stock,
  CASE 
    WHEN current_stock = 1 THEN '🔥 MAXIMUM CONTENTION'
    WHEN current_stock <= 5 THEN '⚡ EXTREME CONTENTION' 
    WHEN current_stock <= 10 THEN '🚀 HIGH CONTENTION'
    ELSE '✅ NORMAL'
  END as contention_level
FROM products 
WHERE flash_sale_active = true 
ORDER BY current_stock;
"

echo -e "${BLUE}🔄 Clearing Redis locks and queues...${NC}"

# Clear Redis locks and queue data
docker compose exec redis redis-cli FLUSHALL

echo -e "${YELLOW}📈 Expected contention scenarios:${NC}"
echo -e "  🎯 ${RED}Apple Watch (1 unit)${NC}: 100% will fight for single item"
echo -e "  🎯 ${RED}MacBook (2 units)${NC}: ~99% will get lock contention"  
echo -e "  🎯 ${YELLOW}iPhone (5 units)${NC}: ~95% will get lock contention"
echo -e "  🎯 ${BLUE}Samsung (10 units)${NC}: ~90% will get lock contention"

echo -e "${GREEN}🚀 Contention test environment ready!${NC}"
echo -e "${YELLOW}📋 Recommended test commands:${NC}"
echo -e "  • ${BLUE}npm run contention:hyper${NC}     - Maximum contention on single product"
echo -e "  • ${BLUE}npm run contention:limited${NC}   - Limited stock scenarios"
echo -e "  • ${BLUE}npm run contention:single-unit${NC} - Single unit contention test"

echo ""
echo -e "${RED}⚠️  WARNING: These tests are designed to create lock contention!${NC}"
echo -e "${RED}   Most users will get 'High demand! Please try again.' errors${NC}"
echo -e "${RED}   This is EXPECTED BEHAVIOR for testing distributed locking!${NC}"