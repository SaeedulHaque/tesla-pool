import type { EntityManager } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from '../../src/modules/pools/pool.entity';
import { PoolRepository } from '../../src/modules/pools/pool.repository';
import { startHarness, type Harness } from './support/harness';
import { Scenario, TRIP, ZONE } from './support/scenario';

const RUNS = Number(process.env.CONCURRENCY_RUNS ?? 50);

describe('concurrent requests cannot corrupt capacity', () => {
  let h: Harness;
  let given: Scenario;
  beforeAll(async () => {
    h = await startHarness();
    given = new Scenario(h);
  });
  afterAll(async () => {
    await h.reset();
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  async function dbState(poolId: string) {
    const conn = h.orm.em.getConnection();
    const [pool] = await conn.execute<{ seats_occupied: number }[]>(
      'select seats_occupied from pools where id = ?',
      [poolId],
    );
    const [{ n }] = await conn.execute<{ n: string }[]>(
      'select coalesce(sum(r.seats), 0) n from pool_memberships m join ride_requests r on r.id = m.ride_request_id where m.pool_id = ? and m.left_at is null',
      [poolId],
    );
    return { seatsOccupied: pool.seats_occupied, seatsInMemberships: Number(n) };
  }

  it(`Nusrat and Shirin race for Bullet's last seat: exactly one is MATCHED, ${RUNS} times`, async () => {
    const nusrat = await h.as('nusrat');
    const shirin = await h.as('shirin');
    const outcomes = { nusratWon: 0, shirinWon: 0 };

    for (let run = 1; run <= RUNS; run += 1) {
      await h.reset();
      const { poolId } = await given.bulletAtBanani({ seatsTaken: 2 }); // Rafiq holds 2 of 3

      const [a, b] = await Promise.all([
        nusrat.post('/ride-requests', TRIP.nusrat),
        shirin.post('/ride-requests', TRIP.shirin),
      ]);
      expect([a.status, b.status], `run ${run}`).toEqual([201, 201]);
      const statuses = [a.body.ride.status, b.body.ride.status].sort();
      expect(statuses, `run ${run}`).toEqual(['MATCHED', 'REQUESTED']);

      const state = await dbState(poolId as string);
      expect(state, `run ${run}`).toEqual({ seatsOccupied: 3, seatsInMemberships: 3 });

      if (a.body.ride.status === 'MATCHED') outcomes.nusratWon += 1;
      else outcomes.shirinWon += 1;
    }
    // Either passenger may win any single run; the invariant is what matters.
    expect(outcomes.nusratWon + outcomes.shirinWon).toBe(RUNS);
  });

  it('the loser stays REQUESTED and appears in the drivers queue, not lost', async () => {
    await given.bulletAtBanani({ seatsTaken: 2 });
    const [a, b] = await Promise.all([
      (await h.as('nusrat')).post('/ride-requests', TRIP.nusrat),
      (await h.as('shirin')).post('/ride-requests', TRIP.shirin),
    ]);
    const loser = a.body.ride.status === 'REQUESTED' ? a.body.ride : b.body.ride;
    const queue = await (await h.as('jashim')).get('/driver/queue');
    expect(queue.body.items.map((item: { id: string }) => item.id)).toEqual([loser.id]);
  });

  it('a crowd of eight new passengers competing for two free seats fills Bullet exactly', async () => {
    const { poolId } = await given.bulletAtBanani({ seatsTaken: 1 });
    const crowd = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        h.registerPassenger(`Rider ${i + 1}`, `+88017110001${String(i).padStart(2, '0')}`),
      ),
    );
    const responses = await Promise.all(
      crowd.map((session) => session.post('/ride-requests', TRIP.nusrat)),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201));
    const matched = responses.filter((r) => r.body.ride.status === 'MATCHED').length;
    expect(matched).toBe(2);
    expect(await dbState(poolId as string)).toEqual({ seatsOccupied: 3, seatsInMemberships: 3 });
  });

  it('driver accept and passenger auto-join race for the last seat: exactly one wins, 20 times', async () => {
    const jashim = await h.as('jashim');
    const shirin = await h.as('shirin');

    for (let run = 1; run <= 20; run += 1) {
      await h.reset();
      // Three riders ask before any pool exists, so all of them wait in the queue.
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const waiting = await h.registerPassenger(
        `Waiting ${run}`,
        `+8801712${String(run).padStart(6, '0')}`,
      );
      const queued = (await waiting.post('/ride-requests', TRIP.nusrat)).body.ride;
      expect(queued.status).toBe('REQUESTED');

      await given.goOnline('jashim', ZONE.BANANI);
      const { id: poolId } = await given.accept('jashim', rafiq.id);
      await given.accept('jashim', nusrat.id); // Bullet is 2/3: exactly one seat left

      // Accept path (driver takes the queued rider) against auto-join path (Shirin's new request).
      const [accept, auto] = await Promise.all([
        jashim.post(`/driver/queue/${queued.id}/accept`),
        shirin.post('/ride-requests', TRIP.shirin),
      ]);

      const driverWon = accept.status === 200;
      const autoWon = auto.body.ride.status === 'MATCHED';
      expect(driverWon !== autoWon, `run ${run}: exactly one path gets the seat`).toBe(true);
      if (!driverWon) {
        expect(accept.status, `run ${run}`).toBe(409);
        expect(accept.body.error.code).toBe('POOL_FULL');
      }
      expect(await dbState(poolId), `run ${run}`).toEqual({
        seatsOccupied: 3,
        seatsInMemberships: 3,
      });
    }
  });
});

/**
 * The tests above depend on timing to overlap. This one forces the overlap: both transactions
 * are held right after they read the pool, for up to 300 ms, to give each the chance to act on a
 * stale seat count. With the row lock, the second transaction cannot even read until the first
 * commits, so the pause changes nothing. Without the lock, both would see 2/3 and overbook.
 */
describe('the row lock is what protects the last seat (forced interleaving)', () => {
  class PauseAfterRead extends PoolRepository {
    private arrivals = 0;
    private release: (() => void) | null = null;
    private gate: Promise<void> | null = null;
    reads = 0;

    override async findByIdForUpdate(em: EntityManager, id: string): Promise<Pool | null> {
      const pool = await super.findByIdForUpdate(em, id);
      this.reads += 1;
      this.gate ??= new Promise<void>((resolve) => {
        this.release = resolve;
        setTimeout(resolve, 300);
      });
      this.arrivals += 1;
      if (this.arrivals >= 2) this.release?.();
      await this.gate;
      return pool;
    }
  }

  let h: Harness;
  let given: Scenario;
  let repository: PauseAfterRead;

  beforeAll(async () => {
    repository = new PauseAfterRead();
    h = await startHarness({}, { poolRepository: repository });
    given = new Scenario(h);
  });
  afterAll(async () => {
    await h.reset();
    await h.close();
  });

  it('still seats exactly one of two racing passengers', async () => {
    await h.reset();
    const { poolId } = await given.bulletAtBanani({ seatsTaken: 2 });
    // bulletAtBanani used the pool repository too; measure only the race itself.
    const readsBefore = repository.reads;
    // Reset the barrier for the race.
    Object.assign(repository, { arrivals: 0, gate: null, release: null });

    const [a, b] = await Promise.all([
      (await h.as('nusrat')).post('/ride-requests', TRIP.nusrat),
      (await h.as('shirin')).post('/ride-requests', TRIP.shirin),
    ]);
    expect([a.body.ride.status, b.body.ride.status].sort()).toEqual(['MATCHED', 'REQUESTED']);
    const [pool] = await h.orm.em
      .getConnection()
      .execute<{ seats_occupied: number }[]>('select seats_occupied from pools where id = ?', [
        poolId,
      ]);
    const [{ n }] = await h.orm.em
      .getConnection()
      .execute<{ n: string }[]>(
        'select coalesce(sum(r.seats), 0) n from pool_memberships m join ride_requests r on r.id = m.ride_request_id where m.pool_id = ? and m.left_at is null',
        [poolId],
      );
    expect([pool.seats_occupied, Number(n)]).toEqual([3, 3]);
    expect(repository.reads - readsBefore).toBeGreaterThanOrEqual(2); // both really did read the pool
  });
});
