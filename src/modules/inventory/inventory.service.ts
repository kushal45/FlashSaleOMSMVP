import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Product } from '../../database/entities';
import { MetricsService } from 'src/common/metrics/metrics.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly metricsService: MetricsService,
  ) {}

  async reserveInventory(
    productId: number,
    quantity: number,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repository = queryRunner
      ? queryRunner.manager.getRepository(Product)
      : this.productRepository;

    try {
      // Atomic update with pessimistic locking
      const updateResult = await repository
        .createQueryBuilder()
        .update(Product)
        .set({
          currentStock: () => 'current_stock - :quantity',
        })
        .where('id = :productId AND current_stock >= :quantity')
        .setParameters({ productId, quantity })
        .execute();

      const success = (updateResult.affected ?? 0) > 0;

      const product = await repository.findOne({ where: { id: productId } });
      if (success) {
        this.logger.log(`Reserved ${quantity} units for product ${productId}`);
      } else {
        this.logger.warn(
          `Failed to reserve ${quantity} units for product ${productId} - insufficient stock`,
        );
      }
      // Always record inventory metric if product exists
      if (product) {
        await this.metricsService.recordInventoryLevel(
          productId,
          product.currentStock,
        );
      }
      return success;
    } catch (error) {
      this.logger.error(
        `Error reserving inventory: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async releaseInventory(
    productId: number,
    quantity: number,
    queryRunner?: QueryRunner,
  ): Promise<boolean> {
    const repository = queryRunner
      ? queryRunner.manager.getRepository(Product)
      : this.productRepository;

    try {
      const updateResult = await repository
        .createQueryBuilder()
        .update(Product)
        .set({
          currentStock: () => 'current_stock + :quantity',
        })
        .where('id = :productId')
        .setParameters({ productId, quantity })
        .execute();

      const success = (updateResult.affected ?? 0) > 0;

      const product = await repository.findOne({ where: { id: productId } });
      if (success) {
        this.logger.log(`Released ${quantity} units for product ${productId}`);
      }
      // Always record inventory metric if product exists
      if (product) {
        await this.metricsService.recordInventoryLevel(
          productId,
          product.currentStock,
        );
      }
      return success;
    } catch (error) {
      this.logger.error(
        `Error releasing inventory: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async getProductInventory(productId: number): Promise<Product | null> {
    return this.productRepository.findOne({ where: { id: productId } });
  }

  async getAllProducts(): Promise<Product[]> {
    return this.productRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updateProduct(
    productId: number,
    updates: Partial<Product>,
  ): Promise<Product | null> {
    await this.productRepository.update(productId, updates);
    return this.getProductInventory(productId);
  }

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const product = this.productRepository.create(productData);
    return this.productRepository.save(product);
  }

  async getInventoryMetrics(): Promise<any> {
    const products = await this.productRepository.find();

    const totalProducts = products.length;
    const outOfStockProducts = products.filter(
      (p) => p.currentStock === 0,
    ).length;
    const lowStockProducts = products.filter(
      (p) => p.currentStock > 0 && p.currentStock < p.initialStock * 0.1,
    ).length;

    const totalInitialStock = products.reduce(
      (sum, p) => sum + p.initialStock,
      0,
    );
    const totalCurrentStock = products.reduce(
      (sum, p) => sum + p.currentStock,
      0,
    );
    const stockUtilization =
      totalInitialStock > 0
        ? ((totalInitialStock - totalCurrentStock) / totalInitialStock) * 100
        : 0;

    return {
      totalProducts,
      outOfStockProducts,
      lowStockProducts,
      totalInitialStock,
      totalCurrentStock,
      stockUtilization: Math.round(stockUtilization * 100) / 100,
    };
  }
}
