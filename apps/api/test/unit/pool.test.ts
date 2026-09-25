import { describe, expect, it } from 'vitest';
import {
  IncompatibleRequestError,
  PoolFullError,
  PoolNotJoinableError,
} from '../../src/shared/domain/domain-error';
import { bulletPool, jashim, policy, ride, ZONE } from './support/fixtures';

describe('Pool (Bullet, 3 seats)', () => {
  it('opens empty and ACCEPTED, recording POOL_CREATED', () => {
    const pool = bulletPool();
    expect(pool).toMatchObject({
      status: 'ACCEPTED',
      seatCapacity: 3,
      seatsOccupied: 0,
      pickupZoneId: ZONE.BANANI,
    });
    expect(pool.pullEvents().map((event) => event.type)).toEqual(['POOL_CREATED']);
  });

  it('walks the reference story: Nusrat 1/3, Rafiq 2/3, Shirin 3/3', () => {
    const pool = bulletPool();
    const nusrat = ride('nusrat', 'MOHAKHALI');
    const rafiq = ride('rafiq', 'GULSHAN_1');
    const shirin = ride('shirin', 'MOHAKHALI');

    pool.admit(nusrat, policy, jashim);
    expect(pool.seatsOccupied).toBe(1);
    pool.admit(rafiq, policy, jashim); // Gulshan 1 <-> Mohakhali = 2.5 km <= 3 km
    expect(pool.seatsOccupied).toBe(2);
    pool.admit(shirin, policy, jashim);
    expect(pool.seatsOccupied).toBe(3);

    expect([nusrat, rafiq, shirin].map((r) => r.status)).toEqual(['MATCHED', 'MATCHED', 'MATCHED']);
    expect(pool.activeMemberships()).toHaveLength(3);
    expect(pool.seatsLeft()).toBe(0);
  });

  it('never seats a fourth passenger: PoolFullError, nothing changes', () => {
    const pool = bulletPool();
    for (const name of ['nusrat', 'rafiq', 'shirin'])
      pool.admit(ride(name, 'MOHAKHALI'), policy, jashim);
    const late = ride('late', 'MOHAKHALI');

    expect(() => pool.admit(late, policy, jashim)).toThrow(PoolFullError);
    expect(pool.seatsOccupied).toBe(3);
    expect(pool.activeMemberships()).toHaveLength(3);
    expect(late.status).toBe('REQUESTED');
  });

  it('keeps Shirin waiting when she wants 2 seats at 2/3 (2 + 2 > 3)', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    pool.admit(ride('rafiq', 'GULSHAN_1'), policy, jashim);
    const shirin = ride('shirin', 'MOHAKHALI', { seats: 2 });

    expect(pool.hasRoomFor(2)).toBe(false);
    expect(pool.canAdmit(shirin, policy)).toBe(false);
    expect(() => pool.admit(shirin, policy, jashim)).toThrow(PoolFullError);
    expect(shirin.status).toBe('REQUESTED');
    expect(pool.seatsOccupied).toBe(2);
  });

  it('admits a two-seat request when two seats are free, then is full', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    pool.admit(ride('shirin', 'MOHAKHALI', { seats: 2 }), policy, jashim);
    expect(pool.seatsOccupied).toBe(3);
    expect(pool.canAdmit(ride('rafiq', 'GULSHAN_1'), policy)).toBe(false);
  });

  it('refuses a request whose pick-up zone differs', () => {
    const pool = bulletPool();
    const farmgateRider = ride('rafiq', 'MOHAKHALI', { pickup: 'FARMGATE' });
    expect(() => pool.admit(farmgateRider, policy, jashim)).toThrow(IncompatibleRequestError);
    expect(pool.canAdmit(farmgateRider, policy)).toBe(false);
  });

  it('refuses a drop-off more than 3 km from an existing rider', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    const uttara = ride('shirin', 'UTTARA');
    expect(() => pool.admit(uttara, policy, jashim)).toThrow(IncompatibleRequestError);
    expect(uttara.status).toBe('REQUESTED');
    expect(pool.seatsOccupied).toBe(1);
  });

  it.each(['STARTED', 'COMPLETED', 'CANCELLED'] as const)('is not joinable once %s', (status) => {
    const pool = bulletPool();
    pool.status = status;
    const rider = ride('nusrat', 'MOHAKHALI');
    expect(pool.isJoinable()).toBe(false);
    expect(pool.canAdmit(rider, policy)).toBe(false);
    expect(() => pool.admit(rider, policy, jashim)).toThrow(PoolNotJoinableError);
  });

  it('stays joinable after the driver arrives', () => {
    const pool = bulletPool();
    pool.status = 'DRIVER_ARRIVED';
    expect(pool.canAdmit(ride('nusrat', 'MOHAKHALI'), policy)).toBe(true);
  });

  it('records PASSENGER_JOINED with the seat count after each join', () => {
    const pool = bulletPool();
    pool.pullEvents();
    const nusrat = ride('nusrat', 'MOHAKHALI');
    const rafiq = ride('rafiq', 'GULSHAN_1');
    pool.admit(nusrat, policy, jashim);
    pool.admit(rafiq, policy, jashim);
    const joins = pool.pullEvents().filter((event) => event.type === 'PASSENGER_JOINED');
    expect(joins.map((event) => [event.rideRequestId, event.data.seatsOccupied])).toEqual([
      [nusrat.id, 1],
      [rafiq.id, 2],
    ]);
  });

  it('does not decide with stale data: canAdmit reflects the seats it holds right now', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    pool.admit(ride('rafiq', 'GULSHAN_1', { seats: 1 }), policy, jashim);
    const last = ride('shirin', 'MOHAKHALI');
    expect(pool.canAdmit(last, policy)).toBe(true);
    pool.seatsOccupied = 3; // what another transaction's commit looks like after the row lock
    expect(pool.canAdmit(last, policy)).toBe(false);
  });
});
