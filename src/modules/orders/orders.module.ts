import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderProcessor } from './orders.processor';
import { Order, Product } from '../../database/entities';
import { InventoryModule } from '../inventory/inventory.module';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from 'src/common/metrics/metrics.module';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forFeature([Order, Product]),
    BullModule.registerQueue({
      name: 'order-processing',
    }),
    InventoryModule,
    MetricsModule,
    RedisModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
