'use client';

import type { DriverPoolMemberDto, PoolStatus } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatBDT } from '@/lib/format';
import { describeMember } from '@/lib/ride-status';

interface MemberRowProps {
  member: DriverPoolMemberDto;
  poolStatus: PoolStatus;
  onDropOff: () => void;
  busy: boolean;
  disabled: boolean;
}

export function MemberRow({ member, poolStatus, onDropOff, busy, disabled }: MemberRowProps) {
  const presentation = describeMember(member.status, poolStatus);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium text-slate-900">
          {member.passengerName}{' '}
          <span className="font-normal text-slate-500">
            · {member.seats} {member.seats === 1 ? 'seat' : 'seats'}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          To {member.dropoff}
          {member.farePaisa !== null && (
            <span className="ml-2 font-semibold tabular-nums text-slate-900">
              {formatBDT(member.farePaisa)} cash
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label={presentation.label} tone={presentation.tone} />
        {presentation.canDropOff && (
          <Button variant="secondary" busy={busy} disabled={disabled} onClick={onDropOff}>
            Drop off
          </Button>
        )}
      </div>
    </li>
  );
}
