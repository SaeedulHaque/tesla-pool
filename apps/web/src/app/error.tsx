'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t reach the server</h1>
      <p className="mt-2 text-sm text-slate-600">
        It may be waking up after a quiet spell. Give it a moment.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
