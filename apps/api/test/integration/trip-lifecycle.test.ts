import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness, type Person } from './support/harness';
import { Scenario, TRIP, ZONE } from './support/scenario';

type Fare = { basePaisa: number; distancePaisa: number; discountPaisa: number; totalPaisa: number };

describe('trip lifecycle', () => {
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

  const ride = async (person: Person, id: string) =>
    (await (await h.as(person)).get(`/ride-requests/${id}`)).body.ride;
  const poolAction = async (driver: Person, poolId: string, action: string) =>
    (await h.as(driver)).post(`/pools/${poolId}/${action}`);
  const dropOff = async (driver: Person, poolId: string, requestId: string) =>
    (await h.as(driver)).post(`/pools/${poolId}/members/${requestId}/drop-off`);
  const sql = <T>(query: string, params: unknown[] = []) =>
    h.orm.em.getConnection().execute<T[]>(query, params);

  /** Nusrat accepted, Rafiq and Shirin auto-joined: Bullet is 3/3 and waiting at Banani. */
  async function fullBullet() {
    await given.goOnline('jashim', ZONE.BANANI);
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    const pool = await given.accept('jashim', nusrat.id);
    const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
    const shirin = await given.requestRide('shirin', TRIP.shirin);
    expect([rafiq.status, shirin.status]).toEqual(['MATCHED', 'MATCHED']);
    return { poolId: pool.id, nusrat: nusrat.id, rafiq: rafiq.id, shirin: shirin.id };
  }

  /** Just Nusrat and Rafiq aboard, the reference fare example. */
  async function nusratAndRafiq() {
    await given.goOnline('jashim', ZONE.BANANI);
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    const pool = await given.accept('jashim', nusrat.id);
    const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
    return { poolId: pool.id, nusrat: nusrat.id, rafiq: rafiq.id };
  }

  describe('the full Nusrat, Rafiq and Shirin story', () => {
    it('runs from request to completed pool with the reference fares', async () => {
      const ids = await fullBullet();

      // Driver arrives: passengers see it, and the pool still shows 3/3.
      const arrived = await poolAction('jashim', ids.poolId, 'arrive');
      expect(arrived.status).toBe(200);
      expect(arrived.body.pool).toMatchObject({ status: 'DRIVER_ARRIVED', seatsOccupied: 3 });
      const nusratWaiting = await ride('nusrat', ids.nusrat);
      expect(nusratWaiting.pool).toEqual({
        status: 'DRIVER_ARRIVED',
        driverName: 'Jashim',
        vehicleName: 'Bullet',
        coRiderCount: 2,
      });
      expect(nusratWaiting.timeline.map((e: { type: string }) => e.type)).toEqual([
        'RIDE_REQUESTED',
        'REQUEST_MATCHED',
        'DRIVER_ARRIVED',
      ]);
      expect(nusratWaiting.fare.final).toBeNull();

      // Start: every fare is finalized once.
      const start = await poolAction('jashim', ids.poolId, 'start');
      expect(start.status).toBe(200);
      expect(start.body.pool.status).toBe('STARTED');
      const finals: Record<string, Fare> = {};
      for (const [person, id] of [
        ['nusrat', ids.nusrat],
        ['rafiq', ids.rafiq],
        ['shirin', ids.shirin],
      ] as const) {
        const r = await ride(person, id);
        expect(r.status).toBe('IN_PROGRESS');
        finals[person] = r.fare.final;
      }
      expect(finals.nusrat).toEqual({
        basePaisa: 3_000,
        distancePaisa: 6_000,
        discountPaisa: 1_800,
        totalPaisa: 7_200,
      });
      expect(finals.rafiq).toEqual({
        basePaisa: 3_000,
        distancePaisa: 4_000,
        discountPaisa: 1_200,
        totalPaisa: 5_800,
      });
      expect(finals.shirin).toEqual(finals.nusrat);

      // Drop-offs: the last one completes the pool.
      expect((await dropOff('jashim', ids.poolId, ids.rafiq)).body.pool.status).toBe('STARTED');
      expect((await dropOff('jashim', ids.poolId, ids.nusrat)).body.pool.status).toBe('STARTED');
      const last = await dropOff('jashim', ids.poolId, ids.shirin);
      expect(last.body.pool.status).toBe('COMPLETED');
      expect(
        last.body.pool.members.map(
          (m: { passengerName: string; status: string; farePaisa: number }) => [
            m.passengerName,
            m.status,
            m.farePaisa,
          ],
        ),
      ).toEqual([
        ['Nusrat', 'COMPLETED', 7_200],
        ['Rafiq', 'COMPLETED', 5_800],
        ['Shirin', 'COMPLETED', 7_200],
      ]);

      // Fares never moved.
      expect((await ride('nusrat', ids.nusrat)).fare.final).toEqual(finals.nusrat);
      expect((await ride('rafiq', ids.rafiq)).fare.final).toEqual(finals.rafiq);

      // Histories.
      const nusrat = await h.as('nusrat');
      expect((await nusrat.get('/ride-requests?scope=active')).body.items).toEqual([]);
      expect((await nusrat.get('/ride-requests?scope=history')).body.items).toMatchObject([
        { status: 'COMPLETED', completedAt: expect.any(String) },
      ]);
      const jashim = await h.as('jashim');
      expect((await jashim.get('/pools?scope=active')).body.items).toEqual([]);
      expect((await jashim.get('/pools?scope=history')).body.items).toMatchObject([
        { id: ids.poolId, status: 'COMPLETED', seatsOccupied: 3 },
      ]);

      // Jashim is free again.
      expect((await jashim.put('/driver/availability', { online: false })).status).toBe(200);

      // Every transition left a trace.
      const types = (await sql<{ type: string }>('select type from ride_events order by id')).map(
        (row) => row.type,
      );
      const count = (type: string) => types.filter((t) => t === type).length;
      expect(count('RIDE_REQUESTED')).toBe(3);
      expect(count('PASSENGER_JOINED')).toBe(3);
      expect(count('REQUEST_STARTED')).toBe(3);
      expect(count('REQUEST_COMPLETED')).toBe(3);
      expect([
        count('POOL_CREATED'),
        count('DRIVER_ARRIVED'),
        count('POOL_STARTED'),
        count('POOL_COMPLETED'),
      ]).toEqual([1, 1, 1, 1]);
    });

    it('lets new riders join after the driver has arrived, but not after the trip starts', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      const shirin = await given.requestRide('shirin', TRIP.shirin);
      expect(shirin.status).toBe('MATCHED');
      expect(await given.seatsOccupied(poolId)).toBe(3);

      await poolAction('jashim', poolId, 'start');
      // A stranger requests once Bullet is on its way: nothing to join, and the driver cannot accept.
      const late = await h.registerPassenger('Latecomer', '+8801711000077');
      const lateRide = (await late.post('/ride-requests', TRIP.nusrat)).body.ride;
      expect(lateRide.status).toBe('REQUESTED');
      const attempt = await (await h.as('jashim')).post(`/driver/queue/${lateRide.id}/accept`);
      expect(attempt.status).toBe(409);
      expect(attempt.body.error.code).toBe('POOL_NOT_JOINABLE');
    });
  });

  describe('fares lock at start', () => {
    it('Rafiq cancels before start: Nusrat pays the solo fare of 90 taka', async () => {
      const { poolId, nusrat, rafiq } = await nusratAndRafiq();
      const cancelled = await (await h.as('rafiq')).post(`/ride-requests/${rafiq}/cancel`);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.ride.status).toBe('CANCELLED');

      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      const r = await ride('nusrat', nusrat);
      expect(r.fare.final).toEqual({
        basePaisa: 3_000,
        distancePaisa: 6_000,
        discountPaisa: 0,
        totalPaisa: 9_000,
      });
    });

    it('a co-rider cancelling after start is impossible, so the fare cannot change', async () => {
      const { poolId, nusrat, rafiq } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      const attempt = await (await h.as('rafiq')).post(`/ride-requests/${rafiq}/cancel`);
      expect(attempt.status).toBe(409);
      expect(attempt.body.error.code).toBe('INVALID_TRANSITION');
      expect((await ride('nusrat', nusrat)).fare.final.totalPaisa).toBe(7_200);
    });

    it('stores the pricing version with the final fare', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      const rows = await sql<{ pricing_version: string; fare_total_paisa: number }>(
        'select pricing_version, fare_total_paisa from ride_requests order by fare_total_paisa',
      );
      expect(rows).toEqual([
        { pricing_version: 'v1', fare_total_paisa: 5_800 },
        { pricing_version: 'v1', fare_total_paisa: 7_200 },
      ]);
    });
  });

  describe('cancellation rules', () => {
    it('cancelling while MATCHED frees the seat and closes the membership', async () => {
      const { poolId, rafiq } = await nusratAndRafiq();
      expect(await given.seatsOccupied(poolId)).toBe(2);
      const response = await (await h.as('rafiq')).post(`/ride-requests/${rafiq}/cancel`);
      expect(response.status).toBe(200);
      expect(response.body.ride.pool).toBeNull();
      expect(await given.seatsOccupied(poolId)).toBe(1);

      const [membership] = await sql<{ left_at: string | null; leave_reason: string | null }>(
        'select left_at, leave_reason from pool_memberships where ride_request_id = ?',
        [rafiq],
      );
      expect(membership.left_at).not.toBeNull();
      expect(membership.leave_reason).toBe('PASSENGER_CANCELLED');
      expect(
        (await (await h.as('jashim')).get('/pools?scope=active')).body.items[0].members,
      ).toHaveLength(1);
    });

    it('the seat Rafiq gave up can be taken by Shirin', async () => {
      const { poolId, rafiq } = await fullBullet().then(async (ids) => ids);
      await (await h.as('rafiq')).post(`/ride-requests/${rafiq}/cancel`);
      expect(await given.seatsOccupied(poolId)).toBe(2);
      const late = await h.registerPassenger('Latecomer', '+8801711000078');
      expect((await late.post('/ride-requests', TRIP.nusrat)).body.ride.status).toBe('MATCHED');
      expect(await given.seatsOccupied(poolId)).toBe(3);
    });

    it('the pool cancels itself when its last rider leaves', async () => {
      const { poolId, nusrat } = await given.goOnline('jashim', ZONE.BANANI).then(async () => {
        const n = await given.requestRide('nusrat', TRIP.nusrat);
        const p = await given.accept('jashim', n.id);
        return { poolId: p.id, nusrat: n.id };
      });
      await (await h.as('nusrat')).post(`/ride-requests/${nusrat}/cancel`);
      const [pool] = await sql<{ status: string; seats_occupied: number }>(
        'select status, seats_occupied from pools where id = ?',
        [poolId],
      );
      expect(pool).toEqual({ status: 'CANCELLED', seats_occupied: 0 });
      const jashim = await h.as('jashim');
      expect((await jashim.get('/pools?scope=active')).body.items).toEqual([]);
      expect((await jashim.put('/driver/availability', { online: false })).status).toBe(200);
      // And a cancelled pool never takes new riders.
      await given.goOnline('jashim', ZONE.BANANI);
      expect((await given.requestRide('rafiq', TRIP.rafiq)).status).toBe('REQUESTED');
    });

    it('driver cancel sends riders back to the queue as REQUESTED, not CANCELLED', async () => {
      const { poolId, nusrat, rafiq } = await nusratAndRafiq();
      const response = await poolAction('jashim', poolId, 'cancel');
      expect(response.status).toBe(200);
      expect(response.body.pool.status).toBe('CANCELLED');

      for (const [person, id] of [
        ['nusrat', nusrat],
        ['rafiq', rafiq],
      ] as const) {
        const r = await ride(person, id);
        expect(r.status).toBe('REQUESTED');
        expect(r.pool).toBeNull();
        expect(r.cancelledAt).toBeNull();
      }
      const memberships = await sql<{ leave_reason: string; left_at: string }>(
        'select leave_reason, left_at from pool_memberships',
      );
      expect(memberships.map((m) => m.leave_reason)).toEqual([
        'DRIVER_CANCELLED',
        'DRIVER_CANCELLED',
      ]);
      expect(memberships.every((m) => m.left_at !== null)).toBe(true);
      expect(await given.seatsOccupied(poolId)).toBe(0);

      // They are not re-matched inside the same transaction: they wait in drivers' queues.
      const queue = await (await h.as('jashim')).get('/driver/queue');
      expect(
        queue.body.items.map((i: { passengerName: string }) => i.passengerName).sort(),
      ).toEqual(['Nusrat', 'Rafiq']);

      // Another driver can take them, and they keep their place as ordinary passengers.
      await given.goOnline('kamal', ZONE.BANANI);
      const pool = await given.accept('kamal', nusrat);
      expect(pool.id).not.toBe(poolId);
      expect((await ride('nusrat', nusrat)).pool).toMatchObject({
        driverName: 'Kamal',
        vehicleName: 'Toofan',
      });
    });

    it('a cancelled pool leaves the driver free to work again', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'cancel');
      const jashim = await h.as('jashim');
      expect((await jashim.put('/driver/availability', { online: false })).status).toBe(200);
    });
  });

  describe('invalid transitions are 409 INVALID_TRANSITION', () => {
    async function expectConflict(response: { status: number; body: { error: { code: string } } }) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_TRANSITION');
    }

    it('start before arrive', async () => {
      const { poolId } = await nusratAndRafiq();
      await expectConflict(await poolAction('jashim', poolId, 'start'));
      expect((await (await h.as('jashim')).get('/pools')).body.items[0].status).toBe('ACCEPTED');
    });

    it('arrive twice', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await expectConflict(await poolAction('jashim', poolId, 'arrive'));
    });

    it('start twice', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      await expectConflict(await poolAction('jashim', poolId, 'start'));
    });

    it('drop-off before start', async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await expectConflict(await dropOff('jashim', poolId, nusrat));
    });

    it('drop-off twice', async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      expect((await dropOff('jashim', poolId, nusrat)).status).toBe(200);
      await expectConflict(await dropOff('jashim', poolId, nusrat));
    });

    it('passenger cancel after start', async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      await expectConflict(await (await h.as('nusrat')).post(`/ride-requests/${nusrat}/cancel`));
      expect((await ride('nusrat', nusrat)).status).toBe('IN_PROGRESS');
    });

    it('driver cancel after start', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      await expectConflict(await poolAction('jashim', poolId, 'cancel'));
    });

    it('anything on a finished pool', async () => {
      const { poolId, nusrat, rafiq } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      await dropOff('jashim', poolId, nusrat);
      await dropOff('jashim', poolId, rafiq);
      for (const action of ['arrive', 'start', 'cancel'])
        await expectConflict(await poolAction('jashim', poolId, action));
    });

    it('cancelling a cancelled ride', async () => {
      const { rafiq } = await nusratAndRafiq();
      const rafiqSession = await h.as('rafiq');
      await rafiqSession.post(`/ride-requests/${rafiq}/cancel`);
      await expectConflict(await rafiqSession.post(`/ride-requests/${rafiq}/cancel`));
    });
  });

  describe('ownership', () => {
    it("Kamal cannot arrive, start, drop off or cancel Jashim's pool: 404, and nothing changes", async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      await given.goOnline('kamal', ZONE.BANANI);
      for (const action of ['arrive', 'start', 'cancel']) {
        const response = await poolAction('kamal', poolId, action);
        expect(response.status, action).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      }
      expect((await dropOff('kamal', poolId, nusrat)).status).toBe(404);
      expect((await (await h.as('jashim')).get('/pools')).body.items[0]).toMatchObject({
        status: 'ACCEPTED',
        seatsOccupied: 2,
      });
    });

    it('a pool that does not exist answers exactly like a pool that is not yours', async () => {
      const { poolId } = await nusratAndRafiq();
      const kamal = await h.as('kamal');
      const foreign = await kamal.post(`/pools/${poolId}/start`);
      const missing = await kamal.post('/pools/00000000-0000-4000-8000-000000000000/start');
      expect([foreign.status, missing.status]).toEqual([404, 404]);
      expect(foreign.body.error.message).toBe(missing.body.error.message);
    });

    it('passengers get 403 on every driver route', async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      const nusratSession = await h.as('nusrat');
      for (const response of [
        await nusratSession.post(`/pools/${poolId}/arrive`),
        await nusratSession.post(`/pools/${poolId}/start`),
        await nusratSession.post(`/pools/${poolId}/cancel`),
        await nusratSession.post(`/pools/${poolId}/members/${nusrat}/drop-off`),
        await nusratSession.get('/pools'),
        await nusratSession.get('/driver/queue'),
      ]) {
        expect(response.status).toBe(403);
      }
    });

    it("Rafiq cannot cancel Nusrat's MATCHED ride: 404, and her seat stays taken", async () => {
      const { poolId, nusrat } = await nusratAndRafiq();
      const response = await (await h.as('rafiq')).post(`/ride-requests/${nusrat}/cancel`);
      expect(response.status).toBe(404);
      expect(await given.seatsOccupied(poolId)).toBe(2);
      expect((await ride('nusrat', nusrat)).status).toBe('MATCHED');
    });

    it('anonymous callers get 401', async () => {
      const { poolId } = await nusratAndRafiq();
      expect((await h.anonymous().post(`/pools/${poolId}/start`)).status).toBe(401);
    });

    it('rejects malformed ids with 400', async () => {
      const jashim = await h.as('jashim');
      expect((await jashim.post('/pools/nope/start')).status).toBe(400);
      expect(
        (await jashim.post('/pools/00000000-0000-4000-8000-000000000000/members/nope/drop-off'))
          .status,
      ).toBe(400);
    });

    it('drop-off of someone who is not in the pool is 404', async () => {
      const { poolId } = await nusratAndRafiq();
      await poolAction('jashim', poolId, 'arrive');
      await poolAction('jashim', poolId, 'start');
      const stranger = await given.requestRide('shirin', TRIP.shirin); // arrives after start: not a member
      expect((await dropOff('jashim', poolId, stranger.id)).status).toBe(404);
    });
  });

  describe('races around cancellation stay consistent', () => {
    it('Nusrat cancelling while Jashim starts the trip: either she is out and pays nothing, or she is in with a locked fare', async () => {
      for (let run = 1; run <= 15; run += 1) {
        await h.reset();
        const { poolId, nusrat } = await nusratAndRafiq();
        await poolAction('jashim', poolId, 'arrive');
        const [cancel, start] = await Promise.all([
          (await h.as('nusrat')).post(`/ride-requests/${nusrat}/cancel`),
          poolAction('jashim', poolId, 'start'),
        ]);
        expect(start.status, `run ${run}`).toBe(200);
        const final = await ride('nusrat', nusrat);
        if (cancel.status === 200) {
          expect(final.status, `run ${run}`).toBe('CANCELLED');
          expect(final.fare.final, `run ${run}`).toBeNull();
        } else {
          expect(cancel.status, `run ${run}`).toBe(409);
          expect(final.status, `run ${run}`).toBe('IN_PROGRESS');
          // Rafiq stays aboard alone (cancel lost) or both paid pooled: whichever, the fare is locked.
          expect(final.fare.final.totalPaisa, `run ${run}`).toBe(7_200);
        }
      }
    });

    it('a passenger and the driver both cancelling ends with everyone consistent', async () => {
      for (let run = 1; run <= 15; run += 1) {
        await h.reset();
        await given.goOnline('jashim', ZONE.BANANI);
        const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
        const pool = await given.accept('jashim', nusrat.id);
        const [passenger, driver] = await Promise.all([
          (await h.as('nusrat')).post(`/ride-requests/${nusrat.id}/cancel`),
          poolAction('jashim', pool.id, 'cancel'),
        ]);
        expect(passenger.status, `run ${run}`).toBe(200);
        expect([200, 409], `run ${run}`).toContain(driver.status);
        const [{ status }] = await sql<{ status: string }>(
          'select status from pools where id = ?',
          [pool.id],
        );
        expect(status, `run ${run}`).toBe('CANCELLED');
        expect((await ride('nusrat', nusrat.id)).status, `run ${run}`).toBe('CANCELLED');
        expect(await given.seatsOccupied(pool.id), `run ${run}`).toBe(0);
        const active = await sql<{ n: string }>(
          'select count(*) n from pool_memberships where left_at is null',
        );
        expect(Number(active[0].n), `run ${run}`).toBe(0);
      }
    });
  });
});
