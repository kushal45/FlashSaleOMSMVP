import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisClientProvider implements OnModuleDestroy {
  private client: RedisClientType;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
      },
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });
    this.client.connect().catch(console.error);
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async aquireLock(key: string, duration: number): Promise<boolean> {
    const result = await this.client.set(key, 'locked', {
      EX: duration,
      NX: true,
    });
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
