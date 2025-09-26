import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringGateway } from './monitoring.gateway';
import { MonitoringController } from './monitoring.controller';
import { PrometheusController } from '../../common/metrics/prometheus.controller';
import { MetricsModule } from '../../common/metrics/metrics.module';

@Module({
  imports: [
    MetricsModule,
    BullModule.registerQueue({
      name: 'order-processing',
    }),
  ],
  controllers: [MonitoringController, PrometheusController],
  providers: [MonitoringGateway],
  exports: [MonitoringGateway],
})
export class MonitoringModule {}