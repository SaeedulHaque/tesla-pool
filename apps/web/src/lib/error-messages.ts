import { ApiError } from './api-client';

/** One place that turns API error codes into words a person can act on. */
const MESSAGES: Record<string, string> = {
  POOL_FULL: "That seat just went to someone else. You're still in the queue.",
  POOL_NOT_JOINABLE: 'That trip has already started, so nobody else can join it.',
  INCOMPATIBLE_REQUEST:
    "That request doesn't fit this trip: its drop-off is too far from your other riders.",
  ACTIVE_RIDE_EXISTS: 'You already have an active ride. Finish or cancel it first.',
  ACTIVE_POOL_EXISTS: 'Finish or cancel your active trip first.',
  DRIVER_OFFLINE: 'Go online in a zone first.',
  INVALID_TRANSITION: 'That is no longer possible: things just changed. Check the latest status.',
  NOT_FOUND: "We couldn't find that. It may have been cancelled or taken.",
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'Phone number or password is incorrect.',
  PHONE_ALREADY_REGISTERED: 'That phone number is already registered. Try signing in.',
  FORBIDDEN: "You don't have access to that.",
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
  VALIDATION_FAILED: 'Please check the details you entered.',
  NETWORK: "Can't reach the server. Check your connection and try again.",
  UPSTREAM_UNAVAILABLE: 'The server is waking up. Give it a moment and try again.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export function messageForCode(code: string): string {
  return MESSAGES[code] ?? FALLBACK;
}

export function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    // Validation messages come from the same schemas the forms use, so they are already readable.
    if (error.code === 'VALIDATION_FAILED' && error.message) return error.message;
    return messageForCode(error.code);
  }
  return FALLBACK;
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'UNAUTHENTICATED';
}
