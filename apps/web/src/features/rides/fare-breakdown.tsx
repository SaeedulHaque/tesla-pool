import type { RideDto } from '@tesla-pool/shared';
import { formatBDT } from '@/lib/format';

/** The passenger's own fare: an estimate until the trip starts, then the locked-in breakdown. */
export function FareBreakdown({ fare }: { fare: RideDto['fare'] }) {
  if (!fare.final) {
    return (
      <div>
        <p className="text-sm text-slate-600">
          Estimated{' '}
          <span className="font-semibold text-slate-900">
            {formatBDT(fare.estimatedPooledPaisa)}
          </span>{' '}
          if shared,{' '}
          <span className="font-semibold text-slate-900">{formatBDT(fare.estimatedSoloPaisa)}</span>{' '}
          if alone.
        </p>
        <p className="mt-1 text-xs text-slate-500">The final fare is fixed when the trip starts.</p>
      </div>
    );
  }
  const { basePaisa, distancePaisa, discountPaisa, totalPaisa } = fare.final;
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-600">Base fare</dt>
        <dd className="tabular-nums">{formatBDT(basePaisa)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-600">Distance</dt>
        <dd className="tabular-nums">{formatBDT(distancePaisa)}</dd>
      </div>
      {discountPaisa > 0 && (
        <div className="flex justify-between text-emerald-700">
          <dt>Pool discount</dt>
          <dd className="tabular-nums">−{formatBDT(discountPaisa)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
        <dt>You pay (cash)</dt>
        <dd className="tabular-nums">{formatBDT(totalPaisa)}</dd>
      </div>
    </dl>
  );
}
