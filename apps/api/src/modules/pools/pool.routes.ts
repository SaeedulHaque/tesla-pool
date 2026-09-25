import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  PoolIdParamsSchema,
  PoolMemberParamsSchema,
  ScopeQuerySchema,
  type PoolIdParams,
  type PoolMemberParams,
  type ScopeQuery,
} from '@tesla-pool/shared';
import { requireRole } from '../../http/require-role';
import { parsedParams, parsedQuery, validateParams, validateQuery } from '../../http/validate';
import type { PoolService } from './pool.service';

/** Each state change is its own action endpoint, never a generic PATCH { status }. */
export function createPoolRouter(service: PoolService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('DRIVER'));

  router.get('/', validateQuery(ScopeQuerySchema), async (req: Request, res: Response) => {
    const { scope } = parsedQuery<ScopeQuery>(res);
    res.json({ items: await service.list(req.auth!.userId, scope) });
  });

  router.post(
    '/:id/arrive',
    validateParams(PoolIdParamsSchema),
    async (req: Request, res: Response) => {
      const { id } = parsedParams<PoolIdParams>(res);
      res.json({ pool: await service.arrive(req.auth!.userId, id) });
    },
  );

  router.post(
    '/:id/start',
    validateParams(PoolIdParamsSchema),
    async (req: Request, res: Response) => {
      const { id } = parsedParams<PoolIdParams>(res);
      res.json({ pool: await service.start(req.auth!.userId, id) });
    },
  );

  router.post(
    '/:id/members/:requestId/drop-off',
    validateParams(PoolMemberParamsSchema),
    async (req: Request, res: Response) => {
      const { id, requestId } = parsedParams<PoolMemberParams>(res);
      res.json({ pool: await service.dropOff(req.auth!.userId, id, requestId) });
    },
  );

  router.post(
    '/:id/cancel',
    validateParams(PoolIdParamsSchema),
    async (req: Request, res: Response) => {
      const { id } = parsedParams<PoolIdParams>(res);
      res.json({ pool: await service.cancel(req.auth!.userId, id) });
    },
  );

  return router;
}
