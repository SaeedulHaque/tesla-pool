import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { ACTIVE_POOL_STATUSES, type RideScope } from '@tesla-pool/shared';
import { Pool } from './pool.entity';

const HISTORY_PAGE_SIZE = 50;

export class PoolRepository {
  add(em: EntityManager, pool: Pool): void {
    em.persist(pool);
  }

  /**
   * Locks the pool row alone, then loads members in a second query. Postgres rejects
   * `FOR UPDATE` across an outer join, which a joined populate would produce. `refresh` makes
   * sure the seat count comes from the locked read, never from an earlier identity-map copy.
   */
  async findByIdForUpdate(em: EntityManager, id: string): Promise<Pool | null> {
    const pool = await em.findOne(
      Pool,
      { id },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
    if (pool) await this.loadMembers(em, pool);
    return pool;
  }

  async findActiveForVehicleForUpdate(em: EntityManager, vehicleId: string): Promise<Pool | null> {
    const pool = await em.findOne(
      Pool,
      { vehicleId, status: { $in: [...ACTIVE_POOL_STATUSES] } },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
    if (pool) await this.loadMembers(em, pool);
    return pool;
  }

  /** Unlocked read for display (queue flags, lists); never use it to decide an admission. */
  async findActiveForVehicle(em: EntityManager, vehicleId: string): Promise<Pool | null> {
    const pool = await em.findOne(Pool, { vehicleId, status: { $in: [...ACTIVE_POOL_STATUSES] } });
    if (pool) await this.loadMembers(em, pool);
    return pool;
  }

  /**
   * Cheap, lock-free pre-filter, oldest first (the fixed `created_at, id` order is also the lock
   * order, so two matchers can never deadlock). Its answer is only a hint: callers must lock each
   * candidate and re-check on the fresh row.
   */
  async findJoinableIds(em: EntityManager, pickupZoneId: number, seats: number): Promise<string[]> {
    const rows = await em.execute<{ id: string }[]>(
      `select id from pools
        where status in ('ACCEPTED', 'DRIVER_ARRIVED')
          and pickup_zone_id = ?
          and seats_occupied + ? <= seat_capacity
        order by created_at, id`,
      [pickupZoneId, seats],
    );
    return rows.map((row) => row.id);
  }

  async listForDriver(em: EntityManager, driverId: string, scope: RideScope): Promise<Pool[]> {
    const pools =
      scope === 'active'
        ? await em.find(
            Pool,
            { driverId, status: { $in: [...ACTIVE_POOL_STATUSES] } },
            { orderBy: { createdAt: 'desc' } },
          )
        : await em.find(
            Pool,
            { driverId, status: { $in: ['COMPLETED', 'CANCELLED'] } },
            { orderBy: { createdAt: 'desc' }, limit: HISTORY_PAGE_SIZE },
          );
    for (const pool of pools) await this.loadMembers(em, pool);
    return pools;
  }

  private async loadMembers(em: EntityManager, pool: Pool): Promise<void> {
    await em.populate(pool, ['memberships.rideRequest']);
  }
}
