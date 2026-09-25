import { POOL_STATUSES, RIDE_REQUEST_STATUSES } from '@tesla-pool/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTransitionError } from '../../src/shared/domain/domain-error';
import { PoolLifecycle } from '../../src/modules/pools/pool.lifecycle';
import { RideRequestLifecycle } from '../../src/modules/rides/ride-request.lifecycle';

// Independent copy of the tables in DESIGN.md section 3/4: the code under test must agree with it.
const ALLOWED_REQUEST: Record<string, string[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['IN_PROGRESS', 'CANCELLED', 'REQUESTED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
const ALLOWED_POOL: Record<string, string[]> = {
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function everyPair<S extends string>(states: readonly S[]): [S, S][] {
  return states.flatMap((from) => states.map((to): [S, S] => [from, to]));
}

describe('RideRequestLifecycle', () => {
  const pairs = everyPair(RIDE_REQUEST_STATUSES);

  it('covers every status', () => {
    expect(RideRequestLifecycle.states().sort()).toEqual([...RIDE_REQUEST_STATUSES].sort());
  });

  it.each(pairs)('%s -> %s', (from, to) => {
    if (ALLOWED_REQUEST[from].includes(to)) {
      expect(RideRequestLifecycle.can(from, to)).toBe(true);
      expect(() => RideRequestLifecycle.assert(from, to)).not.toThrow();
    } else {
      expect(RideRequestLifecycle.can(from, to)).toBe(false);
      expect(() => RideRequestLifecycle.assert(from, to)).toThrow(InvalidTransitionError);
    }
  });
});

describe('PoolLifecycle', () => {
  const pairs = everyPair(POOL_STATUSES);

  it('covers every status', () => {
    expect(PoolLifecycle.states().sort()).toEqual([...POOL_STATUSES].sort());
  });

  it.each(pairs)('%s -> %s', (from, to) => {
    if (ALLOWED_POOL[from].includes(to)) {
      expect(() => PoolLifecycle.assert(from, to)).not.toThrow();
    } else {
      expect(() => PoolLifecycle.assert(from, to)).toThrow(InvalidTransitionError);
    }
  });

  it('reports which machine rejected what', () => {
    expect(() => PoolLifecycle.assert('ACCEPTED', 'STARTED')).toThrow(
      'Pool cannot move from ACCEPTED to STARTED.',
    );
  });
});
