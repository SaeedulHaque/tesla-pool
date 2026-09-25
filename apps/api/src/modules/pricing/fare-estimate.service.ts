import type { FareBreakdownDto, FareEstimateDto, Trip } from '@tesla-pool/shared';
import type { DistanceProvider } from '../geography/distance-provider';
import type { ZoneDistanceMatrix } from '../geography/zone-distance-matrix';
import type { FareBreakdown, FarePolicy } from './fare-policy';

export function toBreakdownDto(fare: FareBreakdown): FareBreakdownDto {
  return {
    basePaisa: fare.base.paisa,
    distancePaisa: fare.distance.paisa,
    discountPaisa: fare.discount.paisa,
    totalPaisa: fare.total.paisa,
  };
}

/** Both quotes a passenger needs before it is known whether they will share. */
export class FareEstimateService {
  constructor(
    private readonly zones: Pick<ZoneDistanceMatrix, 'requireZone'> & DistanceProvider,
    private readonly farePolicy: FarePolicy,
  ) {}

  estimate(trip: Trip): FareEstimateDto {
    const pickup = this.zones.requireZone(trip.pickupZoneId);
    const dropoff = this.zones.requireZone(trip.dropoffZoneId);
    const distanceM = this.zones.distanceM(pickup.id, dropoff.id);
    const solo = this.farePolicy.quote({ distanceM, seats: trip.seats, pooled: false });
    const pooled = this.farePolicy.quote({ distanceM, seats: trip.seats, pooled: true });
    return {
      pickup: pickup.name,
      dropoff: dropoff.name,
      seats: trip.seats,
      distanceM,
      solo: toBreakdownDto(solo),
      pooled: toBreakdownDto(pooled),
      estimatedSoloPaisa: solo.total.paisa,
      estimatedPooledPaisa: pooled.total.paisa,
      pricingVersion: this.farePolicy.version,
    };
  }
}
