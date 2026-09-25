'use client';

import type { RideDto } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ActionError } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatKm } from '@/lib/format';
import { describeRide } from '@/lib/ride-status';
import { FareBreakdown } from './fare-breakdown';
import { useCancelRide } from './hooks';
import { RideTimeline } from './ride-timeline';

interface RideTrackerProps {
  ride: RideDto;
  /** Shown once the ride is over, so the passenger can book again. */
  onBookAnother?: () => void;
}

export function RideTracker({ ride, onBookAnother }: RideTrackerProps) {
  const cancel = useCancelRide();
  const presentation = describeRide(ride.status, ride.pool?.status ?? null, {
    driverName: ride.pool?.driverName,
    pickup: ride.pickup,
  });

  return (
    <div className="space-y-4">
      <Card aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              {ride.pickup} → {ride.dropoff} · {formatKm(ride.distanceM)} · {ride.seats}{' '}
              {ride.seats === 1 ? 'seat' : 'seats'}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{presentation.label}</h1>
          </div>
          <StatusBadge
            label={ride.status.replace('_', ' ').toLowerCase()}
            tone={presentation.tone}
          />
        </div>
        <p className="mt-2 text-sm text-slate-600">{presentation.detail}</p>

        {ride.pool && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold">{ride.pool.vehicleName}</span> with{' '}
              {ride.pool.driverName}
            </p>
            <p className="mt-0.5 text-slate-500">
              {ride.pool.coRiderCount === 0
                ? 'No one else is aboard yet.'
                : `Sharing with ${ride.pool.coRiderCount} other ${ride.pool.coRiderCount === 1 ? 'rider' : 'riders'}.`}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <ActionError error={cancel.error} />
          {presentation.allowedActions.includes('cancel') && (
            <Button variant="danger" busy={cancel.isPending} onClick={() => cancel.mutate(ride.id)}>
              Cancel ride
            </Button>
          )}
          {presentation.finished && onBookAnother && (
            <Button onClick={onBookAnother}>Book another ride</Button>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Fare</CardTitle>
        <FareBreakdown fare={ride.fare} />
      </Card>

      {ride.timeline && ride.timeline.length > 0 && (
        <Card>
          <CardTitle>Timeline</CardTitle>
          <RideTimeline entries={ride.timeline} />
        </Card>
      )}
    </div>
  );
}
