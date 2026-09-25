import { Router, type RequestHandler } from 'express';
import type { ZoneDto } from '@tesla-pool/shared';
import type { ZoneDistanceMatrix } from './zone-distance-matrix';

export function createZonesRouter(zones: ZoneDistanceMatrix, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, (_req, res) => {
    const items: ZoneDto[] = zones.zones();
    res.json({ items });
  });
  return router;
}
