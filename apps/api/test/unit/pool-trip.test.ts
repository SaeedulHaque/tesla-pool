import { describe, expect, it } from 'vitest';
import { Actor } from '../../src/shared/domain/actor';
import { InvalidTransitionError, NotFoundError } from '../../src/shared/domain/domain-error';
import { StandardFarePolicy } from '../../src/modules/pricing/standard-fare-policy';
import type { Pool } from '../../src/modules/pools/pool.entity';
import type { RideRequest } from '../../src/modules/rides/ride-request.entity';
import { bulletPool, jashim, policy, ride } from './support/fixtures';

const fares = new StandardFarePolicy();

/** Bullet with Nusrat (Mohakhali), Rafiq (Gulshan 1) and, optionally, Shirin (Mohakhali) aboard. */
function fullStory(withShirin = false) {
  const pool = bulletPool();
  const nusrat = ride('nusrat', 'MOHAKHALI');
  const rafiq = ride('rafiq', 'GULSHAN_1');
  const shirin = ride('shirin', 'MOHAKHALI');
  pool.admit(nusrat, policy, jashim);
  pool.admit(rafiq, policy, jashim);
  if (withShirin) pool.admit(shirin, policy, jashim);
  pool.pullEvents();
  [nusrat, rafiq, shirin].forEach((r) => r.pullEvents());
  return { pool, nusrat, rafiq, shirin };
}

const fareOf = (r: RideRequest) => [
  r.fareBasePaisa,
  r.fareDistancePaisa,
  r.fareDiscountPaisa,
  r.fareTotalPaisa,
];

function started(withShirin = false) {
  const story = fullStory(withShirin);
  story.pool.arrive(jashim);
  story.pool.start(jashim, fares);
  return story;
}

describe('Pool trip: arrive', () => {
  it('moves ACCEPTED to DRIVER_ARRIVED and records it', () => {
    const { pool } = fullStory();
    pool.arrive(jashim);
    expect(pool.status).toBe('DRIVER_ARRIVED');
    expect(pool.pullEvents()).toMatchObject([
      { type: 'DRIVER_ARRIVED', fromStatus: 'ACCEPTED', toStatus: 'DRIVER_ARRIVED' },
    ]);
  });

  it('cannot be done twice', () => {
    const { pool } = fullStory();
    pool.arrive(jashim);
    expect(() => pool.arrive(jashim)).toThrow(InvalidTransitionError);
  });
});

describe('Pool trip: start and fare finalization', () => {
  it('cannot start before the driver arrives, and no fare is locked', () => {
    const { pool, nusrat } = fullStory();
    expect(() => pool.start(jashim, fares)).toThrow(InvalidTransitionError);
    expect(pool.status).toBe('ACCEPTED');
    expect(nusrat.status).toBe('MATCHED');
    expect(nusrat.fareTotalPaisa).toBeNull();
  });

  it('charges the reference pooled fares: Nusrat 72 taka, Rafiq 58 taka', () => {
    const { pool, nusrat, rafiq } = started();
    expect(pool.status).toBe('STARTED');
    expect([nusrat.status, rafiq.status]).toEqual(['IN_PROGRESS', 'IN_PROGRESS']);
    expect(fareOf(nusrat)).toEqual([3_000, 6_000, 1_800, 7_200]);
    expect(fareOf(rafiq)).toEqual([3_000, 4_000, 1_200, 5_800]);
    expect(nusrat.pricingVersion).toBe('v1');
  });

  it('gives Shirin the same fare as Nusrat for the same route', () => {
    const { shirin } = started(true);
    expect(fareOf(shirin)).toEqual([3_000, 6_000, 1_800, 7_200]);
  });

  it('charges the solo fare when only one rider is left at start', () => {
    const { pool, nusrat } = fullStory(); // Rafiq will cancel
    const rafiq = pool.activeRequests().find((r) => r.passengerId === 'rafiq-id') as RideRequest;
    pool.removeMember(rafiq, Actor.user('rafiq-id'));
    pool.arrive(jashim);
    pool.start(jashim, fares);
    expect(nusrat.fareTotalPaisa).toBe(9_000);
    expect(nusrat.fareDiscountPaisa).toBe(0);
  });

  it('records POOL_STARTED and one REQUEST_STARTED per rider with the fare in the event', () => {
    const { pool, nusrat, rafiq } = fullStory();
    pool.arrive(jashim);
    pool.pullEvents();
    pool.start(jashim, fares);
    expect(pool.pullEvents()).toMatchObject([
      { type: 'POOL_STARTED', data: { pooled: true, riders: 2, pricingVersion: 'v1' } },
    ]);
    expect(nusrat.pullEvents().find((e) => e.type === 'REQUEST_STARTED')?.data).toMatchObject({
      totalPaisa: 7_200,
    });
    expect(rafiq.pullEvents().find((e) => e.type === 'REQUEST_STARTED')?.data).toMatchObject({
      totalPaisa: 5_800,
    });
  });

  it('locks the pool: nobody can join once STARTED', () => {
    const { pool } = started();
    expect(pool.canAdmit(ride('late', 'MOHAKHALI'), policy)).toBe(false);
  });
});

describe('Pool trip: drop-off', () => {
  it('cannot drop anyone off before the trip starts', () => {
    const { pool, nusrat } = fullStory();
    pool.arrive(jashim);
    expect(() => pool.dropOff(nusrat.id, jashim)).toThrow(InvalidTransitionError);
    expect(nusrat.status).toBe('MATCHED');
  });

  it('completes riders one by one and the pool with the last one', () => {
    const { pool, nusrat, rafiq } = started();
    pool.dropOff(rafiq.id, jashim);
    expect(rafiq.status).toBe('COMPLETED');
    expect(rafiq.completedAt).toBeInstanceOf(Date);
    expect(pool.status).toBe('STARTED');

    pool.dropOff(nusrat.id, jashim);
    expect(pool.status).toBe('COMPLETED');
    expect(pool.pullEvents().map((e) => e.type)).toContain('POOL_COMPLETED');
  });

  it('refuses a second drop-off of the same rider, and unknown riders', () => {
    const { pool, nusrat } = started();
    pool.dropOff(nusrat.id, jashim);
    expect(() => pool.dropOff(nusrat.id, jashim)).toThrow(InvalidTransitionError);
    expect(() => pool.dropOff('someone-else', jashim)).toThrow(NotFoundError);
  });

  it('keeps every rider fare unchanged through drop-offs', () => {
    const { pool, nusrat, rafiq } = started();
    const before = [fareOf(nusrat), fareOf(rafiq)];
    pool.dropOff(rafiq.id, jashim);
    pool.dropOff(nusrat.id, jashim);
    expect([fareOf(nusrat), fareOf(rafiq)]).toEqual(before);
  });
});

describe('Pool trip: passenger leaves', () => {
  it('frees the seat and closes the membership with a reason', () => {
    const { pool, rafiq } = fullStory();
    pool.removeMember(rafiq, Actor.user('rafiq-id'));

    expect(rafiq.status).toBe('CANCELLED');
    expect(pool.seatsOccupied).toBe(1);
    expect(pool.status).toBe('ACCEPTED');
    const closed = pool.memberships.getItems().find((m) => m.rideRequest === rafiq);
    expect(closed?.leaveReason).toBe('PASSENGER_CANCELLED');
    expect(closed?.leftAt).toBeInstanceOf(Date);
    expect(pool.activeMemberships()).toHaveLength(1);
    expect(pool.pullEvents()).toMatchObject([
      { type: 'PASSENGER_LEFT', rideRequestId: rafiq.id, data: { seatsOccupied: 1 } },
    ]);
  });

  it('lets the freed seat be taken by someone else', () => {
    const { pool, rafiq } = fullStory(true); // 3/3
    expect(pool.canAdmit(ride('late', 'MOHAKHALI'), policy)).toBe(false);
    pool.removeMember(rafiq, Actor.user('rafiq-id'));
    expect(pool.canAdmit(ride('late', 'MOHAKHALI'), policy)).toBe(true);
  });

  it('frees every seat of a multi-seat rider', () => {
    const pool = bulletPool();
    const shirin = ride('shirin', 'MOHAKHALI', { seats: 2 });
    pool.admit(shirin, policy, jashim);
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    expect(pool.seatsOccupied).toBe(3);
    pool.removeMember(shirin, Actor.user('shirin-id'));
    expect(pool.seatsOccupied).toBe(1);
  });

  it('cancels the pool when the last rider leaves', () => {
    const { pool, nusrat, rafiq } = fullStory();
    pool.removeMember(nusrat, Actor.user('nusrat-id'));
    pool.removeMember(rafiq, Actor.user('rafiq-id'));
    expect(pool.status).toBe('CANCELLED');
    expect(pool.seatsOccupied).toBe(0);
    expect(pool.pullEvents().at(-1)).toMatchObject({
      type: 'POOL_CANCELLED',
      data: { reason: 'LAST_MEMBER_LEFT' },
    });
  });

  it('is refused once the trip has started, changing nothing', () => {
    const { pool, nusrat } = started();
    expect(() => pool.removeMember(nusrat, Actor.user('nusrat-id'))).toThrow(
      InvalidTransitionError,
    );
    expect(nusrat.status).toBe('IN_PROGRESS');
    expect(pool.seatsOccupied).toBe(2);
    expect(pool.activeMemberships()).toHaveLength(2);
  });
});

describe('Pool trip: driver cancels', () => {
  function cancelled(): { pool: Pool; nusrat: RideRequest; rafiq: RideRequest } {
    const story = fullStory();
    story.pool.cancelByDriver(jashim);
    return story;
  }

  it('re-queues riders as REQUESTED instead of cancelling them', () => {
    const { pool, nusrat, rafiq } = cancelled();
    expect(pool.status).toBe('CANCELLED');
    expect([nusrat.status, rafiq.status]).toEqual(['REQUESTED', 'REQUESTED']);
    expect(nusrat.cancelledAt).toBeNull();
    expect(pool.seatsOccupied).toBe(0);
  });

  it('records why each rider left', () => {
    const { pool } = cancelled();
    expect(pool.memberships.getItems().map((m) => m.leaveReason)).toEqual([
      'DRIVER_CANCELLED',
      'DRIVER_CANCELLED',
    ]);
    expect(pool.activeMemberships()).toEqual([]);
  });

  it('lets the re-queued rider be admitted into a fresh pool', () => {
    const { nusrat } = cancelled();
    const other = bulletPool();
    other.admit(nusrat, policy, jashim);
    expect(nusrat.status).toBe('MATCHED');
  });

  it('works while DRIVER_ARRIVED but not once STARTED or finished', () => {
    const arrived = fullStory();
    arrived.pool.arrive(jashim);
    expect(() => arrived.pool.cancelByDriver(jashim)).not.toThrow();

    const running = started();
    expect(() => running.pool.cancelByDriver(jashim)).toThrow(InvalidTransitionError);
    expect(running.pool.status).toBe('STARTED');
    expect(running.nusrat.status).toBe('IN_PROGRESS');
  });
});
