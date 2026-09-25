import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';
import { Scenario, TRIP, ZONE } from './support/scenario';

describe("Bullet's capacity can never be exceeded", () => {
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

  it('HTTP: accepting into a full pool answers 409 POOL_FULL', async () => {
    const { poolId } = await given.bulletAtBanani({ seatsTaken: 2 });
    // A 2-seat request (created before it could auto-join is impossible now), so use a fresh rider.
    const shirin = await given.requestRide('shirin', { ...TRIP.shirin, seats: 2 });
    expect(shirin.status).toBe('REQUESTED');
    const jashim = await h.as('jashim');
    const response = await jashim.post(`/driver/queue/${shirin.id}/accept`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('POOL_FULL');
    expect(await given.seatsOccupied(poolId as string)).toBe(2);
  });

  describe('raw SQL bypassing the application', () => {
    it('rejects seats_occupied above capacity (CHECK constraint)', async () => {
      const { poolId } = await given.bulletAtBanani({ seatsTaken: 3 });
      await expect(
        h.orm.em
          .getConnection()
          .execute('update pools set seats_occupied = 4 where id = ?', [poolId]),
      ).rejects.toThrow(/pools_check|violates check constraint/);
      expect(await given.seatsOccupied(poolId as string)).toBe(3);
    });

    it('rejects negative seats_occupied', async () => {
      const { poolId } = await given.bulletAtBanani({ seatsTaken: 1 });
      await expect(
        h.orm.em
          .getConnection()
          .execute('update pools set seats_occupied = -1 where id = ?', [poolId]),
      ).rejects.toThrow(/violates check constraint/);
    });

    it('rejects a second active pool for the same vehicle', async () => {
      await given.bulletAtBanani({ seatsTaken: 1 });
      await expect(
        h.orm.em.getConnection().execute(
          `insert into pools (vehicle_id, driver_id, pickup_zone_id, seat_capacity)
           select vehicle_id, driver_id, pickup_zone_id, seat_capacity from pools limit 1`,
        ),
      ).rejects.toThrow(/uq_active_pool_per_vehicle/);
    });

    it('rejects putting one ride in two pools at once', async () => {
      const { rafiqRideId } = await given.bulletAtBanani({ seatsTaken: 1 });
      await given.goOnline('kamal', ZONE.BANANI);
      await expect(
        h.orm.em.getConnection().execute(
          `insert into pools (vehicle_id, driver_id, pickup_zone_id, seat_capacity)
           select v.id, v.driver_id, 1, 3 from vehicles v where v.display_name = 'Toofan'`,
        ),
      ).resolves.toBeDefined();
      await expect(
        h.orm.em.getConnection().execute(
          `insert into pool_memberships (pool_id, ride_request_id)
           select p.id, ? from pools p join vehicles v on v.id = p.vehicle_id where v.display_name = 'Toofan'`,
          [rafiqRideId],
        ),
      ).rejects.toThrow(/uq_active_membership_per_request/);
    });
  });

  it('maps a capacity CHECK violation that slips past the domain to 409 POOL_FULL', async () => {
    // Simulates an application bug: the DB refuses, the API still answers with the stable error code.
    const { errorHandler } = await import('../../src/http/error-handler');
    const checkViolation = Object.assign(new Error('violates check constraint'), {
      code: '23514',
      constraint: 'pools_check',
    });
    let status = 0;
    let body: { error: { code: string } } | undefined;
    errorHandler(
      checkViolation,
      { requestId: 'r-1', log: { error: () => undefined, debug: () => undefined } } as never,
      {
        headersSent: false,
        status(code: number) {
          status = code;
          return this;
        },
        json(payload: typeof body) {
          body = payload;
        },
      } as never,
      () => undefined,
    );
    expect(status).toBe(409);
    expect(body?.error.code).toBe('POOL_FULL');
  });
});
