import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/shared/domain/domain-error';
import { ZoneDistanceMatrix } from '../../src/modules/geography/zone-distance-matrix';

const zone = (id: number, code: string) => ({ id, code, name: code, latitude: 0, longitude: 0 });

const matrix = new ZoneDistanceMatrix(
  [zone(1, 'BANANI'), zone(2, 'GULSHAN_1'), zone(4, 'MOHAKHALI'), zone(9, 'UTTARA')],
  [
    { fromZoneId: 1, toZoneId: 4, distanceM: 3_000 },
    { fromZoneId: 4, toZoneId: 1, distanceM: 3_000 },
    { fromZoneId: 2, toZoneId: 4, distanceM: 2_500 },
    { fromZoneId: 4, toZoneId: 2, distanceM: 2_500 },
  ],
);

describe('ZoneDistanceMatrix', () => {
  it('looks distances up in either direction', () => {
    expect(matrix.distanceM(1, 4)).toBe(3_000);
    expect(matrix.distanceM(4, 1)).toBe(3_000);
    expect(matrix.distanceM(2, 4)).toBe(2_500);
  });

  it('counts the same zone as 0 metres', () => {
    expect(matrix.distanceM(4, 4)).toBe(0);
  });

  it('refuses an undefined pair instead of guessing', () => {
    expect(() => matrix.distanceM(1, 9)).toThrow(ValidationFailedError);
  });

  it('lists zones in id order and validates zone ids', () => {
    expect(matrix.zones().map((z) => z.code)).toEqual([
      'BANANI',
      'GULSHAN_1',
      'MOHAKHALI',
      'UTTARA',
    ]);
    expect(matrix.requireZone(1).code).toBe('BANANI');
    expect(() => matrix.requireZone(99)).toThrow(ValidationFailedError);
  });
});
