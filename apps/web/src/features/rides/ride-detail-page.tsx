'use client';

import Link from 'next/link';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ApiError } from '@/lib/api-client';
import { EmptyState } from '@/components/ui/empty-state';
import { useRide } from './hooks';
import { RideTracker } from './ride-tracker';

export function RideDetailPage({ id }: { id: string }) {
  const ride = useRide(id);

  if (ride.isPending) return <LoadingState label="Loading ride" />;
  if (ride.isError) {
    if (
      ride.error instanceof ApiError &&
      (ride.error.status === 404 || ride.error.status === 400)
    ) {
      return (
        <EmptyState
          title="We couldn't find that ride"
          description="It may not exist, or it belongs to someone else."
          action={
            <Link href="/rides" className="text-sm font-medium text-brand-700 underline">
              See your rides
            </Link>
          }
        />
      );
    }
    return <ErrorState error={ride.error} onRetry={() => ride.refetch()} />;
  }
  return (
    <div className="space-y-4">
      <Link href="/rides" className="text-sm font-medium text-brand-700 underline">
        ← All rides
      </Link>
      <RideTracker ride={ride.data} />
    </div>
  );
}
