import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  AvailabilityBodySchema,
  RequestIdParamsSchema,
  type AvailabilityBody,
  type RequestIdParams,
} from '@tesla-pool/shared';
import { requireRole } from '../../http/require-role';
import { parsedParams, validateBody, validateParams } from '../../http/validate';
import type { DriverService } from './driver.service';

export function createDriverRouter(service: DriverService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('DRIVER'));

  router.put(
    '/availability',
    validateBody(AvailabilityBodySchema),
    async (req: Request, res: Response) => {
      res.json({
        vehicle: await service.setAvailability(req.auth!.userId, req.body as AvailabilityBody),
      });
    },
  );

  router.get('/queue', async (req: Request, res: Response) => {
    res.json(await service.queue(req.auth!.userId));
  });

  router.post(
    '/queue/:requestId/accept',
    validateParams(RequestIdParamsSchema),
    async (req: Request, res: Response) => {
      const { requestId } = parsedParams<RequestIdParams>(res);
      res.json({ pool: await service.accept(req.auth!.userId, requestId) });
    },
  );

  return router;
}
