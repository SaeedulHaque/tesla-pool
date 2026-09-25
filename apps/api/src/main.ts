import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { composeApp } from './composition-root';
import { loadEnv } from './config/env';
import { buildOrmOptions } from './database/mikro-orm.config';
import { createLogger } from './logger';

const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const orm = await MikroORM.init(buildOrmOptions(env));
  const app = await composeApp(orm, env, logger);

  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, 'api listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down: draining in-flight requests');
    const force = setTimeout(() => {
      logger.error('graceful shutdown timed out');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);
    force.unref();
    // Stop accepting connections, let in-flight requests finish, then close the ORM.
    server.close((serverError) => {
      orm
        .close()
        .catch((closeError: unknown) => logger.error({ err: closeError }, 'orm close failed'))
        .finally(() => process.exit(serverError ? 1 : 0));
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
