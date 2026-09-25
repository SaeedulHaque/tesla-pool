export const RIDE_REQUEST_STATUSES = [
  'REQUESTED',
  'MATCHED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type RideRequestStatus = (typeof RIDE_REQUEST_STATUSES)[number];

export const POOL_STATUSES = [
  'ACCEPTED',
  'DRIVER_ARRIVED',
  'STARTED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];

export const USER_ROLES = ['PASSENGER', 'DRIVER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACTIVE_REQUEST_STATUSES: readonly RideRequestStatus[] = [
  'REQUESTED',
  'MATCHED',
  'IN_PROGRESS',
];
export const ACTIVE_POOL_STATUSES: readonly PoolStatus[] = [
  'ACCEPTED',
  'DRIVER_ARRIVED',
  'STARTED',
];
