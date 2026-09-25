import type { EntityManager } from '@mikro-orm/postgresql';
import type { RideDto } from '@tesla-pool/shared';
import { EventType } from '../audit/event-types';
import { RideEvent } from '../audit/ride-event.entity';
import { User } from '../auth/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { PoolMembership } from '../pools/pool-membership.entity';
import type { Pool } from '../pools/pool.entity';
import {
  PASSENGER_TIMELINE_TYPES,
  type PassengerPoolFacts,
  type RidePresenter,
} from './ride.presenter';
import type { RideRequest } from './ride-request.entity';

/**
 * Read side for the passenger views. Loads everything for a batch of rides in a fixed number
 * of queries (no N+1), then hands plain facts to the presenter.
 */
export class RideQueries {
  constructor(private readonly presenter: RidePresenter) {}

  async passengerViews(
    em: EntityManager,
    requests: readonly RideRequest[],
    options: { timeline: boolean } = { timeline: false },
  ): Promise<RideDto[]> {
    if (requests.length === 0) return [];
    const requestIds = requests.map((request) => request.id);

    // A ride's pool is the one it is (or was, if completed) an active member of.
    const mine = await em.find(
      PoolMembership,
      { rideRequest: { $in: requestIds }, leftAt: null },
      { populate: ['pool'] },
    );
    const poolByRequest = new Map<string, { pool: Pool; membership: PoolMembership }>(
      mine.map((membership) => [membership.rideRequest.id, { pool: membership.pool, membership }]),
    );
    const pools = [...new Set(mine.map((membership) => membership.pool))];
    const poolIds = pools.map((pool) => pool.id);

    const [vehicles, drivers, allMembers] = await Promise.all([
      poolIds.length ? em.find(Vehicle, { id: { $in: pools.map((pool) => pool.vehicleId) } }) : [],
      poolIds.length ? em.find(User, { id: { $in: pools.map((pool) => pool.driverId) } }) : [],
      poolIds.length ? em.find(PoolMembership, { pool: { $in: poolIds }, leftAt: null }) : [],
    ]);
    const vehicleName = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.displayName]));
    const driverName = new Map(drivers.map((driver) => [driver.id, driver.fullName]));
    const memberCount = new Map<string, number>();
    for (const member of allMembers) {
      memberCount.set(member.pool.id, (memberCount.get(member.pool.id) ?? 0) + 1);
    }

    const events = options.timeline
      ? await this.loadTimeline(em, requestIds, poolByRequest)
      : new Map<string, RideEvent[]>();

    return requests.map((request) => {
      const link = poolByRequest.get(request.id);
      const facts: PassengerPoolFacts | null = link
        ? {
            status: link.pool.status,
            driverName: driverName.get(link.pool.driverId) ?? 'Your driver',
            vehicleName: vehicleName.get(link.pool.vehicleId) ?? 'Tesla',
            coRiderCount: Math.max(0, (memberCount.get(link.pool.id) ?? 1) - 1),
          }
        : null;
      return this.presenter.forPassenger(
        request,
        facts,
        options.timeline ? (events.get(request.id) ?? []) : undefined,
      );
    });
  }

  /** Own request events, plus "driver arrived" for the pool the passenger is in. Nothing about co-riders. */
  private async loadTimeline(
    em: EntityManager,
    requestIds: string[],
    poolByRequest: Map<string, { pool: Pool; membership: PoolMembership }>,
  ): Promise<Map<string, RideEvent[]>> {
    const own = await em.find(
      RideEvent,
      { rideRequestId: { $in: requestIds }, type: { $in: [...PASSENGER_TIMELINE_TYPES] } },
      { orderBy: { occurredAt: 'asc', id: 'asc' } },
    );
    const poolIds = [...new Set([...poolByRequest.values()].map((link) => link.pool.id))];
    const arrivals = poolIds.length
      ? await em.find(RideEvent, { poolId: { $in: poolIds }, type: EventType.DRIVER_ARRIVED })
      : [];

    const result = new Map<string, RideEvent[]>(requestIds.map((id) => [id, []]));
    for (const event of own) result.get(event.rideRequestId as string)?.push(event);
    for (const [requestId, link] of poolByRequest) {
      for (const arrival of arrivals) {
        if (arrival.poolId === link.pool.id && arrival.occurredAt >= link.membership.joinedAt) {
          result.get(requestId)?.push(arrival);
        }
      }
    }
    for (const list of result.values())
      list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return result;
  }
}
