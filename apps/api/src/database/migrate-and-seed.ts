import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { loadEnv } from '../config/env';
import { createLogger } from '../logger';
import { buildOrmOptions } from './mikro-orm.config';

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
      logger.info('seeding skipped: no seeders registered yet');
    }
  } finally {
    await orm.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
