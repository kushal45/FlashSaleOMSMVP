# Distributed Locking Implementation

## Overview

The Flash Sale application uses Redis-based distributed locking to prevent race conditions during high-concurrency order placement, particularly to avoid overselling of inventory during flash sale events.

## Implementation Details

### Lock Strategy

The distributed locking is implemented at the order placement level in `OrdersService.placeOrder()`:

```typescript
const lockKey = `lock:product:${productId}:stock:${currentStock}`;
const lockTTL = this.configService.get<number>('LOCK_TTL') || 5000;
const lockAcquired = await this.redisClientProvider.acquireLock(lockKey, lockTTL);
```

### Lock Key Pattern

Lock keys follow the pattern: `lock:product:{productId}:stock:{currentStock}`

This ensures that:
- Each product has its own lock
- Stock level is part of the key for additional granularity
- Multiple products can be processed concurrently

### Lock TTL (Time To Live)

- Default TTL: 5000ms (5 seconds)
- Configurable via `LOCK_TTL` environment variable
- Automatic expiration prevents deadlocks
- Should be longer than typical order processing time

## Redis Client Configuration

### Connection Setup

```typescript
constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
  this.client = createClient({
    socket: {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    },
    password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
  });
  this.client.connect().catch(console.error);
}
```

### Lock Acquisition Logic

```typescript
async acquireLock(key: string, ttl: number): Promise<boolean> {
  const result = await this.client.set(key, 'locked', {
    PX: ttl,     // TTL in milliseconds
    NX: true     // Only set if key doesn't exist
  });
  return result === 'OK';
}
```

## High Availability with Redis Sentinel

### Sentinel Configuration

Docker Compose includes Redis Sentinel for high availability:

```yaml
redis-sentinel:
  image: bitnami/redis-sentinel:7.0
  environment:
    - REDIS_SENTINEL_QUORUM=2
    - REDIS_SENTINEL_DOWN_AFTER_MILLISECONDS=5000
    - REDIS_SENTINEL_FAILOVER_TIMEOUT=60000
```

### Benefits

- Automatic failover if Redis master fails
- Distributed consensus for master election
- Continuous availability during maintenance

## Order Processing Flow

### 1. Product Validation
- Check if product exists
- Verify flash sale is active
- Get current stock level

### 2. Lock Acquisition
```typescript
const lockAcquired = await this.redisClientProvider.acquireLock(lockKey, lockTTL);
if (!lockAcquired) {
  throw new BadRequestException('Unable to process order at this time');
}
```

### 3. Order Creation
- Create order record with PENDING status
- Save to database
- Add to processing queue

### 4. Lock Release
Locks are automatically released via TTL expiration. For explicit release:

```typescript
async releaseLock(key: string): Promise<boolean> {
  const result = await this.client.del(key);
  return result === 1;
}
```

## Best Practices

### Lock Granularity

- **Product-level locking**: Prevents overselling per product
- **Avoid global locks**: Would serialize all orders
- **Consider user locks**: For preventing duplicate orders from same user

### Error Handling

```typescript
try {
  const lockAcquired = await this.acquireLock(lockKey, lockTTL);
  if (!lockAcquired) {
    // Handle lock acquisition failure
    throw new BadRequestException('System busy, please try again');
  }
  
  // Critical section: order processing
  await this.processOrder(orderData);
  
} catch (error) {
  // Log error and handle gracefully
  this.logger.error('Order processing failed', error);
  throw error;
} finally {
  // Explicit lock release if needed
  await this.releaseLock(lockKey);
}
```

### Performance Considerations

1. **Lock TTL Tuning**
   - Too short: Risk of premature release
   - Too long: Increased wait time for failed processes

2. **Key Design**
   - Use consistent naming patterns
   - Include relevant identifiers
   - Avoid overly long keys

3. **Connection Pooling**
   - Use connection pooling for high throughput
   - Monitor connection usage
   - Handle connection failures gracefully

## Monitoring Lock Performance

### Metrics to Track

- Lock acquisition success rate
- Lock acquisition latency
- Lock hold time
- Lock contention events

### Redis Commands for Debugging

```bash
# Check active locks
redis-cli KEYS "lock:*"

# Check lock expiration
redis-cli TTL "lock:product:123:stock:100"

# Monitor commands
redis-cli MONITOR
```

## Alternative Locking Strategies

### Database-Level Locking

Pros:
- ACID guarantees
- Consistent with other transactions

Cons:
- Potential database bottleneck
- Limited scalability

### Application-Level Semaphores

Pros:
- In-memory performance
- Language-native constructs

Cons:
- Single instance limitation
- No persistence across restarts

### Message Queue Ordering

Pros:
- Natural serialization
- Durable processing

Cons:
- Increased latency
- Complex failure handling

## Troubleshooting

### Common Issues

1. **Lock Never Released**
   - Check TTL configuration
   - Monitor for application crashes
   - Verify explicit release calls

2. **High Lock Contention**
   - Analyze lock key patterns
   - Consider lock granularity
   - Monitor acquisition failure rates

3. **Redis Connection Issues**
   - Check Redis availability
   - Verify connection configuration
   - Monitor network connectivity

### Debugging Tools

```typescript
// Enable Redis command logging
const client = createClient({
  // ... other config
  commandsQueueMaxLength: 100,
  lazyConnect: true
});

client.on('connect', () => {
  console.log('Redis connected');
});

client.on('error', (error) => {
  console.error('Redis error:', error);
});
```

## Security Considerations

### Access Control

- Restrict Redis access to authorized services
- Use Redis AUTH if available
- Network-level security (VPC, firewall rules)

### Key Management

- Avoid sensitive data in lock keys
- Use consistent naming conventions
- Regular cleanup of expired keys

### Monitoring

- Track lock-related metrics
- Alert on unusual lock patterns
- Monitor Redis performance metrics