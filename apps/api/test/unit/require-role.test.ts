import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireRole } from '../../src/http/require-role';
import { ForbiddenError, UnauthenticatedError } from '../../src/shared/domain/domain-error';

function run(auth: Request['auth']) {
  const next = vi.fn() as unknown as NextFunction;
  requireRole('DRIVER')({ auth } as Request, {} as Response, next);
  return vi.mocked(next);
}

describe('requireRole', () => {
  it('lets a matching role through', () => {
    expect(run({ userId: 'u', role: 'DRIVER' })).toHaveBeenCalledWith();
  });

  it('answers Forbidden for the wrong role', () => {
    expect(run({ userId: 'u', role: 'PASSENGER' }).mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  it('answers Unauthenticated when nobody is signed in', () => {
    expect(run(undefined).mock.calls[0][0]).toBeInstanceOf(UnauthenticatedError);
  });
});
