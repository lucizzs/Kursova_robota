import path from 'path';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import pinoHttp from 'pino-http';

import { AppContainer } from './config/container';
import { logger } from './utils/logger';
import { buildRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export function createApp(container: AppContainer): Application {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  app.use(cors());

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', buildRoutes(container)); 
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
