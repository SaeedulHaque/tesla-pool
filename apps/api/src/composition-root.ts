import type { MikroORM } from '@mikro-orm/postgresql';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { buildApp } from './app';
import type { Env } from './config/env';

/** Builds every service once with constructor injection; tests can pass fakes instead. */
export function composeApp(orm: MikroORM, env: Env, logger: Logger): Express {
  return buildApp({
    env,
    logger,
    database: {
      ping: async () => {
        await orm.em.getConnection().execute('select 1');
      },
    },
  });
}
