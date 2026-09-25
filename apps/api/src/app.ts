import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';

export interface DatabaseProbe {
  ping(): Promise<void>;
}

export interface AppDeps {
  env: Pick<Env, 'TRUST_PROXY_HOPS'>;
  logger: Logger;
  database: DatabaseProbe;
}

export function buildApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.env.TRUST_PROXY_HOPS);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', async (req, res) => {
    try {
      await deps.database.ping();
      res.json({ status: 'ready' });
    } catch (error) {
      req.log.error({ err: error }, 'readiness check failed');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
