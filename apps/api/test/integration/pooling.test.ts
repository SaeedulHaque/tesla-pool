import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';
import { Scenario, TRIP, ZONE } from './support/scenario';

describe('pooling: auto-join', () => {
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

  const rideOf = async (person: 'nusrat' | 'rafiq' | 'shirin', id: string) =>
    (await (await h.as(person)).get(`/ride-requests/${id}`)).body.ride;

  it('walks the reference story: Nusrat accepted, Rafiq and Shirin auto-join, Bullet is 3/3', async () => {
    await given.goOnline('jashim', ZONE.BANANI);
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    expect(nusrat.status).toBe('REQUESTED'); // no pool exists yet
    const pool = await given.accept('jashim', nusrat.id);
    expect(pool.seatsOccupied).toBe(1);

    const rafiq = await given.requestRide('rafiq', TRIP.rafiq); // Gulshan 1 <-> Mohakhali = 2.5 km
    expect(rafiq.status).toBe('MATCHED');
    expect(await given.seatsOccupied(pool.id)).toBe(2);

    const shirin = await given.requestRide('shirin', TRIP.shirin);
    expect(shirin.status).toBe('MATCHED');
    expect(await given.seatsOccupied(pool.id)).toBe(3);

    expect((await rideOf('nusrat', nusrat.id)).pool).toEqual({
      status: 'ACCEPTED',
      driverName: 'Jashim',
      vehicleName: 'Bullet',
      coRiderCount: 2,
    });
  });

  it('returns the matched ride straight from POST /ride-requests', async () => {
    await given.bulletAtBanani({ seatsTaken: 1 });
    const rafiq = await (await h.as('nusrat')).post('/ride-requests', TRIP.nusrat);
    expect(rafiq.status).toBe(201);
    expect(rafiq.body.ride).toMatchObject({
      status: 'MATCHED',
      pool: { status: 'ACCEPTED', driverName: 'Jashim', vehicleName: 'Bullet', coRiderCount: 1 },
    });
  });

  it('keeps Shirin REQUESTED when she wants 2 seats at 2/3, and Bullet is never overbooked', async () => {
    const { poolId } = await given.bulletAtBanani({ seatsTaken: 1 });
    await given.requestRide('nusrat', TRIP.nusrat); // joins: 2/3
    const shirin = await given.requestRide('shirin', { ...TRIP.shirin, seats: 2 });
    expect(shirin.status).toBe('REQUESTED');
    expect(await given.seatsOccupied(poolId as string)).toBe(2);

    const jashim = await h.as('jashim');
    const queue = await jashim.get('/driver/queue');
    expect(queue.body.items).toMatchObject([{ id: shirin.id, seats: 2, fitsActivePool: false }]);
  });

  it('leaves an incompatible request (Uttara, 9 km away) REQUESTED', async () => {
    await given.bulletAtBanani({ seatsTaken: 1 });
    const uttara = await given.requestRide('shirin', {
      ...TRIP.shirin,
      dropoffZoneId: ZONE.UTTARA,
    });
    expect(uttara.status).toBe('REQUESTED');
  });

  it('leaves a request from a different pick-up zone REQUESTED', async () => {
    await given.bulletAtBanani({ seatsTaken: 1 });
    const farmgate = await given.requestRide('shirin', {
      ...TRIP.shirin,
      pickupZoneId: ZONE.FARMGATE,
    });
    expect(farmgate.status).toBe('REQUESTED');
  });

  it('never joins a pool that nobody is driving: with no pool, requests just wait', async () => {
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
    expect([nusrat.status, rafiq.status]).toEqual(['REQUESTED', 'REQUESTED']);
  });

  it('prefers the oldest qualifying pool', async () => {
    await given.goOnline('jashim', ZONE.BANANI);
    await given.goOnline('kamal', ZONE.BANANI);
    // Two requests wait; Jashim takes Nusrat first, then Kamal takes Rafiq: two Banani pools.
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
    const older = await given.accept('jashim', nusrat.id);
    const newer = await given.accept('kamal', rafiq.id);
    expect(older.id).not.toBe(newer.id);

    const shirin = await given.requestRide('shirin', TRIP.shirin);
    expect(shirin.status).toBe('MATCHED');
    expect(await given.seatsOccupied(older.id)).toBe(2);
    expect(await given.seatsOccupied(newer.id)).toBe(1);
  });

  it('falls through to the next-oldest pool when the oldest is full', async () => {
    await given.goOnline('jashim', ZONE.BANANI);
    await given.goOnline('kamal', ZONE.BANANI);
    const nusrat = await given.requestRide('nusrat', { ...TRIP.nusrat, seats: 3 });
    const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
    const full = await given.accept('jashim', nusrat.id); // 3/3
    const open = await given.accept('kamal', rafiq.id); // 1/3

    const shirin = await given.requestRide('shirin', TRIP.shirin);
    expect(shirin.status).toBe('MATCHED');
    expect(await given.seatsOccupied(full.id)).toBe(3);
    expect(await given.seatsOccupied(open.id)).toBe(2);
  });

  it('records the join in the audit trail with the system as actor', async () => {
    await given.bulletAtBanani({ seatsTaken: 1 });
    const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
    const rows = await h.orm.em
      .getConnection()
      .execute<{ type: string; actor_user_id: string | null; data: { seatsOccupied?: number } }[]>(
        `select type, actor_user_id, data from ride_events where ride_request_id = ? order by id`,
        [nusrat.id],
      );
    expect(rows.map((row) => row.type)).toEqual([
      'RIDE_REQUESTED',
      'REQUEST_MATCHED',
      'PASSENGER_JOINED',
    ]);
    expect(rows[1].actor_user_id).toBeNull(); // system
    expect(rows[2].data.seatsOccupied).toBe(2);
  });

  describe('what a passenger may learn about co-riders', () => {
    it("shows Nusrat a co-rider count only: no name or fare of Rafiq's, in any of her responses", async () => {
      await given.goOnline('jashim', ZONE.BANANI);
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.accept('jashim', nusrat.id);
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);

      const nusratSession = await h.as('nusrat');
      const responses = [
        await nusratSession.get(`/ride-requests/${nusrat.id}`),
        await nusratSession.get('/ride-requests?scope=active'),
      ];
      for (const response of responses) {
        const text = JSON.stringify(response.body);
        expect(text).not.toMatch(/Rafiq/i);
        expect(text).not.toContain(rafiq.id);
        expect(text).not.toMatch(/\b(5800|7000)\b/); // Rafiq's pooled and solo fares
        expect(text).not.toMatch(/\b4000\b/); // Rafiq's distance charge
      }
      expect(responses[0].body.ride.pool.coRiderCount).toBe(1);
    });

    it("does not put Rafiq's join on Nusrat's timeline", async () => {
      await given.goOnline('jashim', ZONE.BANANI);
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.accept('jashim', nusrat.id);
      await given.requestRide('rafiq', TRIP.rafiq);
      const ride = await rideOf('nusrat', nusrat.id);
      expect(ride.timeline.map((entry: { type: string }) => entry.type)).toEqual([
        'RIDE_REQUESTED',
        'REQUEST_MATCHED',
      ]);
    });
  });
});
