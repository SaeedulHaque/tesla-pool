import type { EntityManager } from '@mikro-orm/postgresql';
import type { DriverPoolDto } from '@tesla-pool/shared';
import { User } from '../auth/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import type { Pool } from './pool.entity';
import type { PoolPresenter } from './pool.presenter';

/** Read side for driver views. Pools passed in must have `memberships.rideRequest` loaded. */
export class PoolQueries {
  constructor(private readonly presenter: PoolPresenter) {}

  async driverViews(em: EntityManager, pools: readonly Pool[]): Promise<DriverPoolDto[]> {
    if (pools.length === 0) return [];
    const memberships = pools.flatMap((pool) => pool.activeMemberships());
    const passengerIds = [
      ...new Set(memberships.map((membership) => membership.rideRequest.passengerId)),
    ];
    const vehicleIds = [...new Set(pools.map((pool) => pool.vehicleId))];
    const [passengers, vehicles] = await Promise.all([
      passengerIds.length ? em.find(User, { id: { $in: passengerIds } }) : [],
      em.find(Vehicle, { id: { $in: vehicleIds } }),
    ]);
    const passengerName = new Map(passengers.map((user) => [user.id, user.fullName]));
    const vehicleName = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.displayName]));

    return pools.map((pool) =>
      this.presenter.forDriver(
        pool,
        vehicleName.get(pool.vehicleId) ?? 'Tesla',
        pool
          .activeMemberships()
          .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
          .map((membership) => ({
            membership,
            request: membership.rideRequest,
            passengerName: passengerName.get(membership.rideRequest.passengerId) ?? 'Passenger',
          })),
      ),
    );
  }
}
