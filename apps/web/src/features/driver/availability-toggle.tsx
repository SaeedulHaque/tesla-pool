'use client';

import { useEffect, useState } from 'react';
import type { VehicleDto } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ActionError } from '@/components/ui/error-state';
import { SelectField } from '@/components/ui/field';
import { StatusBadge } from '@/components/ui/status-badge';
import { useZones } from '@/features/rides/hooks';
import { useSetAvailability } from './hooks';

interface AvailabilityToggleProps {
  vehicle: VehicleDto;
  /** A running or accepted trip blocks changes; the API refuses them too. */
  locked: boolean;
}

export function AvailabilityToggle({ vehicle, locked }: AvailabilityToggleProps) {
  const zones = useZones();
  const setAvailability = useSetAvailability();
  const [zoneId, setZoneId] = useState<number | null>(vehicle.zoneId);

  // Follow the server's zone when it changes (e.g. after going online).
  useEffect(() => setZoneId(vehicle.zoneId), [vehicle.zoneId]);

  const zoneChanged = vehicle.online && zoneId !== null && zoneId !== vehicle.zoneId;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Your Tesla</p>
          <h1 className="text-xl font-semibold">
            {vehicle.displayName}{' '}
            <span className="text-sm font-normal text-slate-500">
              · {vehicle.seatCapacity} seats
            </span>
          </h1>
        </div>
        <StatusBadge
          label={vehicle.online ? `Online in ${vehicle.zoneName}` : 'Offline'}
          tone={vehicle.online ? 'success' : 'neutral'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <SelectField
            id="zone"
            label={vehicle.online ? 'Pick-up zone' : 'Go online in'}
            value={zoneId ?? ''}
            disabled={locked || setAvailability.isPending}
            onChange={(event) =>
              setZoneId(event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">Choose a zone</option>
            {zones.data?.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </SelectField>
        </div>
        {!vehicle.online && (
          <Button
            busy={setAvailability.isPending}
            disabled={locked || zoneId === null}
            onClick={() => zoneId !== null && setAvailability.mutate({ online: true, zoneId })}
          >
            Go online
          </Button>
        )}
        {vehicle.online && (
          <>
            {zoneChanged && (
              <Button
                variant="secondary"
                busy={setAvailability.isPending}
                disabled={locked}
                onClick={() => zoneId !== null && setAvailability.mutate({ online: true, zoneId })}
              >
                Move here
              </Button>
            )}
            <Button
              variant="danger"
              busy={setAvailability.isPending}
              disabled={locked}
              onClick={() => setAvailability.mutate({ online: false })}
            >
              Go offline
            </Button>
          </>
        )}
      </div>
      {locked && (
        <p className="mt-3 text-sm text-slate-500">
          Finish or cancel your active trip to change availability.
        </p>
      )}
      <div className="mt-3">
        <ActionError error={setAvailability.error} />
      </div>
    </Card>
  );
}
