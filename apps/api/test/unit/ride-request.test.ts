import { describe, expect, it } from 'vitest';
import { Actor } from '../../src/shared/domain/actor';
import { InvalidTransitionError } from '../../src/shared/domain/domain-error';
import { Money } from '../../src/shared/domain/money';
import { StandardFarePolicy } from '../../src/modules/pricing/standard-fare-policy';
import { RideRequest } from '../../src/modules/rides/ride-request.entity';

const nusratId = 'nusrat-id';
const jashim = Actor.user('jashim-id');
const policy = new StandardFarePolicy();

function nusratsRide(): RideRequest {
  return RideRequest.create(
    {
      passengerId: nusratId,
      pickupZoneId: 1,
      dropoffZoneId: 4,
      seats: 1,
      distanceM: 3_000,
      estimatedSolo: Money.ofPaisa(9_000),
      estimatedPooled: Money.ofPaisa(7_200),
      pricingVersion: 'v1',
    },
    Actor.user(nusratId),
  );
}

describe('RideRequest', () => {
  it('starts REQUESTED with both estimates and records RIDE_REQUESTED', () => {
    const ride = nusratsRide();
    expect(ride.status).toBe('REQUESTED');
    expect(ride.estSoloFarePaisa).toBe(9_000);
    expect(ride.estPooledFarePaisa).toBe(7_200);
    expect(ride.fareTotalPaisa).toBeNull();
    expect(ride.isActive()).toBe(true);
    const [event] = ride.pullEvents();
    expect(event).toMatchObject({
      type: 'RIDE_REQUESTED',
      rideRequestId: ride.id,
      toStatus: 'REQUESTED',
    });
    expect(event.actor.userId).toBe(nusratId);
    expect(ride.pullEvents()).toEqual([]); // pulled events are consumed
  });

  it('follows REQUESTED -> MATCHED -> IN_PROGRESS -> COMPLETED and records each step', () => {
    const ride = nusratsRide();
    ride.pullEvents();
    ride.markMatched(jashim, 'pool-1');
    ride.start(policy.quote({ distanceM: 3_000, seats: 1, pooled: true }), jashim, 'pool-1');
    ride.complete(jashim, 'pool-1');

    expect(ride.status).toBe('COMPLETED');
    expect(ride.completedAt).toBeInstanceOf(Date);
    expect(ride.isActive()).toBe(false);
    expect(
      ride.pullEvents().map((event) => [event.type, event.fromStatus, event.toStatus]),
    ).toEqual([
      ['REQUEST_MATCHED', 'REQUESTED', 'MATCHED'],
      ['REQUEST_STARTED', 'MATCHED', 'IN_PROGRESS'],
      ['REQUEST_COMPLETED', 'IN_PROGRESS', 'COMPLETED'],
    ]);
  });

  it('locks the fare breakdown when the trip starts', () => {
    const ride = nusratsRide();
    ride.markMatched(jashim, 'pool-1');
    ride.start(policy.quote({ distanceM: 3_000, seats: 1, pooled: true }), jashim, 'pool-1');
    expect([
      ride.fareBasePaisa,
      ride.fareDistancePaisa,
      ride.fareDiscountPaisa,
      ride.fareTotalPaisa,
    ]).toEqual([3_000, 6_000, 1_800, 7_200]);
    const started = ride.pullEvents().find((event) => event.type === 'REQUEST_STARTED');
    expect(started?.data).toMatchObject({ totalPaisa: 7_200, pricingVersion: 'v1' });
  });

  it('can be cancelled while REQUESTED or MATCHED, and sets cancelledAt', () => {
    const requested = nusratsRide();
    requested.cancel(Actor.user(nusratId));
    expect(requested.status).toBe('CANCELLED');
    expect(requested.cancelledAt).toBeInstanceOf(Date);

    const matched = nusratsRide();
    matched.markMatched(jashim, 'pool-1');
    matched.cancel(Actor.user(nusratId), 'pool-1');
    expect(matched.status).toBe('CANCELLED');
  });

  it('cannot be cancelled once the trip has started', () => {
    const ride = nusratsRide();
    ride.markMatched(jashim, 'pool-1');
    ride.start(policy.quote({ distanceM: 3_000, seats: 1, pooled: false }), jashim, 'pool-1');
    expect(() => ride.cancel(Actor.user(nusratId))).toThrow(InvalidTransitionError);
    expect(ride.status).toBe('IN_PROGRESS');
    expect(ride.cancelledAt).toBeNull();
  });

  it('returns to REQUESTED when the driver cancels the pool', () => {
    const ride = nusratsRide();
    ride.markMatched(jashim, 'pool-1');
    ride.pullEvents();
    ride.requeue(jashim, 'pool-1');
    expect(ride.status).toBe('REQUESTED');
    expect(ride.pullEvents()[0]).toMatchObject({
      type: 'REQUEST_REQUEUED',
      data: { reason: 'DRIVER_CANCELLED' },
    });
  });

  it('rejects illegal transitions without changing state', () => {
    const ride = nusratsRide();
    expect(() => ride.complete(jashim, 'pool-1')).toThrow(InvalidTransitionError);
    expect(() =>
      ride.start(policy.quote({ distanceM: 3_000, seats: 1, pooled: false }), jashim, 'pool-1'),
    ).toThrow(InvalidTransitionError); // start before matched
    expect(ride.status).toBe('REQUESTED');
    expect(ride.fareTotalPaisa).toBeNull();
  });

  it('never leaves a terminal state', () => {
    const ride = nusratsRide();
    ride.cancel(Actor.user(nusratId));
    expect(() => ride.markMatched(jashim, 'pool-1')).toThrow(InvalidTransitionError);
    expect(() => ride.cancel(Actor.user(nusratId))).toThrow(InvalidTransitionError);
  });
});
