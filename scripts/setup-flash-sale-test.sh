#!/bin/bash

# Flash Sale Load Test Setup Script
# Prepares database with limited stock for realistic flash sale testing

echo "🔄 Preparing Flash Sale Test Environment..."

# Reset database to clean state
echo "📊 Dropping and recreating database schema..."
npm run schema:drop
npm run migration:run

echo "🏪 Setting up limited stock flash sale scenario..."

# Create limited stock scenario using direct SQL
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Insert products with very limited stock for extreme contention
INSERT INTO products (name, initial_stock, current_stock, price, flash_sale_active) VALUES 
('FLASH: iPhone 15 Pro (LIMITED)', 50, 50, 999.99, true),
('FLASH: Samsung Galaxy S24 (LIMITED)', 30, 30, 799.99, true),  
('FLASH: MacBook Air M3 (LIMITED)', 20, 20, 1299.99, true),
('REGULAR: Sony WH-1000XM5', 1000, 1000, 349.99, false),
('FLASH: Apple Watch Series 9 (LIMITED)', 40, 40, 399.99, true);

-- Show current stock levels
SELECT 
    id, 
    name, 
    current_stock, 
    flash_sale_active,
    CASE WHEN flash_sale_active THEN '🔥 FLASH SALE' ELSE '⚪ Regular' END as status
FROM products 
ORDER BY flash_sale_active DESC, current_stock ASC;
EOF

echo ""
echo "✅ Flash Sale Test Environment Ready!"
echo "📊 Stock Levels:"
echo "   • iPhone 15 Pro: 50 units (HIGH CONTENTION)"
echo "   • Samsung Galaxy S24: 30 units"  
echo "   • MacBook Air M3: 20 units"
echo "   • Apple Watch: 40 units"
echo ""
echo "🚀 Run load tests with:"
echo "   artillery run load-test/artillery.yml              # Standard flash sale"
echo "   artillery run load-test/flash-sale-extreme.yml     # Extreme contention"
echo ""