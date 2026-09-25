'use client';

import type { DriverQueueDto, QueueItemDto } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionError } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatKm, formatTime } from '@/lib/format';
import { useAcceptRequest } from './hooks';

interface RequestQueueProps {
  queue: DriverQueueDto;
  hasActivePool: boolean;
  /** The active trip has started, so nothing more can be added to it. */
  poolLocked: boolean;
}

export function RequestQueue({ queue, hasActivePool, poolLocked }: RequestQueueProps) {
  const accept = useAcceptRequest();
  const { vehicle, items } = queue;

  return (
    <Card>
      <CardTitle>
        Ride requests{vehicle.online && vehicle.zoneName ? ` in ${vehicle.zoneName}` : ''}
      </CardTitle>
      {!vehicle.online ? (
        <EmptyState
          title="You're offline"
          description="Go online in a zone to see ride requests."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={`No ride requests in ${vehicle.zoneName} right now.`}
          description="New requests appear here within a few seconds."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              disabled={accept.isPending || poolLocked}
              busy={accept.isPending && accept.variables === item.id}
              hasActivePool={hasActivePool}
              onAccept={() => accept.mutate(item.id)}
            />
          ))}
        </ul>
      )}
      <div className="mt-3">
        <ActionError error={accept.error} />
      </div>
    </Card>
  );
}

interface QueueRowProps {
  item: QueueItemDto;
  disabled: boolean;
  busy: boolean;
  hasActivePool: boolean;
  onAccept: () => void;
}

function QueueRow({ item, disabled, busy, hasActivePool, onAccept }: QueueRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <div>
        <p className="font-medium text-slate-900">
          {item.passengerName}{' '}
          <span className="font-normal text-slate-500">
            · {item.seats} {item.seats === 1 ? 'seat' : 'seats'}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          {item.pickup} → {item.dropoff} · {formatKm(item.distanceM)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Requested {formatTime(item.createdAt)}</p>
      </div>
      <div className="flex items-center gap-3">
        {hasActivePool && (
          <StatusBadge
            label={item.fitsActivePool ? 'Fits your trip' : 'Does not fit'}
            tone={item.fitsActivePool ? 'success' : 'warning'}
          />
        )}
        <Button busy={busy} disabled={disabled} onClick={onAccept}>
          {hasActivePool ? 'Add to trip' : 'Accept'}
        </Button>
      </div>
    </li>
  );
}
