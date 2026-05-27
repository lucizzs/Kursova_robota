import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError, ConflictError } from '../domain/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Власні доменні помилки
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const conflict = new ConflictError('Запис з такими унікальними полями вже існує');
      res.status(conflict.statusCode).json({
        error: { code: conflict.code, message: conflict.message },
      });
      return;
    }
    if (err.code === 'P2025') {
      const notFound = new NotFoundError('Запис');
      res.status(notFound.statusCode).json({
        error: { code: notFound.code, message: notFound.message },
      });
      return;
    }
  }

  // Невідома помилка — лог + 500
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера' },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Маршрут ${req.method} ${req.path} не знайдено` },
  });
}
