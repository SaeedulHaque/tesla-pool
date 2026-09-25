import type { CreateRideRequestBody, RideDto, RideScope } from '@tesla-pool/shared';
import { type AuditTrail } from '../audit/audit-trail';
import { Actor } from '../../shared/domain/actor';
import {
  ActiveRideExistsError,
  DomainError,
  NotFoundError,
} from '../../shared/domain/domain-error';
import type { Transactor } from '../../shared/transactor';
import type { DistanceProvider } from '../geography/distance-provider';
import type { ZoneDistanceMatrix } from '../geography/zone-distance-matrix';
import type { FarePolicy } from '../pricing/fare-policy';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PoolMembership } from '../pools/pool-membership.entity';
import type { PoolRepository } from '../pools/pool.repository';
import type { PoolMatcher } from '../pools/pool-matcher';
import type { RideQueries } from './ride.queries';
import { RideRequest } from './ride-request.entity';
import type { RideRequestRepository } from './ride-request.repository';

const CANCEL_ATTEMPTS = 3;
/**
 * Returned by `tryCancel` when the ride changed between the unlocked peek and the locks (it was
 * admitted to a pool, or the driver cancelled the pool). The whole use case then runs again in a
 * fresh transaction, which keeps the lock order vehicle -> pool -> request intact.
 */
const RETRY = Symbol('retry');

type Zones = Pick<ZoneDistanceMatrix, 'requireZone'> & DistanceProvider;

/** Passenger use cases. Every public method is exactly one transaction. */
export class RideService {
  constructor(
    private readonly transactor: Transactor,
    private readonly rides: RideRequestRepository,
    private readonly zones: Zones,
    private readonly farePolicy: FarePolicy,
    private readonly audit: AuditTrail,
    private readonly queries: RideQueries,
    private readonly matcher: PoolMatcher,
    private readonly pools: PoolRepository,
  ) {}

  async request(passengerId: string, trip: CreateRideRequestBody): Promise<RideDto> {
    const pickup = this.zones.requireZone(trip.pickupZoneId);
    const dropoff = this.zones.requireZone(trip.dropoffZoneId);
    const distanceM = this.zones.distanceM(pickup.id, dropoff.id);
    const solo = this.farePolicy.quote({ distanceM, seats: trip.seats, pooled: false });
    const pooled = this.farePolicy.quote({ distanceM, seats: trip.seats, pooled: true });

    return this.transactor.run(async (em) => {
      // Friendly early answer; the partial unique index is the real guard against a double submit.
      if (await this.rides.findActiveForPassenger(em, passengerId))
        throw new ActiveRideExistsError();

      const request = RideRequest.create(
        {
          passengerId,
          pickupZoneId: pickup.id,
          dropoffZoneId: dropoff.id,
          seats: trip.seats,
          distanceM,
          estimatedSolo: solo.total,
          estimatedPooled: pooled.total,
          pricingVersion: this.farePolicy.version,
        },
        Actor.user(passengerId),
      );
      this.rides.add(em, request);
      this.audit.persist(em, request);
      await em.flush(); // surfaces uq_active_request_per_passenger before anything is locked

      // Join a qualifying pool in this same transaction, under that pool's row lock.
      const pool = await this.matcher.tryAutoJoin(em, request);
      if (pool) {
        this.audit.persist(em, pool, request);
        await em.flush();
      }

      const [view] = await this.queries.passengerViews(em, [request]);
      return view;
    });
  }

  async list(passengerId: string, scope: RideScope): Promise<RideDto[]> {
    return this.transactor.run(async (em) => {
      const requests = await this.rides.listForPassenger(em, passengerId, scope);
      return this.queries.passengerViews(em, requests);
    });
  }

  /** Someone else's ride and a ride that does not exist look identical: 404. */
  async get(passengerId: string, requestId: string): Promise<RideDto> {
    return this.transactor.run(async (em) => {
      const request = await this.rides.findById(em, requestId);
      if (!request || !request.isOwnedBy(passengerId)) throw new NotFoundError('Ride');
      const [view] = await this.queries.passengerViews(em, [request], { timeline: true });
      return view;
    });
  }

  /**
   * Cancels REQUESTED or MATCHED rides. A MATCHED ride must lock its pool before its own row
   * (lock order: vehicle, pool, request), so the first read is only a peek: after locking, the
   * ride is re-checked, and if something moved in between (admitted, or the driver cancelled the
   * pool) the whole use case is retried in a new transaction.
   */
  async cancel(passengerId: string, requestId: string): Promise<RideDto> {
    for (let attempt = 1; attempt <= CANCEL_ATTEMPTS; attempt += 1) {
      const outcome = await this.transactor.run((em) => this.tryCancel(em, passengerId, requestId));
      if (outcome !== RETRY) return outcome;
    }
    throw new DomainError(
      'CONFLICT',
      'That ride changed while you were cancelling. Please try again.',
    );
  }

  private async tryCancel(
    em: EntityManager,
    passengerId: string,
    requestId: string,
  ): Promise<RideDto | typeof RETRY> {
    const peek = await this.rides.findById(em, requestId);
    if (!peek || !peek.isOwnedBy(passengerId)) throw new NotFoundError('Ride');
    const actor = Actor.user(passengerId);

    const membership =
      peek.status === 'MATCHED'
        ? await em.findOne(
            PoolMembership,
            { rideRequest: peek.id, leftAt: null },
            { populate: ['pool'] },
          )
        : null;

    if (membership) {
      const pool = await this.pools.findByIdForUpdate(em, membership.pool.id);
      const request = await this.rides.findByIdForUpdate(em, requestId);
      const stillMember = pool?.activeMemberships().some((m) => m.rideRequest.id === requestId);
      if (!pool || !request || request.status !== 'MATCHED' || !stillMember) return RETRY;

      pool.removeMember(request, actor);
      this.audit.persist(em, pool, request);
      await em.flush();
      const [view] = await this.queries.passengerViews(em, [request], { timeline: true });
      return view;
    }

    const request = await this.rides.findByIdForUpdate(em, requestId);
    if (!request) throw new NotFoundError('Ride');
    if (request.status === 'MATCHED') return RETRY; // admitted to a pool after the peek
    request.cancel(actor); // 409 INVALID_TRANSITION unless still REQUESTED
    this.audit.persist(em, request);
    await em.flush();
    const [view] = await this.queries.passengerViews(em, [request], { timeline: true });
    return view;
  }
}
