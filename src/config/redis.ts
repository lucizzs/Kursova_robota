/**
 * Redis-клієнт для кешування статистики проєктів.
 * Lazy-connect, щоб помилка під'єднання не падала на старті.
 */
import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err }, 'Не вдалось підключити Redis — продовжуємо без кешу');
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit().catch(() => undefined);
}
