import { Router, type Request, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  LoginBodySchema,
  RegisterBodySchema,
  type LoginBody,
  type RegisterBody,
} from '@tesla-pool/shared';
import { SESSION_COOKIE } from '../../http/authenticate';
import { validateBody } from '../../http/validate';
import { RateLimitedError } from '../../shared/domain/domain-error';
import type { AuthService } from './auth.service';

export interface AuthRouterOptions {
  service: AuthService;
  authenticate: RequestHandler;
  cookie: { secure: boolean; maxAgeMs: number };
  rateLimit: { max: number; windowMinutes: number };
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const { service, authenticate, cookie } = options;
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: options.rateLimit.windowMinutes * 60_000,
    limit: options.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitedError()),
  });

  const setSessionCookie = (res: Response, token: string): void => {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookie.secure,
      maxAge: cookie.maxAgeMs,
      path: '/',
    });
  };

  router.post(
    '/register',
    authLimiter,
    validateBody(RegisterBodySchema),
    async (req: Request, res: Response) => {
      const { user, token } = await service.register(req.body as RegisterBody);
      setSessionCookie(res, token);
      res.status(201).json({ user });
    },
  );

  router.post(
    '/login',
    authLimiter,
    validateBody(LoginBodySchema),
    async (req: Request, res: Response) => {
      const { user, token } = await service.login(req.body as LoginBody);
      setSessionCookie(res, token);
      res.json({ user });
    },
  );

  router.post('/logout', authenticate, (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookie.secure,
      path: '/',
    });
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req: Request, res: Response) => {
    res.json({ user: await service.me(req.auth!.userId) });
  });

  return router;
}
