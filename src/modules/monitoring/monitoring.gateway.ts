import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../../common/metrics/metrics.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
@Injectable()
export class MonitoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private activeConnections = new Set<string>();
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly metricsService: MetricsService,
    @InjectQueue('order-processing')
    private readonly orderQueue: Queue,
  ) {}

  handleConnection(client: Socket): void {
    this.activeConnections.add(client.id);
    this.metricsService.recordActiveConnections(this.activeConnections.size);
    this.logger.log(
      `Client connected: ${client.id}. Total connections: ${this.activeConnections.size}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.activeConnections.delete(client.id);
    this.metricsService.recordActiveConnections(this.activeConnections.size);

    // Clear interval for this client
    const interval = this.intervals.get(client.id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(client.id);
    }

    this.logger.log(
      `Client disconnected: ${client.id}. Total connections: ${this.activeConnections.size}`,
    );
  }

  @SubscribeMessage('subscribe-metrics')
  async handleSubscription(@ConnectedSocket() client: Socket): Promise<void> {
    // Clear existing interval if any
    const existingInterval = this.intervals.get(client.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Send initial metrics
    const metrics = await this.metricsService.getMetrics();
    client.emit('metrics-update', metrics);

    // Set up periodic updates
    const interval = setInterval(async () => {
      try {
        const currentMetrics = await this.metricsService.getMetrics();

        // Get queue stats
        const queueStats = await this.orderQueue.getJobCounts();
        const queueLength = queueStats.waiting + queueStats.active;

        // Record queue metrics
        await this.metricsService.recordQueueMetrics(
          queueLength,
          queueStats.active,
        );

        const enhancedMetrics = {
          ...currentMetrics,
          queueStats,
          queueLength,
        };

        client.emit('metrics-update', enhancedMetrics);
      } catch (error) {
        this.logger.error('Error sending metrics update:', error);
      }
    }, 1000); // Update every second

    this.intervals.set(client.id, interval);
  }

  @SubscribeMessage('unsubscribe-metrics')
  handleUnsubscription(@ConnectedSocket() client: Socket): void {
    const interval = this.intervals.get(client.id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(client.id);
    }
  }

  @SubscribeMessage('get-benchmark-report')
  async handleBenchmarkRequest(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const report = await this.metricsService.generateBenchmarkReport();
      client.emit('benchmark-report', report);
    } catch (error) {
      this.logger.error('Error generating benchmark report:', error);
      client.emit('benchmark-error', {
        message: 'Failed to generate benchmark report',
      });
    }
  }

  // Broadcast metrics to all connected clients
  async broadcastMetrics(): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    this.server.emit('metrics-broadcast', metrics);
  }
}