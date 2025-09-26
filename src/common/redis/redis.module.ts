import { Module } from '@nestjs/common';
import { RedisClientProvider } from './redis-client.provider';
import { RedlockService } from './redlock.service';

@Module({
  providers: [RedisClientProvider, RedlockService],
  exports: [RedisClientProvider, RedlockService],
})
export class RedisModule {}
