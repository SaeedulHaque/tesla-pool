import type {
  AvailabilityInput,
  DriverPoolDto,
  DriverQueueDto,
  RideScope,
  VehicleDto,
} from '@tesla-pool/shared';
import { apiFetch } from '@/lib/api-client';

export type PoolAction = 'arrive' | 'start' | 'cancel';

export const driverApi = {
  queue: () => apiFetch<DriverQueueDto>('/driver/queue'),
  setAvailability: (input: AvailabilityInput) =>
    apiFetch<{ vehicle: VehicleDto }>('/driver/availability', { method: 'PUT', body: input }).then(
      (body) => body.vehicle,
    ),
  accept: (requestId: string) =>
    apiFetch<{ pool: DriverPoolDto }>(`/driver/queue/${requestId}/accept`, { method: 'POST' }).then(
      (body) => body.pool,
    ),
  pools: (scope: RideScope) =>
    apiFetch<{ items: DriverPoolDto[] }>(`/pools?scope=${scope}`).then((body) => body.items),
  poolAction: (poolId: string, action: PoolAction) =>
    apiFetch<{ pool: DriverPoolDto }>(`/pools/${poolId}/${action}`, { method: 'POST' }).then(
      (body) => body.pool,
    ),
  dropOff: (poolId: string, requestId: string) =>
    apiFetch<{ pool: DriverPoolDto }>(`/pools/${poolId}/members/${requestId}/drop-off`, {
      method: 'POST',
    }).then((body) => body.pool),
};
