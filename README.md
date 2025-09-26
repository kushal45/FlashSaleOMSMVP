# Flash Sale Backend MVP

A high-performance, scalable backend system for handling flash sales with real-time monitoring and benchmarking capabilities.

## 🚀 Features

- **Queue-Based Order Processing**: Uses BullMQ with Redis for reliable order processing
- **Atomic Inventory Management**: Prevents overselling with database-level atomic operations
- **Real-Time Monitoring**: WebSocket-based live metrics and system health monitoring
- **Rate Limiting**: Built-in throttling to handle high-concurrency scenarios
- **Load Testing Ready**: Includes Artillery configuration for performance testing
- **Scalable Architecture**: Modular design with separate services for orders, inventory, and monitoring

## 🏗️ Architecture

```
┌─────────────┐           ┌─────────────┐           ┌───────────┐
│ REST APIs   │<--HTTP--->│  NestJS API │<--BullMQ->│   Redis   │
└─────▲───────┘           └─────▲───────┘           └─────▲─────┘
      │         ┌─────────────┐        │         ┌─────────────┐
      └<--WS----│ Monitoring  │<--API--┘         │ PostgreSQL  │
                └─────────────┘                  └─────────────┘
```

## 📋 Prerequisites

- Node.js (v18+)
- PostgreSQL (v13+)
- Redis (v6+)
- npm or yarn

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Edit .env with your database and Redis configurations
   ```

3. **Start required services:**

   **Option A: Using Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

   **Option B: Local services**
   ```bash
   # Start PostgreSQL
   pg_ctl start
   
   # Start Redis
   redis-server
   
   # Create database
   createdb flash_sale_db
   ```

4. **Setup the database:**
   ```bash
   # Run migrations and seed data in one command
   npm run db:setup
   
   # Or run individually:
   npm run migration:run  # Apply database migrations
   npm run seed          # Populate with sample data
   ```

5. **Start the application:**
   ```bash
   npm run start:dev
   ```

## 🗃️ Database Management

### Database Schema

The application uses PostgreSQL with TypeORM for database management. The schema includes:

**Products Table:**
- `id` - Primary key (auto-increment)
- `name` - Product name (VARCHAR 255)
- `initial_stock` - Initial inventory count
- `current_stock` - Current available inventory
- `price` - Product price (DECIMAL 10,2)
- `flash_sale_active` - Flash sale status (BOOLEAN)
- `created_at` - Creation timestamp

**Orders Table:**
- `id` - Primary key (auto-increment)
- `user_id` - User identifier (VARCHAR 255)
- `product_id` - Foreign key to products table
- `quantity` - Number of items ordered
- `status` - Order status (pending, confirmed, failed, cancelled)
- `created_at` - Order creation timestamp
- `updated_at` - Last update timestamp

### Migration Commands

```bash
# Setup database (migrations + seeding)
npm run db:setup

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Drop entire schema (⚠️  destructive!)
npm run schema:drop

# Seed database with sample data
npm run seed
```

### Sample Data

The seeding script creates 5 sample products perfect for flash sale testing:

- **iPhone 15 Pro** - $999.99 (Flash Sale Active)
- **Samsung Galaxy S24** - $799.99 (Flash Sale Active)
- **MacBook Air M3** - $1299.99 (Flash Sale Active)
- **Sony WH-1000XM5** - $349.99 (Regular Price)
- **Apple Watch Series 9** - $399.99 (Flash Sale Active)

### Database Verification

```bash
# Connect to PostgreSQL container
docker exec -it flash-sale-postgres psql -U postgres -d flash_sale_db

# Check products
SELECT id, name, flash_sale_active, current_stock FROM products;

# Check orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
```

## 🎯 API Endpoints

### Orders
- `POST /api/v1/orders` - Place a new order
- `GET /api/v1/orders/:id` - Get order status
- `GET /api/v1/orders/queue/:jobId` - Get queue status
- `GET /api/v1/orders/user/:userId` - Get user's orders
- `GET /api/v1/orders/admin/metrics` - Get order metrics

### Inventory
- `GET /api/v1/inventory` - List all products
- `GET /api/v1/inventory/:id` - Get specific product
- `POST /api/v1/inventory` - Create new product
- `PUT /api/v1/inventory/:id` - Update product
- `GET /api/v1/inventory/metrics` - Get inventory metrics

### Monitoring
- `GET /api/v1/monitoring/metrics` - Get current system metrics
- `GET /api/v1/monitoring/metrics/history` - Get metrics history
- `GET /api/v1/monitoring/benchmark` - Get benchmark report
- `POST /api/v1/monitoring/metrics/reset` - Reset metrics

### WebSocket Events
Connect to `ws://localhost:3000/monitoring` for real-time updates:

- `metrics-update` - Real-time system metrics
- `order-update` - Order status changes
- `inventory-update` - Stock level changes
- `system-alert` - System alerts and warnings

## 🧪 Testing

### Load Testing with Artillery

1. **Install Artillery:**
   ```bash
   npm install -g artillery
   ```

2. **Run load tests:**
   ```bash
   artillery run load-test/artillery.yml
   ```

### Example API Calls

**Place an Order:**
```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "userId": "user123",
    "quantity": 2
  }'
```

**Check Queue Status:**
```bash
curl http://localhost:3000/api/v1/orders/queue/{jobId}
```

**Get System Metrics:**
```bash
curl http://localhost:3000/api/v1/monitoring/metrics
```

## 📊 Performance Features

### Queue Management
- **Concurrent Processing**: Multiple workers process orders simultaneously
- **Retry Logic**: Failed orders are automatically retried with exponential backoff
- **Priority Queuing**: Critical orders can be prioritized
- **Dead Letter Queue**: Failed orders are captured for analysis

### Inventory Protection
- **Atomic Updates**: Database-level atomic operations prevent race conditions
- **Pessimistic Locking**: Ensures consistency during high-concurrency scenarios
- **Stock Reservation**: Orders reserve stock immediately upon queuing

### Real-Time Monitoring
- **System Metrics**: CPU, memory, response times
- **Business Metrics**: Orders per second, conversion rates, queue depths
- **Error Tracking**: Real-time error rates and failure analysis
- **Performance Dashboards**: Live visualization of system performance

## 🔧 Configuration

### Environment Variables

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=flash_sale_db
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Configuration
PORT=3000
NODE_ENV=development
```

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Start services**: `docker-compose up -d`
4. **Setup database**: `npm run db:setup`
5. **Start application**: `npm run start:dev`
6. **Test the API**: Visit `http://localhost:3000/api/v1/inventory`
7. **Monitor real-time**: Connect to `ws://localhost:3000/monitoring`

## 📈 Load Testing

Run the included Artillery load test to simulate flash sale conditions:

```bash
artillery run load-test/artillery.yml
```

This will simulate:
- 30s warm-up phase (5 req/s)
- 60s ramp-up (10→50 req/s)
- 120s peak load (100 req/s)
- 60s stress test (200 req/s)

## 🔄 Development

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Run tests
npm run test

# Database management
npm run db:setup        # Setup database (migration + seed)
npm run migration:run   # Run pending migrations
npm run migration:revert # Revert last migration  
npm run seed           # Seed with sample data
```

## 📚 Architecture

Built following the planning specifications with:
- **NestJS** - Scalable Node.js framework
- **PostgreSQL** - ACID compliant database with TypeORM migrations
- **Redis + BullMQ** - Queue management
- **WebSockets** - Real-time monitoring
- **TypeORM** - Database ORM with migration system
- **Artillery** - Load testing

## 🎯 Flash Sale Visual Load Testing

### 📋 Quick Start

```bash
# 1. Setup and run standard flash sale test
npm run flash-sale:test

# 2. Run extreme load test with visual reports
npm run flash-sale:extreme-visual

# 3. Open real-time monitoring dashboard
npm run flash-sale:monitor

# 4. View Grafana monitoring (requires Docker services)
npm run grafana:dashboard
```

### 🔄 Load Testing Scenarios

#### Standard Flash Sale Test (`artillery.yml`)
- **Users**: 200 concurrent users per second
- **Duration**: 5 minutes sustained load
- **Target**: Limited inventory simulation
- **Focus**: Realistic e-commerce behavior

#### Extreme Flash Sale Test (`flash-sale-extreme.yml`)  
- **Users**: 500 concurrent users per second
- **Duration**: 3 minutes intense burst
- **Target**: Stress testing under extreme conditions
- **Focus**: System breaking point analysis

### 📊 Visual Monitoring Options

#### 1. Real-Time HTML Dashboard (`npm run flash-sale:monitor`)
- **Features**: Live WebSocket updates, real-time charts, product stock levels
- **Access**: Opens `monitoring/flash-sale-monitor.html` in browser
- **Data**: Connects to app WebSocket at `ws://localhost:3001/monitoring`

#### 2. Artillery HTML Reports (`npm run flash-sale:visual`)
- **Output**: `load-test/reports/flash-sale-*.html`
- **Features**: Response time graphs, success/failure rates, detailed metrics

#### 3. Grafana Dashboards (`npm run grafana:dashboard`)
- **Access**: http://localhost:3000/d/flash-sale/flash-sale-monitoring
- **Features**: Real-time metrics, historical data, alert capabilities
- **Login**: `admin` / `admin`

### 🎛️ Monitoring Stack

| Service | URL | Purpose |
|---------|-----|---------|
| **Application** | http://localhost:3001 | Main flash sale API |
| **Grafana** | http://localhost:3000 | Visual dashboards & monitoring |
| **Prometheus** | http://localhost:9090 | Metrics collection & storage |
| **Redis** | localhost:6379 | Caching & session management |
| **PostgreSQL** | localhost:5432 | Primary database |

### 📈 Key Metrics Tracked

#### Application Performance
- **Orders per Second**: Real-time order processing rate
- **Success Rate**: Percentage of successful order completions  
- **Response Time**: Average API response latency
- **Queue Depth**: Background job queue length

#### System Resources
- **Memory Usage**: Application memory consumption
- **CPU Usage**: Processor utilization
- **Database Connections**: Active PostgreSQL connections
- **Redis Operations**: Cache hit/miss rates

#### Business Metrics
- **Stock Levels**: Real-time inventory tracking
- **Revenue**: Total sales during flash sale
- **User Concurrency**: Active users at any time
- **Conversion Rate**: Visitors to successful purchases

### 🚨 Flash Sale Testing Commands

```bash
# Complete visual load testing workflow
npm run loadtest:setup          # Reset database & prepare test data
npm run loadtest:visual         # Run standard test with HTML report  
npm run loadtest:extreme-visual # Run extreme test with HTML report
npm run monitoring:all          # Open all monitoring dashboards
npm run analyze:results         # Generate comprehensive analysis
```

### 🔥 Contention Testing (Advanced)

```bash
# Setup limited stock scenarios for maximum contention
npm run contention:setup

# Single unit contention (1 unit vs 1000 users)
npm run contention:single-unit-visual

# Limited stock contention (5 units vs 1500 users)
npm run contention:limited-visual  

# Hypercontention (all users target same product)
npm run contention:hyper-visual

# Full contention test suite
npm run contention:full-test
```

**📋 Expected Results:**
- **Success Rate**: 0.1-1% (realistic flash sale behavior)
- **Lock Contention**: 99%+ users get "High demand! Please try again." 
- **System Integrity**: No overselling, perfect inventory control
- **Performance**: <3ms response times even under extreme load

**📖 Detailed Analysis:** See [`docs/FLASH_SALE_TESTING_ANALYSIS.md`](docs/FLASH_SALE_TESTING_ANALYSIS.md)

---

**Ready for flash sale load testing and benchmarking! 🚀**
