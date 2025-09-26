import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedlockService } from './redlock.service';

describe('RedlockService', () => {
  let service: RedlockService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      switch (key) {
        case 'REDIS_NODE1_HOST':
          return 'localhost';
        case 'REDIS_NODE1_PORT':
          return 6379;
        case 'REDIS_NODE2_HOST':
          return 'localhost';
        case 'REDIS_NODE2_PORT':
          return 6380;
        case 'REDIS_NODE3_HOST':
          return 'localhost';
        case 'REDIS_NODE3_PORT':
          return 6381;
        default:
          return defaultValue;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedlockService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedlockService>(RedlockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have proper method signatures', () => {
    expect(typeof service.acquireLock).toBe('function');
    expect(typeof service.releaseLock).toBe('function');
    expect(typeof service.extendLock).toBe('function');
    expect(typeof service.withLock).toBe('function');
    expect(typeof service.getRedlock).toBe('function');
    expect(typeof service.getRedisClients).toBe('function');
  });

  // Note: We skip actual Redis connection tests since they require running Redis instances
  // Integration tests are handled separately in test-redlock.js
});