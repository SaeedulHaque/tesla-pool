'use client';

import { formatBDT, formatKm } from '@/lib/format';
import { ErrorState } from '@/components/ui/error-state';
import { useFareEstimate } from './hooks';

interface FareEstimateProps {
  pickupZoneId: number | null;
  dropoffZoneId: number | null;
  seats: number;
}

/** What the trip will cost alone versus shared. It is not known yet whether it will be shared. */
export function FareEstimate({ pickupZoneId, dropoffZoneId, seats }: FareEstimateProps) {
  const estimate = useFareEstimate(pickupZoneId, dropoffZoneId, seats);

  if (pickupZoneId === null || dropoffZoneId === null) {
    return (
      <p className="text-sm text-slate-500">Choose where you&apos;re going to see the fare.</p>
    );
  }
  if (estimate.isPending && estimate.fetchStatus !== 'idle') {
    return (
      <div
        role="status"
        aria-label="Estimating fare"
        className="h-24 animate-pulse rounded-xl bg-slate-200/70"
      />
    );
  }
  if (estimate.isError)
    return <ErrorState error={estimate.error} onRetry={() => estimate.refetch()} />;
  if (!estimate.data) return null;

  const { pooled, solo, distanceM } = estimate.data;
  return (
    <div className="rounded-xl bg-brand-50 p-4" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            If you share
          </p>
          <p className="text-2xl font-bold text-slate-900">{formatBDT(pooled.totalPaisa)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Riding alone
          </p>
          <p className="text-lg font-semibold text-slate-600">{formatBDT(solo.totalPaisa)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {formatKm(distanceM)} · {formatBDT(pooled.discountPaisa)} pool discount if another rider
        joins before the trip starts.
      </p>
    </div>
  );
}
