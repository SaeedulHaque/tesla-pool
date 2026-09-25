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

export interface VehicleDto {
  id: string;
  displayName: string;
  seatCapacity: number;
  online: boolean;
  zoneId: number | null;
  zoneName: string | null;
}

export interface QueueItemDto {
  id: string;
  passengerName: string;
  pickup: string;
  dropoff: string;
  seats: number;
  distanceM: number;
  createdAt: string;
  /** Would this request be admitted to the driver's current pool right now? */
  fitsActivePool: boolean;
}

export interface DriverQueueDto {
  vehicle: VehicleDto;
  items: QueueItemDto[];
}

export interface DriverPoolMemberDto {
  requestId: string;
  passengerName: string;
  dropoff: string;
  seats: number;
  status: RideRequestStatus;
  /** Null until the trip starts and the fare is locked in. */
  farePaisa: number | null;
  joinedAt: string;
}

/** A driver's view of one Tesla trip, with every rider in it. */
export interface DriverPoolDto {
  id: string;
  status: PoolStatus;
  pickup: string;
  vehicleName: string;
  seatCapacity: number;
  seatsOccupied: number;
  createdAt: string;
  members: DriverPoolMemberDto[];
}
