import { Money } from '../../shared/domain/money';
import type { FareBreakdown, FarePolicy, TripForPricing } from './fare-policy';

/**
 * passengerFare = baseFare + distanceCharge - poolDiscount
 *   baseFare       = 30 taka per request, never discounted
 *   distanceCharge = 20 taka per km per seat (2 paisa per metre)
 *   poolDiscount   = 30% of distanceCharge, floored to whole paisa, only when pooled
 */
export class StandardFarePolicy implements FarePolicy {
  readonly version = 'v1';
  private readonly baseFare = Money.ofPaisa(3_000); // 30 taka
  private readonly paisaPerMetre = 2; // 20 taka per km
  private readonly poolDiscountBps = 3_000; // 30%

  quote({ distanceM, seats, pooled }: TripForPricing): FareBreakdown {
    const distance = Money.ofPaisa(distanceM * seats * this.paisaPerMetre);
    const discount = pooled ? distance.percentOfBps(this.poolDiscountBps) : Money.zero(); // floors
    const total = this.baseFare.plus(distance).minus(discount);
    return { base: this.baseFare, distance, discount, total, version: this.version };
  }
}
