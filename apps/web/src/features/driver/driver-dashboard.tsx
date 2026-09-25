'use client';

import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { describePool } from '@/lib/ride-status';
import { ActivePoolCard } from './active-pool-card';
import { AvailabilityToggle } from './availability-toggle';
import { useActivePool, useDriverQueue } from './hooks';
import { RequestQueue } from './request-queue';

/** `/driver`: availability, the active trip with its seat meter, and the request queue. */
export function DriverDashboard() {
  const queue = useDriverQueue();
  const activePool = useActivePool();

  if (queue.isPending || activePool.isPending)
    return <LoadingState label="Loading your dashboard" />;
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => queue.refetch()} />;
  if (activePool.isError)
    return <ErrorState error={activePool.error} onRetry={() => activePool.refetch()} />;

  const pool = activePool.data;
  return (
    <div className="space-y-4">
      <AvailabilityToggle vehicle={queue.data.vehicle} locked={pool !== null} />
      {pool && <ActivePoolCard pool={pool} />}
      <RequestQueue
        queue={queue.data}
        hasActivePool={pool !== null}
        poolLocked={pool !== null && !describePool(pool.status).allowedActions.includes('cancel')}
      />
    </div>
  );
}
