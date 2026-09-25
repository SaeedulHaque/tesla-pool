/** "2/3" as filled seat pips, with a readable label for screen readers. */
export function SeatMeter({ occupied, capacity }: { occupied: number; capacity: number }) {
  return (
    <div
      className="flex items-center gap-3"
      role="img"
      aria-label={`${occupied} of ${capacity} seats taken`}
    >
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: capacity }, (_, index) => (
          <span
            key={index}
            className={`h-6 w-6 rounded-md border-2 ${index < occupied ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-700">
        {occupied}/{capacity}
      </span>
    </div>
  );
}
