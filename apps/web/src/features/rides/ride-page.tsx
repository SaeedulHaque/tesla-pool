'use client';

import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useActiveRide, useRide } from './hooks';
import { RequestRideForm } from './request-ride-form';
import { RideTracker } from './ride-tracker';

/** `/ride`: the request form when idle, the live tracker while a ride is active. */
export function RidePage() {
  const active = useActiveRide();
  const [trackedId, setTrackedId] = useState<string | null>(null);

  // Adopt the active ride (also after a page reload). Once it finishes it stays on screen, so the
  // result does not vanish mid-view, until the passenger chooses to book another.
  useEffect(() => {
    if (active.data) setTrackedId(active.data.id);
  }, [active.data]);

  const tracked = useRide(trackedId);

  if (active.isPending) return <LoadingState label="Checking for your ride" rows={2} />;
  if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;

  if (trackedId === null) return <RequestRideForm onRequested={(ride) => setTrackedId(ride.id)} />;
  if (tracked.isPending) return <LoadingState label="Loading your ride" />;
  if (tracked.isError)
    return <ErrorState error={tracked.error} onRetry={() => tracked.refetch()} />;

  return <RideTracker ride={tracked.data} onBookAnother={() => setTrackedId(null)} />;
}
