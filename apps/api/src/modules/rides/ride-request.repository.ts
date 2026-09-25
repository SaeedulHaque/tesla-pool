import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { ACTIVE_REQUEST_STATUSES, type RideScope } from '@tesla-pool/shared';
import { RideRequest } from './ride-request.entity';

const HISTORY_PAGE_SIZE = 50;
const QUEUE_PAGE_SIZE = 50;

export class RideRequestRepository {
  add(em: EntityManager, request: RideRequest): void {
    em.persist(request);
  }

  findById(em: EntityManager, id: string): Promise<RideRequest | null> {
    return em.findOne(RideRequest, { id });
  }

  /** `SELECT ... FOR UPDATE`, refreshed so a stale identity-map copy is never used. */
  findByIdForUpdate(em: EntityManager, id: string): Promise<RideRequest | null> {
    return em.findOne(RideRequest, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true });
  }

  findActiveForPassenger(em: EntityManager, passengerId: string): Promise<RideRequest | null> {
    return em.findOne(RideRequest, { passengerId, status: { $in: [...ACTIVE_REQUEST_STATUSES] } });
  }

  listForPassenger(
    em: EntityManager,
    passengerId: string,
    scope: RideScope,
  ): Promise<RideRequest[]> {
    if (scope === 'active') {
      return em.find(
        RideRequest,
        { passengerId, status: { $in: [...ACTIVE_REQUEST_STATUSES] } },
        { orderBy: { createdAt: 'desc' } },
      );
    }
    return em.find(
      RideRequest,
      { passengerId, status: { $in: ['COMPLETED', 'CANCELLED'] } },
      { orderBy: { createdAt: 'desc' }, limit: HISTORY_PAGE_SIZE },
    );
  }

  /** Waiting requests for a pick-up zone, oldest first, that a vehicle of `capacity` can carry. */
  findQueue(em: EntityManager, zoneId: number, capacity: number): Promise<RideRequest[]> {
    return em.find(
      RideRequest,
      { status: 'REQUESTED', pickupZoneId: zoneId, seats: { $lte: capacity } },
      { orderBy: { createdAt: 'asc', id: 'asc' }, limit: QUEUE_PAGE_SIZE },
    );
  }
}
