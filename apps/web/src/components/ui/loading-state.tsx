'use client';

import { useEffect, useState } from 'react';

const SLOW_AFTER_MS = 5_000;

/** Skeleton while loading; after 5 s explains why (the free host sleeps when idle). */
export function LoadingState({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-200/70" />
      ))}
      {slow && (
        <p className="text-center text-sm text-slate-500">
          Waking up the server… this can take a minute.
        </p>
      )}
    </div>
  );
}
