'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatBDT, formatDateTime } from '@/lib/format';
import { describeRide } from '@/lib/ride-status';
import { useRideHistory } from './hooks';

export function RideHistoryPage() {
  const history = useRideHistory();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Your rides</h1>
      {history.isPending && <LoadingState label="Loading your rides" />}
      {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
      {history.data?.length === 0 && (
        <EmptyState
          title="No finished rides yet"
          description="Completed and cancelled rides show up here."
          action={
            <Link href="/ride" className="text-sm font-medium text-brand-700 underline">
              Request a ride
            </Link>
          }
        />
      )}
      <ul className="space-y-3">
        {history.data?.map((ride) => {
          const presentation = describeRide(ride.status, ride.pool?.status ?? null);
          return (
            <li key={ride.id}>
              <Link href={`/rides/${ride.id}`} className="block">
                <Card className="transition hover:border-brand-500">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {ride.pickup} → {ride.dropoff}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {formatDateTime(ride.completedAt ?? ride.cancelledAt ?? ride.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge label={presentation.label} tone={presentation.tone} />
                      {ride.fare.final && (
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          {formatBDT(ride.fare.final.totalPaisa)}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
