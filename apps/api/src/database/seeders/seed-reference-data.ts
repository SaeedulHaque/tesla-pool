import type { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../../modules/auth/user.entity';
import type { PasswordHasher } from '../../modules/auth/password-hasher';
import { Vehicle } from '../../modules/drivers/vehicle.entity';
import { Zone } from '../../modules/geography/zone.entity';
import { ZoneDistance } from '../../modules/geography/zone-distance.entity';
import { CAST, DISTANCE_SEEDS_M, VEHICLE_SEEDS, ZONE_SEEDS } from './reference-data';

export interface SeedContext {
  hasher: PasswordHasher;
  demoPassword: string;
}

async function upsertZones(em: EntityManager): Promise<Map<string, number>> {
  const existing = new Map((await em.find(Zone, {})).map((zone) => [zone.id, zone]));
  for (const seed of ZONE_SEEDS) {
    const zone = existing.get(seed.id);
    if (zone) {
      zone.code = seed.code;
      zone.name = seed.name;
      zone.latitude = seed.latitude;
      zone.longitude = seed.longitude;
    } else {
      em.persist(new Zone(seed.id, seed.code, seed.name, seed.latitude, seed.longitude));
    }
  }
  await em.flush();
  return new Map(ZONE_SEEDS.map((zone) => [zone.code, zone.id]));
}

async function upsertDistances(em: EntityManager, zoneIds: Map<string, number>): Promise<void> {
  const existing = new Map(
    (await em.find(ZoneDistance, {})).map((row) => [`${row.fromZoneId}>${row.toZoneId}`, row]),
  );
  const idOf = (code: string): number => {
    const id = zoneIds.get(code);
    if (id === undefined) throw new Error(`Unknown zone code in distance seed: ${code}`);
    return id;
  };
  for (const [fromCode, toCode, metres] of DISTANCE_SEEDS_M) {
    const from = idOf(fromCode);
    const to = idOf(toCode);
    for (const [a, b] of [
      [from, to],
      [to, from],
    ] as const) {
      const row = existing.get(`${a}>${b}`);
      if (row) row.distanceM = metres;
      else em.persist(new ZoneDistance(a, b, metres));
    }
  }
  await em.flush();
}

/** Upserts by phone. The demo password follows the environment, so it never drifts. */
async function upsertCast(em: EntityManager, ctx: SeedContext): Promise<Map<string, User>> {
  const users = new Map<string, User>();
  for (const [key, person] of Object.entries(CAST)) {
    let user = await em.findOne(User, { phone: person.phone });
    if (!user) {
      user = new User(
        person.fullName,
        person.phone,
        await ctx.hasher.hash(ctx.demoPassword),
        person.role,
      );
      em.persist(user);
    } else {
      user.fullName = person.fullName;
      user.role = person.role;
      if (!(await ctx.hasher.verify(user.passwordHash, ctx.demoPassword))) {
        user.passwordHash = await ctx.hasher.hash(ctx.demoPassword);
      }
    }
    users.set(key, user);
  }
  await em.flush();
  return users;
}

/** Vehicles keep their live online/zone state so re-seeding never disturbs a running demo. */
async function upsertVehicles(em: EntityManager, users: Map<string, User>): Promise<void> {
  for (const seed of VEHICLE_SEEDS) {
    const driver = users.get(seed.driver);
    if (!driver) throw new Error(`Vehicle seed references unknown driver ${seed.driver}`);
    const vehicle = await em.findOne(Vehicle, { driverId: driver.id });
    if (vehicle) {
      vehicle.displayName = seed.displayName;
      vehicle.plateNumber = seed.plateNumber;
      vehicle.seatCapacity = seed.seatCapacity;
    } else {
      em.persist(new Vehicle(driver.id, seed.displayName, seed.plateNumber, seed.seatCapacity));
    }
  }
  await em.flush();
}

export interface SeededReferenceData {
  users: Map<string, User>;
  zoneIds: Map<string, number>;
}

/** Zones, distance table, the cast and their vehicles. Idempotent. */
export async function seedReferenceData(
  em: EntityManager,
  ctx: SeedContext,
): Promise<SeededReferenceData> {
  const zoneIds = await upsertZones(em);
  await upsertDistances(em, zoneIds);
  const users = await upsertCast(em, ctx);
  await upsertVehicles(em, users);
  return { users, zoneIds };
}
