import { POOL_STATUSES, RIDE_REQUEST_STATUSES } from '@tesla-pool/shared';
import { describe, expect, it } from 'vitest';
import {
  describeMember,
  describePool,
  describeRide,
  describeStartAction,
  timelineLabel,
} from '@/lib/ride-status';

describe('describeRide', () => {
  it('says Jashim is at Banani once the driver has arrived', () => {
    const view = describeRide('MATCHED', 'DRIVER_ARRIVED', {
      driverName: 'Jashim',
      pickup: 'Banani',
    });
    expect(view.label).toBe('Jashim is at Banani');
    expect(view.tone).toBe('success');
    expect(view.allowedActions).toEqual(['cancel']);
    expect(view.finished).toBe(false);
  });

  it('says the driver is on the way while the pool is only ACCEPTED', () => {
    expect(
      describeRide('MATCHED', 'ACCEPTED', { driverName: 'Jashim', pickup: 'Banani' }).label,
    ).toBe('Jashim is on the way');
  });

  it('lets a passenger cancel only while REQUESTED or MATCHED', () => {
    const cancellable = RIDE_REQUEST_STATUSES.filter((status) =>
      describeRide(status, null).allowedActions.includes('cancel'),
    );
    expect(cancellable).toEqual(['REQUESTED', 'MATCHED']);
  });

  it('marks COMPLETED and CANCELLED as finished, and only those', () => {
    const finished = RIDE_REQUEST_STATUSES.filter((status) => describeRide(status, null).finished);
    expect(finished).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('locks in the fare message once the trip is in progress', () => {
    const view = describeRide('IN_PROGRESS', 'STARTED');
    expect(view.label).toBe('On your way');
    expect(view.allowedActions).toEqual([]);
    expect(view.detail).toMatch(/fare is locked/i);
  });

  it('covers every status with a label', () => {
    for (const status of RIDE_REQUEST_STATUSES)
      expect(describeRide(status, null).label.length).toBeGreaterThan(0);
  });

  it('falls back to neutral wording without a driver name', () => {
    expect(describeRide('MATCHED', 'DRIVER_ARRIVED').label).toBe(
      'Your driver is at the pick-up zone',
    );
  });
});

describe('describePool', () => {
  it('offers arrive and cancel first, then start and cancel, then nothing', () => {
    expect(describePool('ACCEPTED').allowedActions).toEqual(['arrive', 'cancel']);
    expect(describePool('DRIVER_ARRIVED').allowedActions).toEqual(['start', 'cancel']);
    expect(describePool('STARTED').allowedActions).toEqual([]);
    expect(describePool('COMPLETED').allowedActions).toEqual([]);
    expect(describePool('CANCELLED').allowedActions).toEqual([]);
  });

  it('allows drop-offs only while the trip is running', () => {
    expect(POOL_STATUSES.filter((status) => describePool(status).canDropOff)).toEqual(['STARTED']);
  });

  it('marks COMPLETED and CANCELLED pools as finished', () => {
    expect(POOL_STATUSES.filter((status) => describePool(status).finished)).toEqual([
      'COMPLETED',
      'CANCELLED',
    ]);
  });
});

describe('describeMember', () => {
  it('lets the driver drop off only riders who are riding in a started pool', () => {
    expect(describeMember('IN_PROGRESS', 'STARTED').canDropOff).toBe(true);
    expect(describeMember('COMPLETED', 'STARTED').canDropOff).toBe(false);
    expect(describeMember('MATCHED', 'ACCEPTED').canDropOff).toBe(false);
    expect(describeMember('IN_PROGRESS', 'COMPLETED').canDropOff).toBe(false);
  });
});

describe('timelineLabel', () => {
  it('words known events and passes unknown ones through', () => {
    expect(timelineLabel('DRIVER_ARRIVED')).toBe('Driver arrived at pick-up');
    expect(timelineLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('describeStartAction', () => {
  it('mentions the pool discount from two riders up', () => {
    expect(describeStartAction(2)).toBe('Start trip · 2 riders, pool discount applies');
    expect(describeStartAction(3)).toMatch(/3 riders/);
  });

  it('warns that a lone rider pays the solo fare once the trip starts', () => {
    expect(describeStartAction(1)).toMatch(/locked/);
  });
});
