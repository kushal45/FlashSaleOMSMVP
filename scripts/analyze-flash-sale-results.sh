#!/bin/bash

# Flash Sale Test Results Analyzer
# Analyzes database state after load testing to show winner/loser distribution

echo "📊 FLASH SALE TEST RESULTS ANALYSIS"
echo "=================================="

# Get test results from database
echo "🏆 ORDER RESULTS:"
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Show order success/failure breakdown
SELECT 
    status,
    COUNT(*) as order_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM orders 
GROUP BY status
ORDER BY order_count DESC;
EOF

echo ""
echo "📦 FINAL STOCK LEVELS:"
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Show remaining stock after flash sale
SELECT 
    p.name,
    p.initial_stock,
    p.current_stock,
    (p.initial_stock - p.current_stock) as sold,
    CASE 
        WHEN p.current_stock = 0 THEN '🔴 SOLD OUT'
        WHEN p.current_stock < 10 THEN '🟡 LOW STOCK' 
        ELSE '🟢 Available'
    END as status,
    ROUND(((p.initial_stock - p.current_stock) * 100.0 / p.initial_stock), 2) as sold_percentage
FROM products p
WHERE p.flash_sale_active = true
ORDER BY sold DESC;
EOF

echo ""
echo "🥇 SUCCESSFUL BUYERS (Random Sample):"
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Show some successful orders
SELECT 
    o.user_id,
    p.name as product,
    o.quantity,
    o.created_at::timestamp(0) as order_time,
    '🎉' as result
FROM orders o
JOIN products p ON o.product_id = p.id  
WHERE o.status = 'confirmed'
ORDER BY o.created_at
LIMIT 10;
EOF

echo ""
echo "📈 FLASH SALE STATISTICS:"
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Overall flash sale metrics
SELECT 
    'Total Orders Attempted' as metric,
    COUNT(*) as value
FROM orders
UNION ALL
SELECT 
    'Successful Orders',
    COUNT(*) 
FROM orders WHERE status = 'confirmed'
UNION ALL
SELECT 
    'Failed Orders', 
    COUNT(*) 
FROM orders WHERE status = 'failed'
UNION ALL
SELECT 
    'Success Rate %',
    ROUND(
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) * 100.0 / COUNT(*), 
        2
    )
FROM orders;
EOF

echo ""
echo "⏱️  ORDER TIMING ANALYSIS:"
/Applications/Docker.app/Contents/Resources/bin/docker exec -i flash-sale-postgres psql -U postgres -d flash_sale_db << 'EOF'
-- Show order timing patterns
SELECT 
    DATE_TRUNC('second', created_at) as time_window,
    COUNT(*) as orders_per_second,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as successful_per_second
FROM orders
GROUP BY DATE_TRUNC('second', created_at)
ORDER BY orders_per_second DESC
LIMIT 5;
EOF

echo ""
echo "🎯 CONTENTION ANALYSIS:"
echo "This test simulates realistic flash sale conditions where:"
echo "• Hundreds of users compete for limited stock"
echo "• Only a small percentage succeed (realistic for hot items)" 
echo "• System must handle the load gracefully without crashing"
echo "• Stock is properly decremented atomically"
echo ""