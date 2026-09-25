import type { DriverPoolDto } from '@tesla-pool/shared';
import type { ZoneNames } from '../rides/ride.presenter';
import type { RideRequest } from '../rides/ride-request.entity';
import type { Pool } from './pool.entity';
import type { PoolMembership } from './pool-membership.entity';

export interface DriverPoolMemberFacts {
  membership: PoolMembership;
  request: RideRequest;
  passengerName: string;
}

export class PoolPresenter {
  constructor(private readonly zones: ZoneNames) {}

  forDriver(
    pool: Pool,
    vehicleName: string,
    members: readonly DriverPoolMemberFacts[],
  ): DriverPoolDto {
    return {
      id: pool.id,
      status: pool.status,
      pickup: this.zones.nameOf(pool.pickupZoneId),
      vehicleName,
      seatCapacity: pool.seatCapacity,
      seatsOccupied: pool.seatsOccupied,
      createdAt: pool.createdAt.toISOString(),
      members: members.map(({ membership, request, passengerName }) => ({
        requestId: request.id,
        passengerName,
        dropoff: this.zones.nameOf(request.dropoffZoneId),
        seats: request.seats,
        status: request.status,
        farePaisa: request.fareTotalPaisa,
        joinedAt: membership.joinedAt.toISOString(),
      })),
    };
  }
}
