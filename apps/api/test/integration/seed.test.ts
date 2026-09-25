import type { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSeeder } from '../../src/database/seeders/database.seeder';
import { connectTestOrm, resetState } from './support/database';

async function counts(orm: MikroORM): Promise<Record<string, number>> {
  const [row] = await orm.em.getConnection().execute<Record<string, string>[]>(
    `select (select count(*) from users) users, (select count(*) from zones) zones,
            (select count(*) from zone_distances) distances, (select count(*) from vehicles) vehicles,
            (select count(*) from pools) pools, (select count(*) from ride_requests) requests,
            (select count(*) from pool_memberships) memberships, (select count(*) from ride_events) events`,
  );
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

describe('seed data', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await connectTestOrm();
    await resetState(orm);
  });

  afterAll(async () => {
    await resetState(orm);
    await orm.close();
  });

  it('contains the story cast, both vehicles and a symmetric distance table', async () => {
    await orm.seeder.seed(DatabaseSeeder);
    const connection = orm.em.getConnection();

    const people = await connection.execute<{ full_name: string; role: string }[]>(
      'select full_name, role from users order by full_name',
    );
    expect(people.map((p) => `${p.full_name}:${p.role}`)).toEqual([
      'Jashim:DRIVER',
      'Kamal:DRIVER',
      'Nusrat:PASSENGER',
      'Rafiq:PASSENGER',
      'Shirin:PASSENGER',
    ]);

    const vehicles = await connection.execute<
      { display_name: string; seat_capacity: number; is_online: boolean; driver: string }[]
    >(
      `select v.display_name, v.seat_capacity, v.is_online, u.full_name driver
         from vehicles v join users u on u.id = v.driver_id order by v.display_name`,
    );
    expect(vehicles).toEqual([
      { display_name: 'Bullet', seat_capacity: 3, is_online: false, driver: 'Jashim' },
      { display_name: 'Toofan', seat_capacity: 3, is_online: false, driver: 'Kamal' },
    ]);

    const [{ n }] = await connection.execute<{ n: string }[]>(
      `select count(*) n from zone_distances a
         join zone_distances b on a.from_zone_id = b.to_zone_id and a.to_zone_id = b.from_zone_id
        where a.distance_m = b.distance_m`,
    );
    expect(Number(n)).toBe(72); // 9 zones: 36 pairs, both directions
  });

  it('seeds the required reference distances', async () => {
    const rows = await orm.em.getConnection().execute<{ distance_m: number }[]>(
      `select d.distance_m from zone_distances d
         join zones a on a.id = d.from_zone_id join zones b on b.id = d.to_zone_id
        where (a.code, b.code) in (('BANANI','MOHAKHALI'), ('BANANI','GULSHAN_1'), ('GULSHAN_1','MOHAKHALI'))
        order by d.distance_m`,
    );
    expect(rows.map((row) => row.distance_m)).toEqual([2_000, 2_500, 3_000]);
  });

  it('adds one completed pooled ride from yesterday and no active rides', async () => {
    const connection = orm.em.getConnection();
    const rides = await connection.execute<
      { full_name: string; status: string; fare_total_paisa: number }[]
    >(
      `select u.full_name, r.status, r.fare_total_paisa from ride_requests r
         join users u on u.id = r.passenger_id order by u.full_name`,
    );
    expect(rides).toEqual([
      { full_name: 'Nusrat', status: 'COMPLETED', fare_total_paisa: 7_200 },
      { full_name: 'Rafiq', status: 'COMPLETED', fare_total_paisa: 5_800 },
    ]);
    const [{ active }] = await connection.execute<{ active: string }[]>(
      `select (select count(*) from ride_requests where status in ('REQUESTED','MATCHED','IN_PROGRESS'))
            + (select count(*) from pools where status in ('ACCEPTED','DRIVER_ARRIVED','STARTED')) active`,
    );
    expect(Number(active)).toBe(0);
  });

  it('is idempotent: seeding again never duplicates rows', async () => {
    const before = await counts(orm);
    await orm.seeder.seed(DatabaseSeeder);
    await orm.seeder.seed(DatabaseSeeder);
    expect(await counts(orm)).toEqual(before);
  });
});
