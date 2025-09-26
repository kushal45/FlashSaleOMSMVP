import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { Product } from '../../database/entities';
import { MetricsModule } from 'src/common/metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), MetricsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}