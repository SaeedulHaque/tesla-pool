import type { EntityManager } from '@mikro-orm/postgresql';
import { Seeder } from '@mikro-orm/seeder';
import { Argon2PasswordHasher } from '../../modules/auth/password-hasher';
import { seedDemoHistory } from './seed-demo-history';
import { seedReferenceData } from './seed-reference-data';

const DEFAULT_DEMO_PASSWORD = 'pool-demo-123';

/**
 * Everything the demo needs, safe to run on every boot: zones, distances, the cast and
 * their vehicles (upserted by code/phone), plus one completed pooled ride from yesterday.
 * No active rides are created, so a live demo starts clean.
 */
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await em.transactional(async (tx) => {
      const reference = await seedReferenceData(tx, {
        hasher: new Argon2PasswordHasher(),
        demoPassword: process.env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD,
      });
      await seedDemoHistory(tx, reference);
    });
  }
}
