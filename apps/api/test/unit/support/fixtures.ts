import { Actor } from '../../../src/shared/domain/actor';
import { Money } from '../../../src/shared/domain/money';
import { DISTANCE_SEEDS_M, ZONE_SEEDS } from '../../../src/database/seeders/reference-data';
import { Vehicle } from '../../../src/modules/drivers/vehicle.entity';
import { ZoneDistanceMatrix } from '../../../src/modules/geography/zone-distance-matrix';
import { DistanceCompatibilityPolicy } from '../../../src/modules/pools/pool-compatibility-policy';
import { Pool } from '../../../src/modules/pools/pool.entity';
import { RideRequest } from '../../../src/modules/rides/ride-request.entity';

export const ZONE = Object.fromEntries(ZONE_SEEDS.map((zone) => [zone.code, zone.id])) as Record<
  string,
  number
>;

/** The real nine-zone distance table, both directions, exactly as seeded. */
export function realMatrix(): ZoneDistanceMatrix {
  const idOf = (code: string) => ZONE[code];
  return new ZoneDistanceMatrix(
    ZONE_SEEDS.map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      latitude: 0,
      longitude: 0,
    })),
    DISTANCE_SEEDS_M.flatMap(([a, b, metres]) => [
      { fromZoneId: idOf(a), toZoneId: idOf(b), distanceM: metres },
      { fromZoneId: idOf(b), toZoneId: idOf(a), distanceM: metres },
    ]),
  );
}

export const matrix = realMatrix();
export const policy = new DistanceCompatibilityPolicy(matrix);

export const jashim = Actor.user('jashim-id');

export function bullet(): Vehicle {
  const vehicle = new Vehicle('jashim-id', 'Bullet', 'DM-TA-11-0001', 3);
  vehicle.goOnline(ZONE.BANANI);
  return vehicle;
}

export function bulletPool(): Pool {
  return Pool.open(bullet(), ZONE.BANANI, jashim);
}

export function ride(
  passenger: string,
  dropoff: string,
  options: { seats?: number; pickup?: string } = {},
): RideRequest {
  const seats = options.seats ?? 1;
  const pickup = options.pickup ?? 'BANANI';
  const distanceM = matrix.distanceM(ZONE[pickup], ZONE[dropoff]);
  return RideRequest.create(
    {
      passengerId: `${passenger}-id`,
      pickupZoneId: ZONE[pickup],
      dropoffZoneId: ZONE[dropoff],
      seats,
      distanceM,
      estimatedSolo: Money.ofPaisa(3_000 + distanceM * 2 * seats),
      estimatedPooled: Money.ofPaisa(3_000 + distanceM * 2 * seats * 0.7),
      pricingVersion: 'v1',
    },
    Actor.user(`${passenger}-id`),
  );
}
