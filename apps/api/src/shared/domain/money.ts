/** Immutable value object over integer paisa. All fare math goes through it. */
export class Money {
  private constructor(readonly paisa: number) {}

  static ofPaisa(paisa: number): Money {
    if (!Number.isSafeInteger(paisa))
      throw new RangeError(`Money must be whole paisa, got ${paisa}`);
    return new Money(paisa);
  }

  static zero(): Money {
    return new Money(0);
  }

  plus(other: Money): Money {
    return Money.ofPaisa(this.paisa + other.paisa);
  }

  minus(other: Money): Money {
    return Money.ofPaisa(this.paisa - other.paisa);
  }

  /** `bps` basis points of this amount (10_000 bps = 100%), floored to whole paisa. */
  percentOfBps(bps: number): Money {
    const scaled = this.paisa * bps;
    const remainder = ((scaled % 10_000) + 10_000) % 10_000; // floor-mod, exact in integers
    return Money.ofPaisa((scaled - remainder) / 10_000);
  }

  equals(other: Money): boolean {
    return this.paisa === other.paisa;
  }
}
