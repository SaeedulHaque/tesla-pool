'use client';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatBDT, formatDateTime } from '@/lib/format';
import { describePool } from '@/lib/ride-status';
import { usePoolHistory } from './hooks';

export function TripHistoryPage() {
  const history = usePoolHistory();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Trip history</h1>
      {history.isPending && <LoadingState label="Loading trips" />}
      {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
      {history.data?.length === 0 && (
        <EmptyState
          title="No finished trips yet"
          description="Completed and cancelled trips appear here."
        />
      )}
      <ul className="space-y-3">
        {history.data?.map((pool) => {
          const presentation = describePool(pool.status);
          const collected = pool.members.reduce(
            (sum, member) => sum + (member.status === 'COMPLETED' ? (member.farePaisa ?? 0) : 0),
            0,
          );
          return (
            <li key={pool.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {pool.vehicleName} from {pool.pickup}
                    </p>
                    <p className="text-sm text-slate-500">{formatDateTime(pool.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge label={presentation.label} tone={presentation.tone} />
                    {pool.status === 'COMPLETED' && (
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatBDT(collected)} collected
                      </p>
                    )}
                  </div>
                </div>
                {pool.members.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 text-sm">
                    {pool.members.map((member) => (
                      <li key={member.requestId} className="flex justify-between gap-3 py-2">
                        <span>
                          {member.passengerName}{' '}
                          <span className="text-slate-500">→ {member.dropoff}</span>
                        </span>
                        <span className="tabular-nums">
                          {member.farePaisa !== null ? formatBDT(member.farePaisa) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
