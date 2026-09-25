import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { requestId } from './http/request-id';

export interface DatabaseProbe {
  ping(): Promise<void>;
}

/** Module routers, mounted under /api/v1. */
export interface ApiRouters {
  auth: Router;
  zones: Router;
  fareEstimates: Router;
  rideRequests: Router;
  driver: Router;
  pools: Router;
}

export interface AppDeps {
  env: Pick<Env, 'TRUST_PROXY_HOPS'>;
  logger: Logger;
  database: DatabaseProbe;
  routers: ApiRouters;
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
  app.use(cookieParser());

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

  const api = Router();
  // Every API response is per-user data: forbid shared caches and CDNs from storing it.
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use('/auth', deps.routers.auth);
  api.use('/zones', deps.routers.zones);
  api.use('/fare-estimates', deps.routers.fareEstimates);
  api.use('/ride-requests', deps.routers.rideRequests);
  api.use('/driver', deps.routers.driver);
  api.use('/pools', deps.routers.pools);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
