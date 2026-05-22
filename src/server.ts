import 'dotenv/config';
/**
 * Точка входу — створює застосунок і запускає HTTP-сервер.
 * Обробляє SIGTERM/SIGINT для graceful shutdown.
 */
import { env } from './config/env';
import { prisma, disconnectDatabase } from './config/database';
import { redis, connectRedis, disconnectRedis } from './config/redis';
import { buildContainer } from './config/container';
import { createApp } from './app';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await connectRedis();

  const container = buildContainer(prisma, redis);
  const app = createApp(container);

  const server = app.listen(env.PORT, () => {
    logger.info(`Сервер запущено: http://localhost:${env.PORT}`);
    logger.info(`Health-check:    http://localhost:${env.PORT}/healthz`);
    logger.info(`API префікс:     http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Отримано ${signal} — graceful shutdown...`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info("З'єднання закриті, вихід.");
      process.exit(0);
    });
    // Якщо не закрилось за 10 секунд — примусово
    setTimeout(() => {
      logger.error('Не вдалось коректно завершити роботу — force exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Помилка запуску');
  process.exit(1);
});
