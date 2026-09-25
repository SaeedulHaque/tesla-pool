import type { TimelineEntryDto } from '@tesla-pool/shared';
import { formatTime } from '@/lib/format';
import { timelineLabel } from '@/lib/ride-status';

export function RideTimeline({ entries }: { entries: TimelineEntryDto[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-3" aria-label="Ride timeline">
      {entries.map((entry, index) => (
        <li key={`${entry.type}-${entry.at}-${index}`} className="flex gap-3">
          <span
            aria-hidden
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${index === entries.length - 1 ? 'bg-brand-600' : 'bg-slate-300'}`}
          />
          <div className="flex flex-1 items-baseline justify-between gap-3">
            <span className="text-sm text-slate-800">{timelineLabel(entry.type)}</span>
            <time className="text-xs tabular-nums text-slate-500" dateTime={entry.at}>
              {formatTime(entry.at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
