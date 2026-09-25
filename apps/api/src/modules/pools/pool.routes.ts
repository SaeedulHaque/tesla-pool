import { Router, type Request, type RequestHandler, type Response } from 'express';
import { ScopeQuerySchema, type ScopeQuery } from '@tesla-pool/shared';
import { requireRole } from '../../http/require-role';
import { parsedQuery, validateQuery } from '../../http/validate';
import type { PoolService } from './pool.service';

export function createPoolRouter(service: PoolService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('DRIVER'));

  router.get('/', validateQuery(ScopeQuerySchema), async (req: Request, res: Response) => {
    const { scope } = parsedQuery<ScopeQuery>(res);
    res.json({ items: await service.list(req.auth!.userId, scope) });
  });

  return router;
}
