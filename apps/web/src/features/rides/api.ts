import type {
  CreateRideRequestInput,
  FareEstimateDto,
  RideDto,
  RideScope,
  ZoneDto,
} from '@tesla-pool/shared';
import { apiFetch } from '@/lib/api-client';

export const ridesApi = {
  zones: () => apiFetch<{ items: ZoneDto[] }>('/zones').then((body) => body.items),
  estimate: (pickupZoneId: number, dropoffZoneId: number, seats: number) =>
    apiFetch<{ estimate: FareEstimateDto }>(
      `/fare-estimates?pickupZoneId=${pickupZoneId}&dropoffZoneId=${dropoffZoneId}&seats=${seats}`,
    ).then((body) => body.estimate),
  request: (input: CreateRideRequestInput) =>
    apiFetch<{ ride: RideDto }>('/ride-requests', { method: 'POST', body: input }).then(
      (body) => body.ride,
    ),
  list: (scope: RideScope) =>
    apiFetch<{ items: RideDto[] }>(`/ride-requests?scope=${scope}`).then((body) => body.items),
  get: (id: string) =>
    apiFetch<{ ride: RideDto }>(`/ride-requests/${id}`).then((body) => body.ride),
  cancel: (id: string) =>
    apiFetch<{ ride: RideDto }>(`/ride-requests/${id}/cancel`, { method: 'POST' }).then(
      (body) => body.ride,
    ),
};
