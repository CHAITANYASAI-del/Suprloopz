// Shared Redis connection — used for rate limiting and idempotency storage.
import Redis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));
