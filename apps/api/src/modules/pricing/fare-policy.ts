import type { Money } from '../../shared/domain/money';

export interface TripForPricing {
  distanceM: number;
  seats: number;
  /** True when the pool has at least two active requests. */
  pooled: boolean;
}

export interface FareBreakdown {
  base: Money;
  distance: Money;
  discount: Money;
  total: Money;
  version: string;
}

/** Strategy: surcharges or new discount rules become a new policy with a new version. */
export interface FarePolicy {
  readonly version: string;
  quote(trip: TripForPricing): FareBreakdown;
}
