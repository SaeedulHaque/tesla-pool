import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  CreateRideRequestBodySchema,
  IdParamsSchema,
  ScopeQuerySchema,
  type CreateRideRequestBody,
  type IdParams,
  type ScopeQuery,
} from '@tesla-pool/shared';
import { requireRole } from '../../http/require-role';
import {
  parsedParams,
  parsedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../http/validate';
import type { RideService } from './ride.service';

export function createRideRouter(service: RideService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('PASSENGER'));

  router.post(
    '/',
    validateBody(CreateRideRequestBodySchema),
    async (req: Request, res: Response) => {
      const ride = await service.request(req.auth!.userId, req.body as CreateRideRequestBody);
      res.status(201).json({ ride });
    },
  );

  router.get('/', validateQuery(ScopeQuerySchema), async (req: Request, res: Response) => {
    const { scope } = parsedQuery<ScopeQuery>(res);
    res.json({ items: await service.list(req.auth!.userId, scope) });
  });

  router.get('/:id', validateParams(IdParamsSchema), async (req: Request, res: Response) => {
    const { id } = parsedParams<IdParams>(res);
    res.json({ ride: await service.get(req.auth!.userId, id) });
  });

  router.post(
    '/:id/cancel',
    validateParams(IdParamsSchema),
    async (req: Request, res: Response) => {
      const { id } = parsedParams<IdParams>(res);
      res.json({ ride: await service.cancel(req.auth!.userId, id) });
    },
  );

  return router;
}
