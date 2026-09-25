import { describe, expect, it } from 'vitest';
import { formatBDT, formatKm } from '@/lib/format';

describe('formatBDT', () => {
  it('formats paisa as taka with two decimals', () => {
    expect(formatBDT(7_200)).toMatch(/৳\s?72\.00/);
    expect(formatBDT(5_800)).toMatch(/৳\s?58\.00/);
    expect(formatBDT(9_000)).toMatch(/৳\s?90\.00/);
  });

  it('keeps sub-taka paisa', () => {
    expect(formatBDT(7_205)).toMatch(/72\.05/);
  });

  it('groups thousands', () => {
    expect(formatBDT(123_456_00)).toMatch(/1,23,456\.00|123,456\.00/);
  });
});

describe('formatKm', () => {
  it('shows one decimal', () => {
    expect(formatKm(3_000)).toBe('3.0 km');
    expect(formatKm(2_500)).toBe('2.5 km');
  });
});
