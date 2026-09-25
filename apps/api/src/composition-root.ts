import type { MikroORM } from '@mikro-orm/postgresql';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { buildApp } from './app';
import type { Env } from './config/env';
import { createAuthenticate } from './http/authenticate';
import { Argon2PasswordHasher, type PasswordHasher } from './modules/auth/password-hasher';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { TokenService } from './modules/auth/token-service';
import { MikroOrmUserRepository } from './modules/auth/user.repository';
import { MikroOrmTransactor } from './shared/transactor';

export interface Overrides {
  hasher?: PasswordHasher;
}

/** Builds every service once with constructor injection; tests can pass fakes instead. */
export function composeApp(
  orm: MikroORM,
  env: Env,
  logger: Logger,
  overrides: Overrides = {},
): Express {
  const transactor = new MikroOrmTransactor(orm);
  const tokens = new TokenService(env.JWT_SECRET, env.JWT_TTL_HOURS);
  const authenticate = createAuthenticate(tokens);

  const authService = new AuthService(
    transactor,
    new MikroOrmUserRepository(),
    overrides.hasher ?? new Argon2PasswordHasher(),
    tokens,
  );

  return buildApp({
    env,
    logger,
    database: {
      ping: async () => {
        await orm.em.getConnection().execute('select 1');
      },
    },
    routers: {
      auth: createAuthRouter({
        service: authService,
        authenticate,
        cookie: { secure: env.COOKIE_SECURE, maxAgeMs: tokens.maxAgeMs },
        rateLimit: {
          max: env.AUTH_RATE_LIMIT_MAX,
          windowMinutes: env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
        },
      }),
    },
  });
}
