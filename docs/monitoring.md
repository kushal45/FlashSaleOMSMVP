# Flash Sale Monitoring & Metrics Documentation

## Overview

The Flash Sale application includes a comprehensive monitoring and metrics system built with Redis for metrics storage, Prometheus for data collection, and Grafana for visualization. This system provides real-time insights into order processing, queue status, inventory levels, and system performance during high-traffic flash sale events.

## Architecture Components

### 1. MetricsService (`src/common/metrics/metrics.service.ts`)

The core service responsible for collecting, storing, and retrieving metrics data using Redis as the backend storage.

**Key Features:**
- Order latency tracking
- Throughput measurements
- Queue metrics monitoring  
- Inventory level tracking
- Error rate calculation
- Benchmark report generation

**Metrics Stored:**
- `flash_sale_metrics:order_latency` - List of order processing times
- `flash_sale_metrics:throughput:{timestamp}` - Orders per second at specific times
- `flash_sale_metrics:order_status:{status}` - Counters for success/failed/pending orders
- `flash_sale_metrics:queue_length:{timestamp}` - Queue length snapshots
- `flash_sale_metrics:inventory:{productId}` - Current stock levels per product
- `flash_sale_metrics:processing_time` - Order processing durations
- `flash_sale_metrics:active_connections:{timestamp}` - WebSocket connection counts

### 2. MonitoringGateway (`src/modules/monitoring/monitoring.gateway.ts`)

WebSocket gateway providing real-time metrics streaming to connected clients.

**Endpoints:**
- `subscribe-metrics` - Subscribe to real-time metrics updates
- `unsubscribe-metrics` - Stop receiving metrics updates
- `get-benchmark-report` - Request performance benchmark data

**Features:**
- Per-client interval management
- Automatic cleanup on disconnect
- Queue statistics integration
- Error handling and logging

### 3. MonitoringController (`src/modules/monitoring/monitoring.controller.ts`)

REST API endpoints for metrics access and management.

**Endpoints:**
- `GET /monitoring/metrics` - Current system metrics
- `GET /monitoring/benchmark` - Performance benchmark report
- `GET /monitoring/health` - Service health check
- `POST /monitoring/metrics/clear` - Clear all metrics data

## Docker Compose Configuration

The monitoring stack includes several services:

### Core Services
- **Redis** - Metrics storage and distributed locking
- **Redis Sentinel** - High availability for Redis
- **Postgres** - Application data storage

### Monitoring Stack
- **Prometheus** (port 9090) - Metrics collection and storage
- **Grafana** (port 3000) - Metrics visualization dashboards
- **Redis Exporter** (port 9121) - Redis metrics for Prometheus
- **Node Exporter** (port 9100) - System metrics collection

### Management Tools
- **Redis Commander** (port 8081) - Redis database management interface

## Configuration Files

### Prometheus Configuration (`monitoring/prometheus.yml`)

Defines scraping targets for metrics collection:

```yaml
scrape_configs:
  - job_name: 'flash-sale-backend'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/monitoring/metrics'
    scrape_interval: 5s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 5s
```

### Grafana Configuration

- **Datasource**: `monitoring/grafana/provisioning/datasources/prometheus.yml`
- **Dashboard Provider**: `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- **Flash Sale Dashboard**: `monitoring/grafana/dashboards/flash-sale-dashboard.json`

## Usage Guide

### Starting the Monitoring Stack

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Access monitoring interfaces:**
   - Grafana Dashboard: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090
   - Redis Commander: http://localhost:8081

### Monitoring Flash Sale Events

1. **Real-time WebSocket Connection:**
   ```javascript
   const socket = io('http://localhost:3000');
   socket.emit('subscribe-metrics');
   socket.on('metrics-update', (data) => {
     console.log('Current metrics:', data);
   });
   ```

2. **REST API Usage:**
   ```bash
   # Get current metrics
   curl http://localhost:3000/monitoring/metrics
   
   # Get benchmark report
   curl http://localhost:3000/monitoring/benchmark
   
   # Health check
   curl http://localhost:3000/monitoring/health
   ```

### Key Metrics to Monitor

1. **Order Processing:**
   - Order throughput (orders/second)
   - Order latency (average, p95, p99)
   - Order status distribution
   - Error rates

2. **Queue Performance:**
   - Queue length
   - Active jobs count
   - Processing time

3. **Inventory Management:**
   - Stock levels per product
   - Inventory depletion rate

4. **System Health:**
   - Active connections
   - Memory usage
   - CPU utilization

## Grafana Dashboard

The Flash Sale Dashboard (`flash-sale-dashboard.json`) includes:

### Panels:
1. **Order Status Distribution** - Pie chart showing successful vs failed orders
2. **Order Throughput** - Time series of orders per second
3. **Current Queue Length** - Gauge showing queue backlog
4. **Order Processing Latency** - Average and 95th percentile latency
5. **Inventory Levels** - Real-time stock levels per product
6. **Error Rate** - Percentage of failed orders

### Dashboard Features:
- 5-second refresh rate
- 15-minute time window
- Dark theme optimized for monitoring
- Responsive layout for different screen sizes

## Performance Considerations

### Redis Configuration
- TTL set to 1 hour for most metrics
- List trimming to prevent memory bloat
- Efficient key naming for fast lookups

### WebSocket Optimization
- Per-client interval management
- Automatic cleanup on disconnect
- Error handling to prevent memory leaks

### Prometheus Scraping
- 5-second intervals for critical metrics
- 30-second intervals for less frequent data
- Efficient metric endpoints

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Grafana:**
   - Check Prometheus targets are UP
   - Verify datasource configuration
   - Ensure application is exposing metrics endpoint

2. **WebSocket connection issues:**
   - Check CORS configuration
   - Verify port accessibility
   - Monitor connection logs

3. **Redis connection failures:**
   - Verify Redis service is running
   - Check connection configuration
   - Monitor Redis logs for errors

### Debugging Commands

```bash
# Check Docker services status
docker-compose ps

# View service logs
docker-compose logs prometheus
docker-compose logs grafana
docker-compose logs redis

# Test metrics endpoint
curl http://localhost:3000/monitoring/health

# Check Redis data
redis-cli -h localhost -p 6379
KEYS flash_sale_metrics:*
```

## Security Considerations

- Grafana admin credentials should be changed in production
- Redis should be configured with authentication
- Network access should be restricted to necessary services only
- Metrics endpoints may contain sensitive performance data

## Extension Points

The monitoring system can be extended with:

1. **Additional Metrics:**
   - Custom business metrics
   - Application-specific KPIs
   - Third-party service metrics

2. **Alerting:**
   - Prometheus AlertManager integration
   - Slack/email notifications
   - Custom alert rules

3. **Long-term Storage:**
   - InfluxDB integration
   - Time-series data archival
   - Historical trend analysis

4. **Advanced Dashboards:**
   - Custom Grafana panels
   - Multi-environment monitoring
   - User-specific dashboards