import type { RequestHandler } from 'express';
import type { UserRole } from '@tesla-pool/shared';
import { ForbiddenError, UnauthenticatedError } from '../shared/domain/domain-error';

/** Coarse role gate; services still check ownership of every resource. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
