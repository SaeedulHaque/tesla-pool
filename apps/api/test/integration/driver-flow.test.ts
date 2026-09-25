import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';
import { Scenario, TRIP, ZONE } from './support/scenario';

describe('driver flow', () => {
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

  describe('PUT /driver/availability', () => {
    it('takes Jashim online at Banani', async () => {
      const jashim = await h.as('jashim');
      const response = await jashim.put('/driver/availability', {
        online: true,
        zoneId: ZONE.BANANI,
      });
      expect(response.status).toBe(200);
      expect(response.body.vehicle).toMatchObject({
        displayName: 'Bullet',
        seatCapacity: 3,
        online: true,
        zoneId: ZONE.BANANI,
        zoneName: 'Banani',
      });
    });

    it('takes him offline again, remembering the zone', async () => {
      const jashim = await h.as('jashim');
      await jashim.put('/driver/availability', { online: true, zoneId: ZONE.BANANI });
      const response = await jashim.put('/driver/availability', { online: false });
      expect(response.body.vehicle).toMatchObject({ online: false, zoneId: ZONE.BANANI });
    });

    it('lets an online driver move to another zone', async () => {
      const jashim = await h.as('jashim');
      await jashim.put('/driver/availability', { online: true, zoneId: ZONE.BANANI });
      const response = await jashim.put('/driver/availability', {
        online: true,
        zoneId: ZONE.FARMGATE,
      });
      expect(response.body.vehicle).toMatchObject({ online: true, zoneName: 'Farmgate' });
    });

    it.each([
      ['no zone', { online: true }],
      ['unknown zone', { online: true, zoneId: 999 }],
      ['non-boolean', { online: 'yes', zoneId: 1 }],
      ['empty body', {}],
    ])('rejects %s with 400', async (_label, body) => {
      const jashim = await h.as('jashim');
      const response = await jashim.put('/driver/availability', body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('is refused while a pool is active', async () => {
      await given.bulletAtBanani({ seatsTaken: 1 });
      const jashim = await h.as('jashim');
      const response = await jashim.put('/driver/availability', { online: false });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ACTIVE_POOL_EXISTS');
    });

    it('is closed to passengers (403)', async () => {
      const nusrat = await h.as('nusrat');
      const response = await nusrat.put('/driver/availability', {
        online: true,
        zoneId: ZONE.BANANI,
      });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /driver/queue', () => {
    it('is empty while offline, but still reports the vehicle', async () => {
      await given.requestRide('nusrat', TRIP.nusrat);
      const jashim = await h.as('jashim');
      const response = await jashim.get('/driver/queue');
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.vehicle).toMatchObject({ displayName: 'Bullet', online: false });
    });

    it('lists waiting requests in the drivers zone, oldest first', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
      await given.requestRide('shirin', {
        ...TRIP.shirin,
        pickupZoneId: ZONE.FARMGATE,
        dropoffZoneId: ZONE.MOHAKHALI,
      });
      await given.goOnline('jashim', ZONE.BANANI);

      const jashim = await h.as('jashim');
      const response = await jashim.get('/driver/queue');
      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
        nusrat.id,
        rafiq.id,
      ]);
      expect(response.body.items[0]).toMatchObject({
        passengerName: 'Nusrat',
        pickup: 'Banani',
        dropoff: 'Mohakhali',
        seats: 1,
        distanceM: 3_000,
        fitsActivePool: false,
      });
    });

    it('drops requests that were cancelled or taken', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      await (await h.as('nusrat')).post(`/ride-requests/${nusrat.id}/cancel`);
      const jashim = await h.as('jashim');
      expect((await jashim.get('/driver/queue')).body.items).toEqual([]);
    });

    it('flags which requests fit the active pool', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
      const uttara = await given.requestRide('shirin', {
        ...TRIP.shirin,
        dropoffZoneId: ZONE.UTTARA,
      });
      await given.goOnline('jashim', ZONE.BANANI);
      await given.accept('jashim', nusrat.id);

      const jashim = await h.as('jashim');
      const items = (await jashim.get('/driver/queue')).body.items as {
        id: string;
        fitsActivePool: boolean;
      }[];
      expect(Object.fromEntries(items.map((item) => [item.id, item.fitsActivePool]))).toEqual({
        [rafiq.id]: true,
        [uttara.id]: false,
      });
    });

    it('is closed to passengers', async () => {
      const nusrat = await h.as('nusrat');
      expect((await nusrat.get('/driver/queue')).status).toBe(403);
      expect((await h.anonymous().get('/driver/queue')).status).toBe(401);
    });
  });

  describe('POST /driver/queue/:requestId/accept', () => {
    it('creates a pool with the first request, matching the passenger', async () => {
      const nusratRide = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      const jashim = await h.as('jashim');

      const response = await jashim.post(`/driver/queue/${nusratRide.id}/accept`);
      expect(response.status).toBe(200);
      expect(response.body.pool).toMatchObject({
        status: 'ACCEPTED',
        pickup: 'Banani',
        vehicleName: 'Bullet',
        seatCapacity: 3,
        seatsOccupied: 1,
        members: [
          {
            requestId: nusratRide.id,
            passengerName: 'Nusrat',
            dropoff: 'Mohakhali',
            seats: 1,
            status: 'MATCHED',
            farePaisa: null,
          },
        ],
      });

      const nusrat = await h.as('nusrat');
      const ride = await nusrat.get(`/ride-requests/${nusratRide.id}`);
      expect(ride.body.ride.status).toBe('MATCHED');
      expect(ride.body.ride.pool).toEqual({
        status: 'ACCEPTED',
        driverName: 'Jashim',
        vehicleName: 'Bullet',
        coRiderCount: 0,
      });
    });

    it('admits further compatible requests into the same pool', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
      await given.goOnline('jashim', ZONE.BANANI);
      const first = await given.accept('jashim', nusrat.id);
      const second = await given.accept('jashim', rafiq.id);

      expect(second.id).toBe(first.id);
      expect(second.seatsOccupied).toBe(2);
      const [{ n }] = await h.orm.em
        .getConnection()
        .execute<{ n: string }[]>('select count(*) n from pools');
      expect(Number(n)).toBe(1);
    });

    it('refuses a request that is too far from an existing rider: 409 INCOMPATIBLE_REQUEST', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const uttara = await given.requestRide('shirin', {
        ...TRIP.shirin,
        dropoffZoneId: ZONE.UTTARA,
      });
      await given.goOnline('jashim', ZONE.BANANI);
      await given.accept('jashim', nusrat.id);

      const jashim = await h.as('jashim');
      const response = await jashim.post(`/driver/queue/${uttara.id}/accept`);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INCOMPATIBLE_REQUEST');
      expect(
        (await (await h.as('shirin')).get(`/ride-requests/${uttara.id}`)).body.ride.status,
      ).toBe('REQUESTED');
    });

    it('never overbooks: a 2-seat request at 2/3 is refused with 409 POOL_FULL', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const rafiq = await given.requestRide('rafiq', TRIP.rafiq);
      const shirin = await given.requestRide('shirin', { ...TRIP.shirin, seats: 2 });
      await given.goOnline('jashim', ZONE.BANANI);
      const pool = await given.accept('jashim', nusrat.id);
      await given.accept('jashim', rafiq.id);

      const jashim = await h.as('jashim');
      const response = await jashim.post(`/driver/queue/${shirin.id}/accept`);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('POOL_FULL');
      expect(await given.seatsOccupied(pool.id)).toBe(2);
    });

    it('refuses an already-matched request with 409 INVALID_TRANSITION', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      await given.accept('jashim', nusrat.id);
      const jashim = await h.as('jashim');
      const again = await jashim.post(`/driver/queue/${nusrat.id}/accept`);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('hides requests from another zone and unknown ids behind the same 404', async () => {
      const farmgate = await given.requestRide('nusrat', {
        ...TRIP.nusrat,
        pickupZoneId: ZONE.FARMGATE,
      });
      await given.goOnline('jashim', ZONE.BANANI);
      const jashim = await h.as('jashim');
      const elsewhere = await jashim.post(`/driver/queue/${farmgate.id}/accept`);
      const missing = await jashim.post(
        '/driver/queue/00000000-0000-4000-8000-000000000000/accept',
      );
      expect([elsewhere.status, missing.status]).toEqual([404, 404]);
      expect(elsewhere.body.error.message).toBe(missing.body.error.message);
    });

    it('needs the driver to be online: 409 DRIVER_OFFLINE', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const kamal = await h.as('kamal'); // Toofan starts offline
      const response = await kamal.post(`/driver/queue/${nusrat.id}/accept`);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DRIVER_OFFLINE');
    });

    it('lets two drivers race for one request: exactly one wins', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      await given.goOnline('kamal', ZONE.BANANI);
      const [a, b] = await Promise.all([
        (await h.as('jashim')).post(`/driver/queue/${nusrat.id}/accept`),
        (await h.as('kamal')).post(`/driver/queue/${nusrat.id}/accept`),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const [{ n }] = await h.orm.em
        .getConnection()
        .execute<{ n: string }[]>(`select count(*) n from pool_memberships where left_at is null`);
      expect(Number(n)).toBe(1);
    });

    it('survives a double-clicked accept: one pool, one membership', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      const jashim = await h.as('jashim');
      const [a, b] = await Promise.all([
        jashim.post(`/driver/queue/${nusrat.id}/accept`),
        jashim.post(`/driver/queue/${nusrat.id}/accept`),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const [{ pools, members }] = await h.orm.em
        .getConnection()
        .execute<{ pools: string; members: string }[]>(
          'select (select count(*) from pools) pools, (select count(*) from pool_memberships) members',
        );
      expect([Number(pools), Number(members)]).toEqual([1, 1]);
    });

    it('is closed to passengers', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      const shirin = await h.as('shirin');
      expect((await shirin.post(`/driver/queue/${nusrat.id}/accept`)).status).toBe(403);
    });

    it('writes PASSENGER_JOINED and POOL_CREATED to the audit trail', async () => {
      const nusrat = await given.requestRide('nusrat', TRIP.nusrat);
      await given.goOnline('jashim', ZONE.BANANI);
      await given.accept('jashim', nusrat.id);
      const rows = await h.orm.em
        .getConnection()
        .execute<{ type: string; actor: string | null }[]>(
          `select e.type, u.full_name actor from ride_events e left join users u on u.id = e.actor_user_id order by e.id`,
        );
      expect(rows.map((row) => row.type)).toEqual([
        'RIDE_REQUESTED',
        'POOL_CREATED',
        'REQUEST_MATCHED',
        'PASSENGER_JOINED',
      ]);
      expect(rows.map((row) => row.actor)).toEqual(['Nusrat', 'Jashim', 'Jashim', 'Jashim']);
    });
  });

  describe('GET /pools', () => {
    it("shows the driver's own pools with members and seats, and nobody else's", async () => {
      await given.bulletAtBanani({ seatsTaken: 2 });
      const jashim = await h.as('jashim');
      const active = await jashim.get('/pools?scope=active');
      expect(active.status).toBe(200);
      expect(active.body.items).toHaveLength(1);
      expect(active.body.items[0]).toMatchObject({
        seatsOccupied: 2,
        seatCapacity: 3,
        status: 'ACCEPTED',
      });
      expect(active.body.items[0].members).toMatchObject([{ passengerName: 'Rafiq', seats: 2 }]);

      const kamal = await h.as('kamal');
      expect((await kamal.get('/pools?scope=active')).body.items).toEqual([]);
      expect((await jashim.get('/pools?scope=history')).body.items).toEqual([]);
    });

    it('is closed to passengers', async () => {
      const nusrat = await h.as('nusrat');
      expect((await nusrat.get('/pools')).status).toBe(403);
    });
  });
});
