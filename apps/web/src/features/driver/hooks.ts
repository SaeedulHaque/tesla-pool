'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { driverApi, type PoolAction } from './api';

const DRIVER_POLL_MS = 5_000;

/** Requests waiting in the driver's zone, plus the vehicle's own state. Polled every 5 s. */
export function useDriverQueue() {
  return useQuery({
    queryKey: queryKeys.driverQueue,
    queryFn: driverApi.queue,
    refetchInterval: DRIVER_POLL_MS,
  });
}

/** The driver's current trip, if any. Riders can join or leave, so it is polled too. */
export function useActivePool() {
  return useQuery({
    queryKey: queryKeys.activePools,
    queryFn: async () => (await driverApi.pools('active'))[0] ?? null,
    refetchInterval: DRIVER_POLL_MS,
  });
}

export function usePoolHistory() {
  return useQuery({ queryKey: queryKeys.poolHistory, queryFn: () => driverApi.pools('history') });
}

/** After any change the server may have answered differently than expected: refetch, never guess. */
function useRefreshDriverData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.driverQueue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activePools }),
      queryClient.invalidateQueries({ queryKey: queryKeys.poolHistory }),
    ]);
}

export function useSetAvailability() {
  const refresh = useRefreshDriverData();
  return useMutation({ mutationFn: driverApi.setAvailability, onSettled: refresh });
}

export function useAcceptRequest() {
  const refresh = useRefreshDriverData();
  return useMutation({ mutationFn: driverApi.accept, onSettled: refresh });
}

export function usePoolAction() {
  const refresh = useRefreshDriverData();
  return useMutation({
    mutationFn: ({ poolId, action }: { poolId: string; action: PoolAction }) =>
      driverApi.poolAction(poolId, action),
    onSettled: refresh,
  });
}

export function useDropOff() {
  const refresh = useRefreshDriverData();
  return useMutation({
    mutationFn: ({ poolId, requestId }: { poolId: string; requestId: string }) =>
      driverApi.dropOff(poolId, requestId),
    onSettled: refresh,
  });
}
