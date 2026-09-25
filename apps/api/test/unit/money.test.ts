import { describe, expect, it } from 'vitest';
import { Money } from '../../src/shared/domain/money';

describe('Money', () => {
  it('adds and subtracts whole paisa', () => {
    expect(Money.ofPaisa(3_000).plus(Money.ofPaisa(6_000)).minus(Money.ofPaisa(1_800)).paisa).toBe(
      7_200,
    );
  });

  it('is immutable', () => {
    const base = Money.ofPaisa(100);
    base.plus(Money.ofPaisa(50));
    expect(base.paisa).toBe(100);
  });

  it('takes basis points of an amount, flooring to whole paisa', () => {
    expect(Money.ofPaisa(6_000).percentOfBps(3_000).paisa).toBe(1_800);
    expect(Money.ofPaisa(4_001).percentOfBps(3_000).paisa).toBe(1_200); // 1200.3
    expect(Money.ofPaisa(3).percentOfBps(3_000).paisa).toBe(0); // 0.9
    expect(Money.ofPaisa(10_000).percentOfBps(0).paisa).toBe(0);
    expect(Money.ofPaisa(10_000).percentOfBps(10_000).paisa).toBe(10_000);
  });

  it('rejects fractional basis points with a clear message', () => {
    expect(() => Money.ofPaisa(6_000).percentOfBps(0.5)).toThrow(/basis points/i);
  });

  it('rejects fractional or non-finite paisa', () => {
    expect(() => Money.ofPaisa(1.5)).toThrow(RangeError);
    expect(() => Money.ofPaisa(Number.NaN)).toThrow(RangeError);
    expect(() => Money.ofPaisa(Infinity)).toThrow(RangeError);
  });

  it('compares by value', () => {
    expect(Money.ofPaisa(5).equals(Money.ofPaisa(5))).toBe(true);
    expect(Money.zero().equals(Money.ofPaisa(1))).toBe(false);
  });
});
