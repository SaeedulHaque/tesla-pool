'use client';

import { useState } from 'react';
import { MAX_SEATS_PER_REQUEST, TripSchema, type RideDto } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ActionError, ErrorState } from '@/components/ui/error-state';
import { SelectField } from '@/components/ui/field';
import { LoadingState } from '@/components/ui/loading-state';
import { FareEstimate } from './fare-estimate';
import { useRequestRide, useZones } from './hooks';

export function RequestRideForm({ onRequested }: { onRequested: (ride: RideDto) => void }) {
  const zones = useZones();
  const requestRide = useRequestRide();
  const [pickup, setPickup] = useState<number | null>(null);
  const [dropoff, setDropoff] = useState<number | null>(null);
  const [seats, setSeats] = useState(1);

  if (zones.isPending) return <LoadingState label="Loading zones" rows={2} />;
  if (zones.isError) return <ErrorState error={zones.error} onRetry={() => zones.refetch()} />;

  const validation = TripSchema.safeParse({ pickupZoneId: pickup, dropoffZoneId: dropoff, seats });
  const sameZone = pickup !== null && pickup === dropoff;
  const pickNumber = (value: string) => (value === '' ? null : Number(value));

  return (
    <Card>
      <CardTitle>Where to?</CardTitle>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!validation.success) return;
          requestRide.mutate(validation.data, { onSuccess: onRequested });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="pickup"
            label="Pick-up zone"
            value={pickup ?? ''}
            onChange={(event) => setPickup(pickNumber(event.target.value))}
          >
            <option value="">Choose a zone</option>
            {zones.data.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="dropoff"
            label="Drop-off zone"
            value={dropoff ?? ''}
            error={sameZone ? 'Pick-up and drop-off must be different zones' : undefined}
            onChange={(event) => setDropoff(pickNumber(event.target.value))}
          >
            <option value="">Choose a zone</option>
            {zones.data.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </SelectField>
        </div>

        <SelectField
          id="seats"
          label="Seats"
          value={seats}
          onChange={(event) => setSeats(Number(event.target.value))}
        >
          {Array.from({ length: MAX_SEATS_PER_REQUEST }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count} {count === 1 ? 'seat' : 'seats'}
            </option>
          ))}
        </SelectField>

        <FareEstimate
          pickupZoneId={pickup}
          dropoffZoneId={sameZone ? null : dropoff}
          seats={seats}
        />

        <ActionError error={requestRide.error} />
        <Button
          type="submit"
          className="w-full"
          busy={requestRide.isPending}
          disabled={!validation.success}
        >
          Request a Tesla
        </Button>
      </form>
    </Card>
  );
}
