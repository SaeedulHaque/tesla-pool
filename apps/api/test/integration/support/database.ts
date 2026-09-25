import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { buildOrmOptions } from '../../../src/database/mikro-orm.config';
import { CAST } from '../../../src/database/seeders/reference-data';
import { TEST_DATABASE_URL } from './test-env';

export async function connectTestOrm(): Promise<MikroORM> {
  return MikroORM.init(
    buildOrmOptions({ DATABASE_URL: TEST_DATABASE_URL, DATABASE_SSL: false, LOG_LEVEL: 'silent' }),
  );
}

/** Clears everything a test can create; reference data (zones, cast, vehicles) stays. */
export async function resetState(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection();
  await connection.execute(
    'truncate table ride_events, pool_memberships, pools, ride_requests restart identity cascade',
  );
  await connection.execute('update vehicles set is_online = false, current_zone_id = null');
  // Passengers created by register tests; the cast stays.
  const castPhones = Object.values(CAST).map((person) => person.phone);
  await connection.execute(
    `delete from users where phone not in (${castPhones.map(() => '?').join(',')})`,
    castPhones,
  );
}
