import type { UserRole } from './statuses';

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
