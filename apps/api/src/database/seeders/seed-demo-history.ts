import type { EntityManager } from '@mikro-orm/postgresql';
import { RideEvent } from '../../modules/audit/ride-event.entity';
import { EventType } from '../../modules/audit/event-types';
import { Vehicle } from '../../modules/drivers/vehicle.entity';
import { PoolMembership } from '../../modules/pools/pool-membership.entity';
import { Pool } from '../../modules/pools/pool.entity';
import { RideRequest } from '../../modules/rides/ride-request.entity';
import type { SeededReferenceData } from './seed-reference-data';

// Fixed ids make the seed idempotent: a second run finds the pool and stops.
const HISTORY_POOL_ID = '00000000-0000-4000-8000-00000000a001';
const NUSRAT_REQUEST_ID = '00000000-0000-4000-8000-00000000b001';
const RAFIQ_REQUEST_ID = '00000000-0000-4000-8000-00000000b002';

function yesterdayAt(hours: number, minutes: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  // Dhaka is UTC+6, so 08:41 local is 02:41 UTC.
  date.setUTCHours(hours - 6, minutes, 0, 0);
  return date;
}

/** One completed pooled ride from "yesterday", so history screens are not empty. */
export async function seedDemoHistory(
  em: EntityManager,
  reference: SeededReferenceData,
): Promise<void> {
  if (await em.findOne(Pool, { id: HISTORY_POOL_ID })) return;

  const { users, zoneIds } = reference;
  const jashim = users.get('jashim');
  const nusrat = users.get('nusrat');
  const rafiq = users.get('rafiq');
  const banani = zoneIds.get('BANANI');
  const mohakhali = zoneIds.get('MOHAKHALI');
  const gulshan1 = zoneIds.get('GULSHAN_1');
  if (!jashim || !nusrat || !rafiq || !banani || !mohakhali || !gulshan1) {
    throw new Error('Reference data is incomplete: cannot seed demo history');
  }
  const bullet = await em.findOneOrFail(Vehicle, { driverId: jashim.id });

  const requestedNusrat = yesterdayAt(8, 41);
  const requestedRafiq = yesterdayAt(8, 43);
  const arrived = yesterdayAt(8, 46);
  const started = yesterdayAt(8, 48);
  const droppedRafiq = yesterdayAt(9, 5);
  const droppedNusrat = yesterdayAt(9, 12);

  const nusratRide = Object.assign(new RideRequest(), {
    id: NUSRAT_REQUEST_ID,
    passengerId: nusrat.id,
    pickupZoneId: banani,
    dropoffZoneId: mohakhali,
    seats: 1,
    distanceM: 3_000,
    status: 'COMPLETED' as const,
    estSoloFarePaisa: 9_000,
    estPooledFarePaisa: 7_200,
    fareBasePaisa: 3_000,
    fareDistancePaisa: 6_000,
    fareDiscountPaisa: 1_800,
    fareTotalPaisa: 7_200,
    pricingVersion: 'v1',
    createdAt: requestedNusrat,
    updatedAt: droppedNusrat,
    completedAt: droppedNusrat,
  });
  const rafiqRide = Object.assign(new RideRequest(), {
    id: RAFIQ_REQUEST_ID,
    passengerId: rafiq.id,
    pickupZoneId: banani,
    dropoffZoneId: gulshan1,
    seats: 1,
    distanceM: 2_000,
    status: 'COMPLETED' as const,
    estSoloFarePaisa: 7_000,
    estPooledFarePaisa: 5_800,
    fareBasePaisa: 3_000,
    fareDistancePaisa: 4_000,
    fareDiscountPaisa: 1_200,
    fareTotalPaisa: 5_800,
    pricingVersion: 'v1',
    createdAt: requestedRafiq,
    updatedAt: droppedRafiq,
    completedAt: droppedRafiq,
  });
  const pool = Object.assign(new Pool(), {
    id: HISTORY_POOL_ID,
    vehicleId: bullet.id,
    driverId: jashim.id,
    pickupZoneId: banani,
    status: 'COMPLETED' as const,
    seatCapacity: bullet.seatCapacity,
    seatsOccupied: 2,
    createdAt: requestedNusrat,
    updatedAt: droppedNusrat,
  });
  em.persist([nusratRide, rafiqRide, pool]);
  await em.flush(); // parents before children: memberships and events reference these rows

  const member = (ride: RideRequest, joinedAt: Date) =>
    Object.assign(new PoolMembership(), { pool, rideRequest: ride, joinedAt });
  em.persist([member(nusratRide, requestedNusrat), member(rafiqRide, requestedRafiq)]);

  const event = (partial: Partial<RideEvent> & Pick<RideEvent, 'type' | 'occurredAt'>): RideEvent =>
    Object.assign(new RideEvent(), partial);
  em.persist([
    event({
      type: EventType.RIDE_REQUESTED,
      rideRequestId: NUSRAT_REQUEST_ID,
      actorUserId: nusrat.id,
      toStatus: 'REQUESTED',
      occurredAt: requestedNusrat,
    }),
    event({
      type: EventType.POOL_CREATED,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      toStatus: 'ACCEPTED',
      occurredAt: requestedNusrat,
    }),
    event({
      type: EventType.REQUEST_MATCHED,
      rideRequestId: NUSRAT_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'REQUESTED',
      toStatus: 'MATCHED',
      occurredAt: requestedNusrat,
    }),
    event({
      type: EventType.PASSENGER_JOINED,
      rideRequestId: NUSRAT_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      data: { seatsOccupied: 1 },
      occurredAt: requestedNusrat,
    }),
    event({
      type: EventType.RIDE_REQUESTED,
      rideRequestId: RAFIQ_REQUEST_ID,
      actorUserId: rafiq.id,
      toStatus: 'REQUESTED',
      occurredAt: requestedRafiq,
    }),
    event({
      type: EventType.REQUEST_MATCHED,
      rideRequestId: RAFIQ_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      fromStatus: 'REQUESTED',
      toStatus: 'MATCHED',
      occurredAt: requestedRafiq,
    }),
    event({
      type: EventType.PASSENGER_JOINED,
      rideRequestId: RAFIQ_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      data: { seatsOccupied: 2 },
      occurredAt: requestedRafiq,
    }),
    event({
      type: EventType.DRIVER_ARRIVED,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'ACCEPTED',
      toStatus: 'DRIVER_ARRIVED',
      occurredAt: arrived,
    }),
    event({
      type: EventType.POOL_STARTED,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'DRIVER_ARRIVED',
      toStatus: 'STARTED',
      data: { pooled: true, members: 2 },
      occurredAt: started,
    }),
    event({
      type: EventType.REQUEST_STARTED,
      rideRequestId: NUSRAT_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'MATCHED',
      toStatus: 'IN_PROGRESS',
      data: {
        basePaisa: 3_000,
        distancePaisa: 6_000,
        discountPaisa: 1_800,
        totalPaisa: 7_200,
        pricingVersion: 'v1',
      },
      occurredAt: started,
    }),
    event({
      type: EventType.REQUEST_STARTED,
      rideRequestId: RAFIQ_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'MATCHED',
      toStatus: 'IN_PROGRESS',
      data: {
        basePaisa: 3_000,
        distancePaisa: 4_000,
        discountPaisa: 1_200,
        totalPaisa: 5_800,
        pricingVersion: 'v1',
      },
      occurredAt: started,
    }),
    event({
      type: EventType.REQUEST_COMPLETED,
      rideRequestId: RAFIQ_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'IN_PROGRESS',
      toStatus: 'COMPLETED',
      occurredAt: droppedRafiq,
    }),
    event({
      type: EventType.REQUEST_COMPLETED,
      rideRequestId: NUSRAT_REQUEST_ID,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'IN_PROGRESS',
      toStatus: 'COMPLETED',
      occurredAt: droppedNusrat,
    }),
    event({
      type: EventType.POOL_COMPLETED,
      poolId: HISTORY_POOL_ID,
      actorUserId: jashim.id,
      fromStatus: 'STARTED',
      toStatus: 'COMPLETED',
      occurredAt: droppedNusrat,
    }),
  ]);
  await em.flush();
}
