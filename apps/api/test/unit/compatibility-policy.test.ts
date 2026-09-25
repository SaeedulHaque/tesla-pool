import { describe, expect, it } from 'vitest';
import { DistanceCompatibilityPolicy } from '../../src/modules/pools/pool-compatibility-policy';
import { bulletPool, jashim, matrix, policy, ride } from './support/fixtures';

describe('DistanceCompatibilityPolicy', () => {
  it('accepts anyone into an empty pool at the same pick-up zone', () => {
    expect(policy.accepts(bulletPool(), ride('nusrat', 'UTTARA'))).toBe(true);
  });

  it('counts the same drop-off zone as 0 km', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    expect(policy.accepts(pool, ride('shirin', 'MOHAKHALI'))).toBe(true);
  });

  it('accepts Gulshan 1 next to Mohakhali (2.5 km)', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    expect(policy.accepts(pool, ride('rafiq', 'GULSHAN_1'))).toBe(true);
  });

  it('treats exactly 3.0 km as compatible and 3.5 km as not', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    expect(matrix.distanceM(4, 3)).toBe(3_000); // Mohakhali <-> Gulshan 2
    expect(policy.accepts(pool, ride('a', 'GULSHAN_2'))).toBe(true);

    const gulshanPool = bulletPool();
    gulshanPool.admit(ride('rafiq', 'GULSHAN_1'), policy, jashim);
    expect(matrix.distanceM(2, 9)).toBe(3_500); // Gulshan 1 <-> Bashundhara
    expect(policy.accepts(gulshanPool, ride('b', 'BASHUNDHARA'))).toBe(false);
  });

  it('must be within range of EVERY member, not just one', () => {
    const pool = bulletPool();
    pool.admit(ride('rafiq', 'GULSHAN_2'), policy, jashim);
    pool.admit(ride('nusrat', 'BASHUNDHARA'), policy, jashim); // Gulshan 2 <-> Bashundhara = 3.0 km
    // Mohakhali is 3.0 km from Gulshan 2 but 6.0 km from Bashundhara.
    expect(policy.accepts(pool, ride('shirin', 'MOHAKHALI'))).toBe(false);
  });

  it('ignores members who have left', () => {
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'UTTARA'), policy, jashim);
    expect(policy.accepts(pool, ride('shirin', 'MOHAKHALI'))).toBe(false);
    pool.activeMemberships()[0].leave('PASSENGER_CANCELLED');
    expect(policy.accepts(pool, ride('shirin', 'MOHAKHALI'))).toBe(true);
  });

  it('rejects a different pick-up zone', () => {
    expect(policy.accepts(bulletPool(), ride('nusrat', 'MOHAKHALI', { pickup: 'FARMGATE' }))).toBe(
      false,
    );
  });

  it('honours a custom threshold', () => {
    const strict = new DistanceCompatibilityPolicy(matrix, 2_000);
    const pool = bulletPool();
    pool.admit(ride('nusrat', 'MOHAKHALI'), policy, jashim);
    expect(strict.accepts(pool, ride('rafiq', 'GULSHAN_1'))).toBe(false); // 2.5 km > 2 km
  });
});
