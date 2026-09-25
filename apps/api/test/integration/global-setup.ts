import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { buildOrmOptions } from '../../src/database/mikro-orm.config';
import { Argon2PasswordHasher } from '../../src/modules/auth/password-hasher';
import { seedReferenceData } from '../../src/database/seeders/seed-reference-data';
import { DEMO_PASSWORD, TEST_DATABASE_URL } from './support/test-env';

/** Builds the schema once per run from the real migrations, then seeds reference data. */
export default async function setup(): Promise<void> {
  const orm = await MikroORM.init(
    buildOrmOptions({ DATABASE_URL: TEST_DATABASE_URL, DATABASE_SSL: false, LOG_LEVEL: 'silent' }),
  );
  try {
    const connection = orm.em.getConnection();
    await connection.execute('drop schema if exists public cascade');
    await connection.execute('create schema public');
    await orm.migrator.up();
    await seedReferenceData(orm.em.fork(), {
      hasher: new Argon2PasswordHasher(),
      demoPassword: DEMO_PASSWORD,
    });
  } finally {
    await orm.close();
  }
}
