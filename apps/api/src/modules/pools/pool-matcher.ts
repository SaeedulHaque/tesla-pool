import type { EntityManager } from '@mikro-orm/postgresql';
import { Actor } from '../../shared/domain/actor';
import type { RideRequest } from '../rides/ride-request.entity';
import type { PoolCompatibilityPolicy } from './pool-compatibility-policy';
import type { Pool } from './pool.entity';
import type { PoolRepository } from './pool.repository';

/** Finds an existing pool for a new request. The passenger-side entry path into `Pool.admit`. */
export class PoolMatcher {
  constructor(
    private readonly pools: PoolRepository,
    private readonly compatibility: PoolCompatibilityPolicy,
  ) {}

  /**
   * Must run inside the transaction that created `request`. Returns the pool the request joined,
   * or null if none qualified (the request then stays REQUESTED and shows up in driver queues).
   */
  async tryAutoJoin(em: EntityManager, request: RideRequest): Promise<Pool | null> {
    const candidateIds = await this.pools.findJoinableIds(em, request.pickupZoneId, request.seats);

    for (const id of candidateIds) {
      // Row lock first, seat count read second: a competing transaction that got here earlier has
      // committed by the time this returns, and the refreshed row shows its seats.
      const pool = await this.pools.findByIdForUpdate(em, id);
      if (pool?.canAdmit(request, this.compatibility)) {
        pool.admit(request, this.compatibility, Actor.system());
        return pool;
      }
      // Full, started or incompatible on fresh data: try the next-oldest candidate.
    }
    return null;
  }
}
