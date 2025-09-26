import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getRedisConfig } from '../../config/redis.config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getRedisConfig(configService),
    }),
    BullModule.registerQueue({
      name: 'order-processing',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
