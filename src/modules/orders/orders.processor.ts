import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { Order, OrderStatus } from '../../database/entities';
import { InventoryService } from '../inventory/inventory.service';
import { RedlockService } from '../../common/redis/redlock.service';
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
    private readonly redlockService: RedlockService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { orderId, productId, quantity, lockKey, lockTTL } =
      job.data as OrderQueueJobData;

    this.logger.log(
      `Processing order ${orderId} for product ${productId}, quantity: ${quantity}`,
    );

    /**
     * Best Practice: Re-acquire lock in worker for inventory operations
     * This ensures that inventory updates are atomic and prevent overselling
     * even if multiple workers are processing orders for the same product
     */
    const numericLockTTL =
      typeof lockTTL === 'string' ? parseInt(lockTTL, 10) : lockTTL;
    const lock = await this.redlockService.acquireLock(lockKey, numericLockTTL);
    if (!lock) {
      this.logger.warn(
        `Could not acquire lock for product ${productId} in worker`,
      );
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
      });
      return { success: false, reason: 'Lock acquisition failed in worker' };
    }

    // Use database transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update order status to processing
      await queryRunner.manager.update(Order, orderId, {
        status: OrderStatus.PROCESSING,
      });
      
      // Check and reserve inventory atomically with lock protection
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
        
        // Release lock on failure
        await this.redlockService.releaseLock(lock);
        return { success: false, reason: 'Insufficient inventory' };
      }

      // Confirm the order
      await queryRunner.manager.update(Order, orderId, {
        status: OrderStatus.CONFIRMED,
        reservedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes to complete
      });

      await queryRunner.commitTransaction();
      this.logger.log(`Order ${orderId} confirmed successfully`);

      // Release lock on success
      await this.redlockService.releaseLock(lock);
      return { success: true, orderId };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Update order status to failed
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
      });

      // Always release lock on error
      await this.redlockService.releaseLock(lock);
      this.logger.error(
        `Order ${orderId} processing failed:`,
        (error as Error)?.message || 'Unknown error',
      );
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
