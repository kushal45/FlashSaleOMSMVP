import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Order, OrderStatus, Product } from '../../database/entities';
import { CreateOrderDto, OrderResponseDto } from './dto/create-order.dto';
import { RedlockService } from '../../common/redis/redlock.service';
import {
  OrderMetrics,
  OrderQueueJobData,
  QueueStatus,
} from './interfaces/orders.interface';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from 'src/common/metrics/metrics.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectQueue('order-processing')
    private readonly orderQueue: Queue,
    private readonly redlockService: RedlockService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  async placeOrder(createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    try {
      const { productId, userId, quantity } = createOrderDto;

      // Check if product exists and is available for flash sale
      const product = await this.productRepository.findOne({
        where: { id: productId },
      });
      if (!product) {
        // Record failed order metric
        await this.metricsService.recordOrderStatus('failed');
        throw new NotFoundException('Product not found');
      }

      if (!product.flashSaleActive) {
        // Record failed order metric
        await this.metricsService.recordOrderStatus('failed');
        throw new BadRequestException(
          'Product is not available for flash sale',
        );
      }

      /**
       * Best Practice: Two-Phase Locking for Overselling Prevention
       * 1. Acquire lock here to check stock availability atomically
       * 2. If stock is available, create order and queue for processing
       * 3. Worker will re-acquire the same lock before inventory operations
       * 4. This ensures maximum accuracy in preventing overselling
       */
      const currentStock = product.currentStock;

      // Early stock check to fail fast if no stock available
      if (currentStock < quantity) {
        await this.metricsService.recordOrderStatus('failed');
        throw new BadRequestException('Insufficient stock available');
      }

      const lockKey = `lock:product:${productId}`;
      const lockTTL = parseInt(
        this.configService.get<string>('LOCK_TTL', '10000'),
        10,
      ); // Ensure integer conversion

      // Acquire lock to ensure atomic stock check and order creation
      const lockAcquired = await this.redlockService.acquireLock(
        lockKey,
        lockTTL,
      );
      if (!lockAcquired) {
        // Record failed order metric
        await this.metricsService.recordOrderStatus('failed');
        throw new BadRequestException('High demand! Please try again.');
      }

      // Double-check stock under lock (race condition protection)
      const freshProduct = await this.productRepository.findOne({
        where: { id: productId },
      });
      if (!freshProduct || freshProduct.currentStock < quantity) {
        await this.redlockService.releaseLock(lockAcquired);
        await this.metricsService.recordOrderStatus('failed');
        throw new BadRequestException('Insufficient stock available');
      }

      // Create order record
      const order = this.orderRepository.create({
        productId,
        userId,
        quantity,
        status: OrderStatus.PENDING,
      });

      const savedOrder = await this.orderRepository.save(order);

      // Release the lock after order creation but before queuing
      await this.redlockService.releaseLock(lockAcquired);

      const orderData = {
        orderId: savedOrder.id,
        productId,
        userId,
        quantity,
        currentStock: freshProduct.currentStock,
        timestamp: Date.now(),
        lockKey,
        lockTTL,
      } as OrderQueueJobData;
      // Add to queue for processing
      const job = await this.orderQueue.add('process-order', orderData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      // Update order with job ID
      savedOrder.jobId = job.id as string;
      await this.orderRepository.save(savedOrder);

      // Record order status metric (pending)
      await this.metricsService.recordOrderStatus('pending');

      // Record inventory level metric
      await this.metricsService.recordInventoryLevel(
        productId,
        product.currentStock,
      );

      // Record processing time metric (simulate as 0 for now, update in processor)
      await this.metricsService.recordProcessingTime(0);

      // Calculate queue position and estimated wait time
      const queuePosition = await this.getQueuePosition(job.id as string);
      const estimatedWaitTime = queuePosition * 2; // Assuming 2 seconds per order

      return {
        jobId: job.id as string,
        orderId: savedOrder.id,
        queuePosition,
        estimatedWaitTime,
      };
    } catch (error) {
      // Record failed order metric for any unexpected error
      await this.metricsService.recordOrderStatus('failed');
      throw error;
    }
  }

  async getOrderStatus(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getQueueStatus(jobId: string): Promise<any> {
    const job = await this.orderQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const queuePosition = await this.getQueuePosition(jobId);

    return {
      jobId,
      status: await job.getState(),
      progress: job.progress,
      queuePosition,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      failedReason: job.failedReason ?? null,
    } as QueueStatus;
  }

  private async getQueuePosition(jobId: string): Promise<number> {
    const waitingJobs = await this.orderQueue.getWaiting();
    const activeJobs = await this.orderQueue.getActive();

    const waitingPosition = waitingJobs.findIndex((job) => job.id === jobId);

    if (waitingPosition !== -1) {
      return activeJobs.length + waitingPosition + 1;
    }

    const activePosition = activeJobs.findIndex((job) => job.id === jobId);
    if (activePosition !== -1) {
      return activePosition + 1;
    }

    return 0; // Job is completed or not found
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderMetrics(): Promise<any> {
    const totalOrders = await this.orderRepository.count();
    const confirmedOrders = await this.orderRepository.count({
      where: { status: OrderStatus.CONFIRMED },
    });
    const failedOrders = await this.orderRepository.count({
      where: { status: OrderStatus.FAILED },
    });
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });

    const queueStats = await this.orderQueue.getJobCounts();

    return {
      totalOrders,
      confirmedOrders,
      failedOrders,
      pendingOrders,
      queueStats,
    } as OrderMetrics;
  }
}
