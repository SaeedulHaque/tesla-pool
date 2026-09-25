import type { EntityManager } from '@mikro-orm/postgresql';
import type { DriverPoolDto, RideScope } from '@tesla-pool/shared';
import { Actor } from '../../shared/domain/actor';
import { NotFoundError } from '../../shared/domain/domain-error';
import type { Transactor } from '../../shared/transactor';
import type { AuditTrail } from '../audit/audit-trail';
import type { VehicleRepository } from '../drivers/vehicle.repository';
import type { FarePolicy } from '../pricing/fare-policy';
import type { Pool } from './pool.entity';
import type { PoolQueries } from './pool.queries';
import type { PoolRepository } from './pool.repository';

/** Driver trip use cases on a pool. Every public method is exactly one transaction. */
export class PoolService {
  constructor(
    private readonly transactor: Transactor,
    private readonly vehicles: VehicleRepository,
    private readonly pools: PoolRepository,
    private readonly farePolicy: FarePolicy,
    private readonly audit: AuditTrail,
    private readonly queries: PoolQueries,
  ) {}

  async list(driverId: string, scope: RideScope): Promise<DriverPoolDto[]> {
    return this.transactor.run(async (em) => {
      const pools = await this.pools.listForDriver(em, driverId, scope);
      return this.queries.driverViews(em, pools);
    });
  }

  arrive(driverId: string, poolId: string): Promise<DriverPoolDto> {
    return this.act(driverId, poolId, (pool, actor) => pool.arrive(actor));
  }

  /** Locks membership and finalizes every rider's fare through the FarePolicy. */
  start(driverId: string, poolId: string): Promise<DriverPoolDto> {
    return this.act(driverId, poolId, (pool, actor) => pool.start(actor, this.farePolicy));
  }

  /** One rider is dropped off; the last drop-off completes the pool. */
  dropOff(driverId: string, poolId: string, requestId: string): Promise<DriverPoolDto> {
    return this.act(driverId, poolId, (pool, actor) => pool.dropOff(requestId, actor));
  }

  /** Cancels the trip; riders return to the queue as REQUESTED. */
  cancel(driverId: string, poolId: string): Promise<DriverPoolDto> {
    return this.act(driverId, poolId, (pool, actor) => pool.cancelByDriver(actor));
  }

  /**
   * Shared shape of every trip action: lock (vehicle, then pool), check ownership, apply the
   * domain change, write the audit events, commit. A pool that is not yours is a 404.
   */
  private act(
    driverId: string,
    poolId: string,
    change: (pool: Pool, actor: Actor) => void,
  ): Promise<DriverPoolDto> {
    return this.transactor.run(async (em: EntityManager) => {
      const vehicle = await this.vehicles.findByDriverForUpdate(em, driverId);
      const pool = vehicle ? await this.pools.findByIdForUpdate(em, poolId) : null;
      if (!pool || !pool.isOwnedBy(driverId)) throw new NotFoundError('Pool');

      change(pool, Actor.user(driverId));
      this.audit.persist(em, pool, ...pool.memberships.getItems().map((m) => m.rideRequest));
      await em.flush();
      const [view] = await this.queries.driverViews(em, [pool]);
      return view;
    });
  }
}
