'use client';

import { ApiError } from '@/lib/api-client';
import { messageForError } from '@/lib/error-messages';
import { Button } from './button';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <p className="font-medium text-red-900">{messageForError(error)}</p>
      {requestId && <p className="mt-1 text-xs text-red-700/80">Reference: {requestId}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline message for a failed action (accept, cancel, submit): shows exactly what the server said. */
export function ActionError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {messageForError(error)}
    </p>
  );
}

/** Same look as ActionError for a message that is already worded. */
export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}
