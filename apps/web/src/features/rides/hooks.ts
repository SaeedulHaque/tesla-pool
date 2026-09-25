'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TripSchema } from '@tesla-pool/shared';
import { describeRide } from '@/lib/ride-status';
import { queryKeys } from '@/lib/query-keys';
import { ridesApi } from './api';

const RIDE_POLL_MS = 4_000;

export function useZones() {
  return useQuery({ queryKey: queryKeys.zones, queryFn: ridesApi.zones, staleTime: Infinity });
}

/** Live quote for the form; only asks the server once the trip is valid. */
export function useFareEstimate(
  pickupZoneId: number | null,
  dropoffZoneId: number | null,
  seats: number,
) {
  const trip = TripSchema.safeParse({ pickupZoneId, dropoffZoneId, seats });
  return useQuery({
    queryKey: queryKeys.estimate(pickupZoneId ?? 0, dropoffZoneId ?? 0, seats),
    queryFn: () =>
      ridesApi.estimate(
        trip.success ? trip.data.pickupZoneId : 0,
        trip.success ? trip.data.dropoffZoneId : 0,
        seats,
      ),
    enabled: trip.success,
    staleTime: 60_000,
  });
}

/** The passenger's current ride, if any. Polls while one exists; idle otherwise. */
export function useActiveRide() {
  return useQuery({
    queryKey: queryKeys.activeRides,
    queryFn: async () => (await ridesApi.list('active'))[0] ?? null,
    refetchInterval: (query) => (query.state.data ? RIDE_POLL_MS : false),
  });
}

/** One ride, refreshed every 4 s until it is finished. */
export function useRide(id: string | null) {
  return useQuery({
    queryKey: queryKeys.ride(id ?? ''),
    queryFn: () => ridesApi.get(id as string),
    enabled: id !== null,
    refetchInterval: (query) => {
      const ride = query.state.data;
      if (!ride) return RIDE_POLL_MS;
      return describeRide(ride.status, ride.pool?.status ?? null).finished ? false : RIDE_POLL_MS;
    },
  });
}

export function useRideHistory() {
  return useQuery({ queryKey: queryKeys.rideHistory, queryFn: () => ridesApi.list('history') });
}

/** No optimistic updates: the screen shows exactly what the server answered. */
export function useRequestRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ridesApi.request,
    onSuccess: (ride) => {
      queryClient.setQueryData(queryKeys.ride(ride.id), ride);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.activeRides }),
  });
}

export function useCancelRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ridesApi.cancel,
    onSuccess: (ride) => {
      queryClient.setQueryData(queryKeys.ride(ride.id), ride);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRides });
      queryClient.invalidateQueries({ queryKey: queryKeys.rideHistory });
    },
  });
}
