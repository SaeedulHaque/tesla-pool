import { Router, type RequestHandler, type Response } from 'express';
import { FareEstimateQuerySchema, type FareEstimateQuery } from '@tesla-pool/shared';
import { requireRole } from '../../http/require-role';
import { parsedQuery, validateQuery } from '../../http/validate';
import type { FareEstimateService } from './fare-estimate.service';

export function createFareEstimatesRouter(
  service: FareEstimateService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get(
    '/',
    authenticate,
    requireRole('PASSENGER'),
    validateQuery(FareEstimateQuerySchema),
    (_req, res: Response) => {
      res.json({ estimate: service.estimate(parsedQuery<FareEstimateQuery>(res)) });
    },
  );
  return router;
}
