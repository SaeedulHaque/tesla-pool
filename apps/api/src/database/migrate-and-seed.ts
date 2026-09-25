import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { loadEnv } from '../config/env';
import { createLogger } from '../logger';
import { buildOrmOptions } from './mikro-orm.config';
import { DatabaseSeeder } from './seeders/database.seeder';

/**
 * One-shot entrypoint for the `migrate` Compose service and the production start command:
 * apply pending migrations (a no-op when there are none), then seed reference/demo data.
 * Seeding upserts, so re-running never duplicates rows. Pass `--skip-seed` to migrate only.
 */
async function run(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const skipSeed = process.argv.includes('--skip-seed');
  const orm = await MikroORM.init(buildOrmOptions(env));
  try {
    const applied = await orm.migrator.up();
    logger.info({ applied: applied.map((migration) => migration.name) }, 'migrations applied');
    if (!skipSeed) {
      if (env.NODE_ENV === 'production') {
        // The cast shares one publicly documented password: never do this to real user data.
        logger.warn(
          { defaultPassword: env.SEED_DEMO_PASSWORD === 'pool-demo-123' },
          'seeding demo accounts in production; pass --skip-seed for a real deployment',
        );
      }
      await orm.seeder.seed(DatabaseSeeder);
      logger.info('seed data upserted');
    }
  } finally {
    await orm.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
