import 'reflect-metadata';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, type Options } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import { ALL_ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import type { Env } from '../config/env';

export function buildOrmOptions(
  env: Pick<Env, 'DATABASE_URL' | 'DATABASE_SSL' | 'LOG_LEVEL'>,
): Options {
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    driverOptions: env.DATABASE_SSL ? { connection: { ssl: true } } : {},
    entities: ALL_ENTITIES,
    extensions: [Migrator, SeedManager],
    // Fails fast if code ever touches the global EntityManager: every use case forks its own.
    allowGlobalContext: false,
    // Compiled-JS friendly: no filesystem globbing at runtime.
    migrations: { migrationsList: MIGRATIONS, transactional: true, snapshot: false },
    discovery: { warnWhenNoEntities: false },
    pool: { min: 0, max: 10 },
    debug: env.LOG_LEVEL === 'trace',
  });
}
