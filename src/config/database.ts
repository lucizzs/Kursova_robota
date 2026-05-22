/**
 * Єдиний екземпляр Prisma-клієнта (Singleton).
 * Перевикористання з'єднань між запитами.
 */
import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

/** Грейсфул-завершення з'єднань при shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
