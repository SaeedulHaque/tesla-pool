import { describe, expect, it } from 'vitest';
import { StandardFarePolicy } from '../../src/modules/pricing/standard-fare-policy';

const policy = new StandardFarePolicy();
const nusrat = { distanceM: 3_000, seats: 1 }; // Banani -> Mohakhali
const rafiq = { distanceM: 2_000, seats: 1 }; // Banani -> Gulshan 1

describe('StandardFarePolicy v1', () => {
  it('quotes Nusrat: 30 base + 60 distance - 18 pool discount = 72 taka pooled', () => {
    const fare = policy.quote({ ...nusrat, pooled: true });
    expect(fare.base.paisa).toBe(3_000);
    expect(fare.distance.paisa).toBe(6_000);
    expect(fare.discount.paisa).toBe(1_800);
    expect(fare.total.paisa).toBe(7_200);
  });

  it('quotes Rafiq: 30 base + 40 distance - 12 pool discount = 58 taka pooled', () => {
    const fare = policy.quote({ ...rafiq, pooled: true });
    expect(fare.distance.paisa).toBe(4_000);
    expect(fare.discount.paisa).toBe(1_200);
    expect(fare.total.paisa).toBe(5_800);
  });

  it('quotes solo fares without any discount: 90 and 70 taka', () => {
    expect(policy.quote({ ...nusrat, pooled: false }).total.paisa).toBe(9_000);
    expect(policy.quote({ ...rafiq, pooled: false }).total.paisa).toBe(7_000);
    expect(policy.quote({ ...nusrat, pooled: false }).discount.paisa).toBe(0);
  });

  it('charges distance per seat but the base fare once per request', () => {
    const fare = policy.quote({ distanceM: 3_000, seats: 2, pooled: false });
    expect(fare.distance.paisa).toBe(12_000);
    expect(fare.total.paisa).toBe(15_000);
  });

  it('never discounts the base fare and keeps the invariant total = base + distance - discount', () => {
    for (const distanceM of [500, 1_500, 2_500, 3_500, 13_000]) {
      for (const seats of [1, 2, 3]) {
        const fare = policy.quote({ distanceM, seats, pooled: true });
        expect(fare.base.paisa).toBe(3_000);
        expect(fare.total.paisa).toBe(fare.base.paisa + fare.distance.paisa - fare.discount.paisa);
        expect(fare.discount.paisa).toBe(Math.floor((fare.distance.paisa * 3_000) / 10_000));
      }
    }
  });

  it('stamps the pricing version', () => {
    expect(policy.version).toBe('v1');
    expect(policy.quote({ ...nusrat, pooled: true }).version).toBe('v1');
  });
});
