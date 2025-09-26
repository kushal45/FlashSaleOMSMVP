import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock, { CompatibleRedisClient } from 'redlock';

@Injectable()
export class RedlockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedlockService.name);
  private redisClients: Redis[] = [];
  private redlock: Redlock;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Initialize Redis nodes for Red-lock
    const redisNodes = [
      {
        host: this.configService.get<string>('REDIS_NODE1_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_NODE1_PORT', 6379),
      },
      {
        host: this.configService.get<string>('REDIS_NODE2_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_NODE2_PORT', 6380),
      },
      {
        host: this.configService.get<string>('REDIS_NODE3_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_NODE3_PORT', 6381),
      },
    ];

    // Create Redis clients for each node
    for (const node of redisNodes) {
      const client = new Redis({
        host: node.host,
        port: node.port,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      client.on('connect', () => {
        this.logger.log(`Connected to Redis node ${node.host}:${node.port}`);
      });

      client.on('error', (error) => {
        this.logger.error(`Redis node ${node.host}:${node.port} error:`, error);
      });

      this.redisClients.push(client);
    }

    // Initialize Redlock with all Redis clients
    this.redlock = new Redlock(
      // Cast to any to resolve type compatibility issues
      this.redisClients as unknown as CompatibleRedisClient[],
      {
        // The expected clock drift; for more details see:
        // http://redis.io/topics/distlock
        driftFactor: 0.01, // multiplied by lock ttl to determine drift time

        // The max number of times Redlock will attempt to lock a resource
        // before erroring.
        retryCount: 10,

        // the time in ms between attempts
        retryDelay: 200, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        retryJitter: 200, // time in ms
      },
    );

    // Add event listeners for debugging
    this.redlock.on('clientError', (err) => {
      this.logger.error('A redis error has occurred:', err);
    });

    this.logger.log('Redlock service initialized with 3 Redis nodes');
  }

  async onModuleDestroy() {
    // Clean up Redis connections
    for (const client of this.redisClients) {
      await client.quit();
    }
    this.logger.log('All Redis connections closed');
  }

  /**
   * Acquire a distributed lock using Redlock algorithm
   */
  async acquireLock(
    lockKey: string,
    ttl: number = 5000,
  ): Promise<Redlock.Lock | null> {
    try {
      const lock = await this.redlock.acquire([lockKey], ttl);
      this.logger.debug(`Acquired lock for key: ${lockKey}, TTL: ${ttl}ms`);
      return lock as unknown as Redlock.Lock;
    } catch (error: any) {
      this.logger.warn(
        `Failed to acquire lock for key: ${lockKey}`,
        (error as Error)?.message || 'Unknown error',
      );
      return null;
    }
  }

  async releaseLock(lock: Redlock.Lock): Promise<boolean> {
    try {
      await this.redlock.release(lock);
      this.logger.debug(`Released lock for key: ${lock.resource}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to release lock for key: ${lock.resource}`,
        (error as Error)?.message || 'Unknown error',
      );
      return false;
    }
  }

  /**
   * Extend a lock's TTL
   */
  async extendLock(lock: Redlock.Lock, ttl: number): Promise<boolean> {
    try {
      await lock.extend(ttl);
      this.logger.debug(`Lock extended by ${ttl}ms`);
      return true;
    } catch (error: any) {
      this.logger.error(
        'Failed to extend lock:',
        (error as Error)?.message || 'Unknown error',
      );
      return false;
    }
  }

  /**
   * Execute a function with a distributed lock
   * @param lockKey - The key to lock
   * @param ttl - Time to live in milliseconds
   * @param fn - Function to execute while holding the lock
   */
  async withLock<T>(
    lockKey: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const lock = await this.acquireLock(lockKey, ttl);
    if (!lock) {
      return null;
    }

    try {
      const result = await fn();
      return result;
    } finally {
      await this.redlock.release(lock);
    }
  }

  /**
   * Get Redlock instance for advanced usage
   */
  getRedlock(): Redlock {
    return this.redlock;
  }

  /**
   * Get all Redis clients for direct access if needed
   */
  getRedisClients(): Redis[] {
    return this.redisClients;
  }
}
