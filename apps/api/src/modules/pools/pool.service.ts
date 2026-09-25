import type { DriverPoolDto, RideScope } from '@tesla-pool/shared';
import type { Transactor } from '../../shared/transactor';
import type { PoolQueries } from './pool.queries';
import type { PoolRepository } from './pool.repository';

/** Driver trip use cases on a pool. Every public method is exactly one transaction. */
export class PoolService {
  constructor(
    private readonly transactor: Transactor,
    private readonly pools: PoolRepository,
    private readonly queries: PoolQueries,
  ) {}

  async list(driverId: string, scope: RideScope): Promise<DriverPoolDto[]> {
    return this.transactor.run(async (em) => {
      const pools = await this.pools.listForDriver(em, driverId, scope);
      return this.queries.driverViews(em, pools);
    });
  }
}
