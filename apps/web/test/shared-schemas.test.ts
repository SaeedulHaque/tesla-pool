import {
  LoginBodySchema,
  RegisterBodySchema,
  TripSchema,
  normalizePhone,
} from '@tesla-pool/shared';
import { describe, expect, it } from 'vitest';

describe('shared schemas used by the forms', () => {
  it('normalises local phone numbers', () => {
    expect(normalizePhone('01800000003')).toBe('+8801800000003');
    expect(normalizePhone('+880 1800-000003')).toBe('+8801800000003');
  });

  it('accepts a valid registration and rejects a short password', () => {
    expect(
      RegisterBodySchema.safeParse({
        fullName: 'Nusrat',
        phone: '01800000003',
        password: 'pool-demo-123',
      }).success,
    ).toBe(true);
    const bad = RegisterBodySchema.safeParse({
      fullName: 'Nusrat',
      phone: '01800000003',
      password: 'short',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a login with an invalid phone', () => {
    expect(LoginBodySchema.safeParse({ phone: '123', password: 'x' }).success).toBe(false);
  });

  it('validates a trip: different zones, 1 to 3 seats', () => {
    expect(TripSchema.safeParse({ pickupZoneId: 1, dropoffZoneId: 4, seats: 1 }).success).toBe(
      true,
    );
    expect(TripSchema.safeParse({ pickupZoneId: 1, dropoffZoneId: 1, seats: 1 }).success).toBe(
      false,
    );
    expect(TripSchema.safeParse({ pickupZoneId: 1, dropoffZoneId: 4, seats: 4 }).success).toBe(
      false,
    );
    expect(TripSchema.safeParse({ pickupZoneId: null, dropoffZoneId: 4, seats: 1 }).success).toBe(
      false,
    );
  });
});
