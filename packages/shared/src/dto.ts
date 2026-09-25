import type { PoolStatus, RideRequestStatus, UserRole } from './statuses';

export interface UserDto {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}

export interface ZoneDto {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface FareBreakdownDto {
  basePaisa: number;
  distancePaisa: number;
  discountPaisa: number;
  totalPaisa: number;
}

export interface FareEstimateDto {
  pickup: string;
  dropoff: string;
  seats: number;
  distanceM: number;
  solo: FareBreakdownDto;
  pooled: FareBreakdownDto;
  estimatedSoloPaisa: number;
  estimatedPooledPaisa: number;
  pricingVersion: string;
}

export interface TimelineEntryDto {
  type: string;
  at: string;
  fromStatus: string | null;
  toStatus: string | null;
}

/** What a passenger may know about the pool their ride is in. Never names or fares of co-riders. */
export interface RidePoolDto {
  status: PoolStatus;
  driverName: string;
  vehicleName: string;
  coRiderCount: number;
}

/** A passenger's view of their own ride. */
export interface RideDto {
  id: string;
  status: RideRequestStatus;
  pickup: string;
  dropoff: string;
  seats: number;
  distanceM: number;
  fare: {
    estimatedSoloPaisa: number;
    estimatedPooledPaisa: number;
    final: FareBreakdownDto | null;
    pricingVersion: string;
  };
  pool: RidePoolDto | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Only present on the single-ride endpoint. */
  timeline?: TimelineEntryDto[];
}
