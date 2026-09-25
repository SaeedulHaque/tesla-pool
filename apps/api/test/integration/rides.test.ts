import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';

const BANANI = 1;
const GULSHAN_1 = 2;
const MOHAKHALI = 4;
const nusratsTrip = { pickupZoneId: BANANI, dropoffZoneId: MOHAKHALI, seats: 1 };
const rafiqsTrip = { pickupZoneId: BANANI, dropoffZoneId: GULSHAN_1, seats: 1 };

describe('ride requests', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.reset();
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  async function eventTypes(rideId: string): Promise<string[]> {
    const rows = await h.orm.em
      .getConnection()
      .execute<{ type: string }[]>(
        'select type from ride_events where ride_request_id = ? order by id',
        [rideId],
      );
    return rows.map((row) => row.type);
  }

  describe('POST /ride-requests', () => {
    it('creates a REQUESTED ride with both fare estimates and no pool', async () => {
      const nusrat = await h.as('nusrat');
      const response = await nusrat.post('/ride-requests', nusratsTrip);

      expect(response.status).toBe(201);
      expect(response.body.ride).toMatchObject({
        status: 'REQUESTED',
        pickup: 'Banani',
        dropoff: 'Mohakhali',
        seats: 1,
        distanceM: 3_000,
        fare: {
          estimatedSoloPaisa: 9_000,
          estimatedPooledPaisa: 7_200,
          final: null,
          pricingVersion: 'v1',
        },
        pool: null,
        completedAt: null,
        cancelledAt: null,
      });
      expect(response.body.ride.id).toEqual(expect.any(String));
      expect(await eventTypes(response.body.ride.id)).toEqual(['RIDE_REQUESTED']);
    });

    it('rejects a second active ride with 409 ACTIVE_RIDE_EXISTS', async () => {
      const nusrat = await h.as('nusrat');
      await nusrat.post('/ride-requests', nusratsTrip);
      const again = await nusrat.post('/ride-requests', rafiqsTrip);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
    });

    it('survives a double submit: one 201, one 409 ACTIVE_RIDE_EXISTS, one row', async () => {
      const nusrat = await h.as('nusrat');
      const [a, b] = await Promise.all([
        nusrat.post('/ride-requests', nusratsTrip),
        nusrat.post('/ride-requests', nusratsTrip),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
      const [{ n }] = await h.orm.em
        .getConnection()
        .execute<{ n: string }[]>('select count(*) n from ride_requests');
      expect(Number(n)).toBe(1);
    });

    it('lets the database refuse two active rides even if the application did not', async () => {
      const nusrat = await h.as('nusrat');
      await nusrat.post('/ride-requests', nusratsTrip);
      await expect(
        h.orm.em.getConnection().execute(
          `insert into ride_requests (passenger_id, pickup_zone_id, dropoff_zone_id, seats, distance_m,
             est_solo_fare_paisa, est_pooled_fare_paisa, pricing_version)
           select passenger_id, pickup_zone_id, dropoff_zone_id, seats, distance_m, 9000, 7200, 'v1'
             from ride_requests limit 1`,
        ),
      ).rejects.toThrow(/uq_active_request_per_passenger/);
    });

    it.each([
      ['same pickup and drop-off', { pickupZoneId: BANANI, dropoffZoneId: BANANI, seats: 1 }],
      ['four seats', { ...nusratsTrip, seats: 4 }],
      ['unknown zone', { ...nusratsTrip, dropoffZoneId: 999 }],
      ['string seats', { ...nusratsTrip, seats: 'lots' }],
      ['empty body', {}],
    ])('rejects %s with 400', async (_label, body) => {
      const nusrat = await h.as('nusrat');
      const response = await nusrat.post('/ride-requests', body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('is closed to drivers (403) and anonymous callers (401)', async () => {
      const jashim = await h.as('jashim');
      expect((await jashim.post('/ride-requests', nusratsTrip)).status).toBe(403);
      expect((await h.anonymous().post('/ride-requests', nusratsTrip)).status).toBe(401);
    });
  });

  describe('reading rides', () => {
    it('returns the ride with its timeline to the owner', async () => {
      const nusrat = await h.as('nusrat');
      const { body } = await nusrat.post('/ride-requests', nusratsTrip);
      const response = await nusrat.get(`/ride-requests/${body.ride.id}`);
      expect(response.status).toBe(200);
      expect(response.body.ride.id).toBe(body.ride.id);
      expect(response.body.ride.timeline.map((entry: { type: string }) => entry.type)).toEqual([
        'RIDE_REQUESTED',
      ]);
    });

    it("answers 404 when Rafiq reads Nusrat's ride, identical to a ride that does not exist", async () => {
      const nusrat = await h.as('nusrat');
      const rafiq = await h.as('rafiq');
      const { body } = await nusrat.post('/ride-requests', nusratsTrip);

      const foreign = await rafiq.get(`/ride-requests/${body.ride.id}`);
      const missing = await rafiq.get('/ride-requests/00000000-0000-4000-8000-000000000000');
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body.error.code).toBe('NOT_FOUND');
      expect(foreign.body.error.message).toBe(missing.body.error.message);
      expect(JSON.stringify(foreign.body)).not.toContain('Nusrat');
    });

    it('rejects a malformed id with 400', async () => {
      const nusrat = await h.as('nusrat');
      expect((await nusrat.get('/ride-requests/not-a-uuid')).status).toBe(400);
    });

    it('lists only my own rides, split into active and history', async () => {
      const nusrat = await h.as('nusrat');
      const rafiq = await h.as('rafiq');
      const first = await nusrat.post('/ride-requests', nusratsTrip);
      await nusrat.post(`/ride-requests/${first.body.ride.id}/cancel`);
      const second = await nusrat.post('/ride-requests', rafiqsTrip);
      await rafiq.post('/ride-requests', nusratsTrip);

      const active = await nusrat.get('/ride-requests?scope=active');
      expect(active.body.items.map((ride: { id: string }) => ride.id)).toEqual([
        second.body.ride.id,
      ]);
      const history = await nusrat.get('/ride-requests?scope=history');
      expect(
        history.body.items.map((ride: { id: string; status: string }) => [ride.id, ride.status]),
      ).toEqual([[first.body.ride.id, 'CANCELLED']]);
      const defaulted = await nusrat.get('/ride-requests');
      expect(defaulted.body.items).toHaveLength(1);
      expect((await nusrat.get('/ride-requests?scope=everything')).status).toBe(400);
    });
  });

  describe('POST /ride-requests/:id/cancel', () => {
    it('cancels a REQUESTED ride, frees the passenger to request again, and records the event', async () => {
      const nusrat = await h.as('nusrat');
      const { body } = await nusrat.post('/ride-requests', nusratsTrip);
      const cancelled = await nusrat.post(`/ride-requests/${body.ride.id}/cancel`);

      expect(cancelled.status).toBe(200);
      expect(cancelled.body.ride).toMatchObject({
        status: 'CANCELLED',
        cancelledAt: expect.any(String),
      });
      expect(await eventTypes(body.ride.id)).toEqual(['RIDE_REQUESTED', 'REQUEST_CANCELLED']);
      expect((await nusrat.post('/ride-requests', nusratsTrip)).status).toBe(201);
    });

    it("answers 404 when Rafiq tries to cancel Nusrat's ride, and leaves it untouched", async () => {
      const nusrat = await h.as('nusrat');
      const rafiq = await h.as('rafiq');
      const { body } = await nusrat.post('/ride-requests', nusratsTrip);

      const attempt = await rafiq.post(`/ride-requests/${body.ride.id}/cancel`);
      expect(attempt.status).toBe(404);
      const still = await nusrat.get(`/ride-requests/${body.ride.id}`);
      expect(still.body.ride.status).toBe('REQUESTED');
    });

    it('rejects cancelling twice with 409 INVALID_TRANSITION', async () => {
      const nusrat = await h.as('nusrat');
      const { body } = await nusrat.post('/ride-requests', nusratsTrip);
      await nusrat.post(`/ride-requests/${body.ride.id}/cancel`);
      const again = await nusrat.post(`/ride-requests/${body.ride.id}/cancel`);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('answers 404 for an unknown ride', async () => {
      const nusrat = await h.as('nusrat');
      expect(
        (await nusrat.post('/ride-requests/00000000-0000-4000-8000-000000000000/cancel')).status,
      ).toBe(404);
    });
  });
});
