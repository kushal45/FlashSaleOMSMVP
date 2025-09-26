import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { Order, OrderStatus } from '../../database/entities';
import { InventoryService } from '../inventory/inventory.service';
import { RedisClientProvider } from 'src/common/redis/redis-client.provider';
import { OrderQueueJobData } from './interfaces/orders.interface';

@Injectable()
@Processor('order-processing')
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
    private readonly redisClientProvider: RedisClientProvider,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { orderId, productId, quantity, currentStock } =
      job.data as OrderQueueJobData;

    this.logger.log(
      `Processing order ${orderId} for product ${productId}, quantity: ${quantity}`,
    );

    // Use database transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update order status to processing
      await queryRunner.manager.update(Order, orderId, {
        status: OrderStatus.PROCESSING,
      });
      // Check and reserve inventory atomically
      const reservationSuccess = await this.inventoryService.reserveInventory(
        productId,
        quantity,
        queryRunner,
      );

      if (!reservationSuccess) {
        // Insufficient inventory
        await queryRunner.manager.update(Order, orderId, {
          status: OrderStatus.FAILED,
        });

        await queryRunner.commitTransaction();
        this.logger.warn(`Order ${orderId} failed - insufficient inventory`);

        return { success: false, reason: 'Insufficient inventory' };
      }

      // Confirm the order
      await queryRunner.manager.update(Order, orderId, {
        status: OrderStatus.CONFIRMED,
        reservedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes to complete
      });

      // Define lockKey before releasing the lock
      const lockKey = `lock:product:${productId}:stock:${currentStock}`;
      await this.redisClientProvider.releaseLock(lockKey);
      await queryRunner.commitTransaction();
      this.logger.log(`Order ${orderId} confirmed successfully`);

      return { success: true, orderId };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Update order status to failed
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
      });

      this.logger.error(`Order ${orderId} processing failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${err.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }
}
