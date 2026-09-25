import type { RequestHandler } from 'express';
import type { TokenVerifier } from '../modules/auth/token-service';
import { UnauthenticatedError } from '../shared/domain/domain-error';

export const SESSION_COOKIE = 'tesla_session';

/** Reads the httpOnly session cookie and sets `req.auth`, or rejects with 401. */
export function createAuthenticate(tokens: TokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      next(new UnauthenticatedError());
      return;
    }
    const claims = await tokens.verify(token);
    if (!claims) {
      next(new UnauthenticatedError('Your session has expired. Sign in again.'));
      return;
    }
    req.auth = { userId: claims.userId, role: claims.role };
    next();
  };
}
