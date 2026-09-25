import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { isUnauthenticated, messageForCode, messageForError } from '@/lib/error-messages';

describe('error messages', () => {
  it('explains a lost seat in plain words', () => {
    expect(messageForCode('POOL_FULL')).toBe(
      "That seat just went to someone else. You're still in the queue.",
    );
  });

  it('has wording for every error code the API can return to a screen', () => {
    for (const code of [
      'POOL_FULL',
      'POOL_NOT_JOINABLE',
      'INCOMPATIBLE_REQUEST',
      'ACTIVE_RIDE_EXISTS',
      'ACTIVE_POOL_EXISTS',
      'DRIVER_OFFLINE',
      'INVALID_TRANSITION',
      'NOT_FOUND',
      'UNAUTHENTICATED',
      'INVALID_CREDENTIALS',
      'PHONE_ALREADY_REGISTERED',
      'FORBIDDEN',
      'RATE_LIMITED',
      'VALIDATION_FAILED',
      'NETWORK',
      'INTERNAL',
    ]) {
      expect(messageForCode(code)).not.toBe('Something went wrong. Please try again.');
    }
  });

  it('never leaks server internals for unknown codes', () => {
    const error = new ApiError(500, 'WEIRD', 'stack trace at line 42');
    expect(messageForError(error)).toBe('Something went wrong. Please try again.');
  });

  it('shows validation messages, which come from the shared schemas', () => {
    expect(messageForError(new ApiError(400, 'VALIDATION_FAILED', 'seats: A Tesla seats 3'))).toBe(
      'seats: A Tesla seats 3',
    );
  });

  it('handles non-API errors', () => {
    expect(messageForError(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });

  it('detects expired sessions', () => {
    expect(isUnauthenticated(new ApiError(401, 'UNAUTHENTICATED', 'x'))).toBe(true);
    expect(isUnauthenticated(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(false);
  });
});
