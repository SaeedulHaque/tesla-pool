import { MAX_POOL_DETOUR_M } from '@tesla-pool/shared';
import type { DistanceProvider } from '../geography/distance-provider';
import type { RideRequest } from '../rides/ride-request.entity';
import type { Pool } from './pool.entity';

/** Strategy: swap in stricter or looser matching without touching Pool or any service. */
export interface PoolCompatibilityPolicy {
  accepts(pool: Pool, request: RideRequest): boolean;
}

/**
 * Same pick-up zone as the pool, and a drop-off within `maxDetourM` of every active member's
 * drop-off (the same zone counts as 0 m).
 */
export class DistanceCompatibilityPolicy implements PoolCompatibilityPolicy {
  constructor(
    private readonly distances: DistanceProvider,
    private readonly maxDetourM: number = MAX_POOL_DETOUR_M,
  ) {}

  accepts(pool: Pool, request: RideRequest): boolean {
    if (pool.pickupZoneId !== request.pickupZoneId) return false;
    return pool
      .activeRequests()
      .every(
        (member) =>
          this.distances.distanceM(member.dropoffZoneId, request.dropoffZoneId) <= this.maxDetourM,
      );
  }
}
