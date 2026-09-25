import type { RideDto, RidePoolDto, TimelineEntryDto } from '@tesla-pool/shared';
import type { RideEvent } from '../audit/ride-event.entity';
import type { RideRequest } from './ride-request.entity';

export interface ZoneNames {
  nameOf(zoneId: number): string;
}

export interface PassengerPoolFacts {
  status: RidePoolDto['status'];
  driverName: string;
  vehicleName: string;
  /** Other riders still in the pool: a count only, never who they are. */
  coRiderCount: number;
}

/** Event types a passenger sees on their own timeline. */
export const PASSENGER_TIMELINE_TYPES: readonly string[] = [
  'RIDE_REQUESTED',
  'REQUEST_MATCHED',
  'DRIVER_ARRIVED',
  'REQUEST_STARTED',
  'REQUEST_COMPLETED',
  'REQUEST_CANCELLED',
  'REQUEST_REQUEUED',
];

/**
 * Entities never serialize directly. Each audience gets its own explicit mapping, so a field
 * only reaches a response because someone listed it here.
 */
export class RidePresenter {
  constructor(private readonly zones: ZoneNames) {}

  forPassenger(
    request: RideRequest,
    pool: PassengerPoolFacts | null,
    timeline?: readonly RideEvent[],
  ): RideDto {
    const dto: RideDto = {
      id: request.id,
      status: request.status,
      pickup: this.zones.nameOf(request.pickupZoneId),
      dropoff: this.zones.nameOf(request.dropoffZoneId),
      seats: request.seats,
      distanceM: request.distanceM,
      fare: {
        estimatedSoloPaisa: request.estSoloFarePaisa,
        estimatedPooledPaisa: request.estPooledFarePaisa,
        final:
          request.fareTotalPaisa === null
            ? null
            : {
                basePaisa: request.fareBasePaisa ?? 0,
                distancePaisa: request.fareDistancePaisa ?? 0,
                discountPaisa: request.fareDiscountPaisa ?? 0,
                totalPaisa: request.fareTotalPaisa,
              },
        pricingVersion: request.pricingVersion,
      },
      pool: pool && {
        status: pool.status,
        driverName: pool.driverName,
        vehicleName: pool.vehicleName,
        coRiderCount: pool.coRiderCount,
      },
      createdAt: request.createdAt.toISOString(),
      completedAt: request.completedAt?.toISOString() ?? null,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
    };
    if (timeline) dto.timeline = timeline.map(toTimelineEntry);
    return dto;
  }
}

function toTimelineEntry(event: RideEvent): TimelineEntryDto {
  return {
    type: event.type,
    at: event.occurredAt.toISOString(),
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
  };
}
