# Flash Sale Backend API Documentation

## Architecture Overview

The Flash Sale backend is built with NestJS and implements a robust system for handling high-concurrency flash sale events with distributed Redis locking, queue management, and comprehensive monitoring.

## Core Components

### 1. Orders Module (`src/modules/orders/`)

Handles order placement, processing, and status tracking.

**Key Files:**
- `orders.service.ts` - Business logic with Redis distributed locking
- `orders.controller.ts` - REST API endpoints
- `orders.processor.ts` - Background job processing
- `orders.module.ts` - Module configuration

### 2. Inventory Module (`src/modules/inventory/`)

Manages product inventory and stock levels.

### 3. Monitoring Module (`src/modules/monitoring/`)

Provides real-time metrics and monitoring capabilities.

### 4. Queue Module (`src/modules/queue/`)

Manages background job processing with BullMQ.

## Configuration

### Database Configuration (`src/config/database.config.ts`)
PostgreSQL configuration with TypeORM integration.

### Redis Configuration (`src/config/redis.config.ts`)
Redis connection settings for both BullMQ queues and distributed locking.

## Common Utilities

### Redis Client Provider (`src/common/redis/`)
Abstraction layer for Redis operations with ConfigService integration.

### Metrics System (`src/common/metrics/`)
Comprehensive metrics collection and reporting system.

## API Endpoints

### Orders
- `POST /orders` - Place a new order
- `GET /orders/:id` - Get order status
- `GET /orders/queue/:jobId` - Check queue status
- `GET /orders/user/:userId` - Get user's orders
- `GET /orders/admin/metrics` - Administrative metrics

### Monitoring
- `GET /monitoring/metrics` - Current system metrics
- `GET /monitoring/benchmark` - Performance benchmarks
- `GET /monitoring/health` - Health check

### Inventory
- `GET /inventory/:productId` - Get product inventory
- `PUT /inventory/:productId` - Update inventory levels

## Environment Variables

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=flash_sale_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
PORT=3000
NODE_ENV=development

# Monitoring
FRONTEND_URL=http://localhost:3001

# Distributed Locking
LOCK_TTL=5000
```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start infrastructure:**
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Run migrations:**
   ```bash
   npm run migration:run
   ```

4. **Start development server:**
   ```bash
   npm run start:dev
   ```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Deployment

1. **Build application:**
   ```bash
   npm run build
   ```

2. **Start with Docker:**
   ```bash
   docker-compose up -d
   ```


## Load Testing

Artillery configuration available in `load-test/artillery.yml` for performance testing.

## Monitoring Integration

The application exposes metrics compatible with Prometheus and includes WebSocket streaming for real-time monitoring dashboards.