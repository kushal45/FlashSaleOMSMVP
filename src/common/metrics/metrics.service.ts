import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientProvider } from '../redis/redis-client.provider';
import { MetricsData } from '../interfaces/metrics.interface';

export interface BenchmarkReport {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  peakConcurrency: number;
  testDuration: number;
}

@Injectable()
export class MetricsService {
  private readonly metricsPrefix = 'flash_sale_metrics';
  
  constructor(
    private readonly redisClient: RedisClientProvider,
    private readonly configService: ConfigService,
  ) {}

  async recordOrderLatency(latency: number): Promise<void> {
    const key = `${this.metricsPrefix}:order_latency`;
    await this.redisClient.getClient().lPush(key, latency.toString());
    await this.redisClient.getClient().lTrim(key, 0, 999); // Keep last 1000 entries
    await this.redisClient.getClient().expire(key, 3600); // 1 hour TTL
  }

  async recordRequestLatency(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ): Promise<void> {
    const key = `${this.metricsPrefix}:request_latency:${method}:${route}`;
    await this.redisClient.getClient().lPush(key, duration.toString());
    await this.redisClient.getClient().lTrim(key, 0, 999);
    await this.redisClient.getClient().expire(key, 3600);

    // Also record in general latency for overall metrics
    const generalKey = `${this.metricsPrefix}:request_latency_all`;
    await this.redisClient.getClient().lPush(generalKey, duration.toString());
    await this.redisClient.getClient().lTrim(generalKey, 0, 999);
    await this.redisClient.getClient().expire(generalKey, 3600);
  }

  async recordRequestCount(
    method: string,
    route: string,
    statusCode: number,
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const key = `${this.metricsPrefix}:request_count:${method}:${route}:${statusCode}:${timestamp}`;
    await this.redisClient.getClient().incr(key);
    await this.redisClient.getClient().expire(key, 3600);

    // Also increment total request counter
    const totalKey = `${this.metricsPrefix}:total_requests`;
    await this.redisClient.getClient().incr(totalKey);
    await this.redisClient.getClient().expire(totalKey, 3600);
  }

  async recordError(
    method: string,
    route: string,
    errorType: string,
  ): Promise<void> {
    const key = `${this.metricsPrefix}:errors:${method}:${route}:${errorType}`;
    await this.redisClient.getClient().incr(key);
    await this.redisClient.getClient().expire(key, 3600);

    // Also increment total error counter
    const totalKey = `${this.metricsPrefix}:total_errors`;
    await this.redisClient.getClient().incr(totalKey);
    await this.redisClient.getClient().expire(totalKey, 3600);
  }

  async updateThroughput(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const key = `${this.metricsPrefix}:throughput:${timestamp}`;
    await this.redisClient.getClient().incr(key);
    await this.redisClient.getClient().expire(key, 3600);
  }

  async recordThroughput(ordersPerSecond: number): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const key = `${this.metricsPrefix}:throughput:${timestamp}`;
    await this.redisClient
      .getClient()
      .set(key, ordersPerSecond.toString(), { EX: 3600 });
  }

  async recordOrderStatus(status: 'success' | 'failed' | 'pending'): Promise<void> {
    const key = `${this.metricsPrefix}:order_status:${status}`;
    await this.redisClient.getClient().incr(key);
    await this.redisClient.getClient().expire(key, 3600);
  }

  async recordQueueMetrics(
    queueLength: number,
    activeJobs: number,
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const client = this.redisClient.getClient();

    await client.set(
      `${this.metricsPrefix}:queue_length:${timestamp}`,
      queueLength.toString(),
      { EX: 3600 },
    );
    await client.set(
      `${this.metricsPrefix}:active_jobs:${timestamp}`,
      activeJobs.toString(),
      { EX: 3600 },
    );
  }

  async recordInventoryLevel(productId: number, stock: number): Promise<void> {
    const key = `${this.metricsPrefix}:inventory:${productId}`;
    await this.redisClient
      .getClient()
      .set(key, stock.toString(), { EX: 3600 });
  }

  async recordProcessingTime(processingTime: number): Promise<void> {
    const key = `${this.metricsPrefix}:processing_time`;
    await this.redisClient.getClient().lPush(key, processingTime.toString());
    await this.redisClient.getClient().lTrim(key, 0, 999);
    await this.redisClient.getClient().expire(key, 3600);
  }

  async recordActiveConnections(count: number): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const key = `${this.metricsPrefix}:active_connections:${timestamp}`;
    await this.redisClient.getClient().set(key, count.toString(), { EX: 3600 });
  }

  async getMetrics(): Promise<MetricsData> {
    const timestamp = Date.now();
    const currentTimestamp = Math.floor(timestamp / 1000);
    const client = this.redisClient.getClient();
    
    // Get latest metrics
    const [
      queueLength,
      activeJobs,
      successfulOrders,
      failedOrders,
      pendingOrders,
      activeConnections,
      processingTimes,
      throughput
    ] = await Promise.all([
      client.get(`${this.metricsPrefix}:queue_length:${currentTimestamp}`),
      client.get(`${this.metricsPrefix}:active_jobs:${currentTimestamp}`),
      client.get(`${this.metricsPrefix}:order_status:success`),
      client.get(`${this.metricsPrefix}:order_status:failed`),
      client.get(`${this.metricsPrefix}:order_status:pending`),
      client.get(`${this.metricsPrefix}:active_connections:${currentTimestamp}`),
      client.lRange(`${this.metricsPrefix}:processing_time`, 0, 99),
      client.get(`${this.metricsPrefix}:throughput:${currentTimestamp}`)
    ]);
    
    const parsedQueueLength = parseInt(queueLength || '0');
    const parsedActiveJobs = parseInt(activeJobs || '0');
    const parsedSuccessfulOrders = parseInt(successfulOrders || '0');
    const parsedFailedOrders = parseInt(failedOrders || '0');
    const parsedPendingOrders = parseInt(pendingOrders || '0');
    const parsedActiveConnections = parseInt(activeConnections || '0');
    const parsedThroughput = parseInt(throughput || '0');
    
    // Calculate average processing time
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + parseInt(time), 0) / processingTimes.length
      : 0;
    
    // Calculate error rate
    const totalOrders = parsedSuccessfulOrders + parsedFailedOrders;
    const errorRate = totalOrders > 0 ? (parsedFailedOrders / totalOrders) * 100 : 0;
    
    // Get inventory levels for all products
    const inventoryKeys = await client.keys(`${this.metricsPrefix}:inventory:*`);
    const inventoryLevels: Record<string, number> = {};
    
    for (const key of inventoryKeys) {
      const productId = key.split(':').pop();
      const stock = await client.get(key);
      if (productId && stock) {
        inventoryLevels[productId] = parseInt(stock);
      }
    }
    
    return {
      timestamp,
      queueLength: parsedQueueLength + parsedActiveJobs,
      ordersPerSecond: parsedThroughput,
      inventoryLevels,
      errorRate,
      activeConnections: parsedActiveConnections,
      averageProcessingTime: avgProcessingTime,
      throughput: parsedThroughput,
      successfulOrders: parsedSuccessfulOrders,
      failedOrders: parsedFailedOrders,
      pendingOrders: parsedPendingOrders,
    };
  }

  async generateBenchmarkReport(): Promise<BenchmarkReport> {
    const client = this.redisClient.getClient();
    const latencies = await client.lRange(`${this.metricsPrefix}:order_latency`, 0, -1);
    const latencyNumbers = latencies.map(l => parseInt(l)).sort((a, b) => a - b);
    
    const successfulOrders = parseInt(await client.get(`${this.metricsPrefix}:order_status:success`) || '0');
    const failedOrders = parseInt(await client.get(`${this.metricsPrefix}:order_status:failed`) || '0');
    const totalRequests = successfulOrders + failedOrders;
    
    const averageLatency = latencyNumbers.length > 0 
      ? latencyNumbers.reduce((sum, l) => sum + l, 0) / latencyNumbers.length 
      : 0;
    
    const p95Index = Math.floor(latencyNumbers.length * 0.95);
    const p99Index = Math.floor(latencyNumbers.length * 0.99);
    
    const p95Latency = latencyNumbers[p95Index] || 0;
    const p99Latency = latencyNumbers[p99Index] || 0;
    
    const errorRate = totalRequests > 0 ? (failedOrders / totalRequests) * 100 : 0;
    
    // Get throughput data from last hour
    const throughputKeys = await client.keys(`${this.metricsPrefix}:throughput:*`);
    const throughputValues = await Promise.all(
      throughputKeys.map(key => client.get(key))
    );
    
    const avgThroughput = throughputValues.length > 0 
      ? throughputValues.reduce((sum, val) => sum + parseInt(val || '0'), 0) / throughputValues.length
      : 0;
    
    return {
      totalRequests,
      successfulRequests: successfulOrders,
      failedRequests: failedOrders,
      averageLatency,
      p95Latency,
      p99Latency,
      throughput: avgThroughput,
      errorRate,
      peakConcurrency: 0, // This would need to be tracked separately
      testDuration: 0, // This would need to be tracked separately
    };
  }

  async clearMetrics(): Promise<void> {
    const keys = await this.redisClient.getClient().keys(`${this.metricsPrefix}:*`);
    if (keys.length > 0) {
      await this.redisClient.getClient().del(keys);
    }
  }
}