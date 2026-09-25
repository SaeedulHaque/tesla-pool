'use client';

import { useState } from 'react';
import type { DriverPoolDto } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ActionError } from '@/components/ui/error-state';
import { SeatMeter } from '@/components/ui/seat-meter';
import { StatusBadge } from '@/components/ui/status-badge';
import { describePool } from '@/lib/ride-status';
import { useDropOff, usePoolAction } from './hooks';
import { MemberRow } from './member-row';

export function ActivePoolCard({ pool }: { pool: DriverPoolDto }) {
  const action = usePoolAction();
  const dropOff = useDropOff();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const presentation = describePool(pool.status);
  const pending = action.isPending || dropOff.isPending;
  const riders = pool.members.length;

  const run = (poolAction: 'arrive' | 'start' | 'cancel') => {
    setConfirmingCancel(false);
    action.mutate({ poolId: pool.id, action: poolAction });
  };

  return (
    <Card>
      <CardTitle action={<StatusBadge label={presentation.label} tone={presentation.tone} />}>
        Your trip from {pool.pickup}
      </CardTitle>

      <SeatMeter occupied={pool.seatsOccupied} capacity={pool.seatCapacity} />

      <ul className="mt-2 divide-y divide-slate-100" aria-label="Riders">
        {pool.members.map((member) => (
          <MemberRow
            key={member.requestId}
            member={member}
            poolStatus={pool.status}
            busy={dropOff.isPending && dropOff.variables?.requestId === member.requestId}
            disabled={pending}
            onDropOff={() => dropOff.mutate({ poolId: pool.id, requestId: member.requestId })}
          />
        ))}
      </ul>

      <div className="mt-3 space-y-3">
        <ActionError error={action.error ?? dropOff.error} />
        <div className="flex flex-wrap gap-3">
          {presentation.allowedActions.includes('arrive') && (
            <Button
              busy={action.isPending && action.variables?.action === 'arrive'}
              disabled={pending}
              onClick={() => run('arrive')}
            >
              I&apos;ve arrived at {pool.pickup}
            </Button>
          )}
          {presentation.allowedActions.includes('start') && (
            <Button
              busy={action.isPending && action.variables?.action === 'start'}
              disabled={pending}
              onClick={() => run('start')}
            >
              Start trip
              {riders >= 2
                ? ` · ${riders} riders, pool discount applies`
                : ' · fares are locked when you start'}
            </Button>
          )}
          {presentation.allowedActions.includes('cancel') && !confirmingCancel && (
            <Button variant="danger" disabled={pending} onClick={() => setConfirmingCancel(true)}>
              Cancel trip
            </Button>
          )}
        </div>
        {confirmingCancel && (
          <div
            role="alertdialog"
            aria-label="Confirm cancel trip"
            className="rounded-xl border border-red-200 bg-red-50 p-3"
          >
            <p className="text-sm text-red-900">
              Cancel this trip? Your riders go back to the queue; they keep their place and are not
              cancelled.
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                variant="danger"
                busy={action.isPending && action.variables?.action === 'cancel'}
                onClick={() => run('cancel')}
              >
                Yes, cancel trip
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingCancel(false)}>
                Keep trip
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
