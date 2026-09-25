import type { CreateRideRequestBody, RideDto, RideScope } from '@tesla-pool/shared';
import { AuditTrail } from '../audit/audit-trail';
import { Actor } from '../../shared/domain/actor';
import { ActiveRideExistsError, NotFoundError } from '../../shared/domain/domain-error';
import { Money } from '../../shared/domain/money';
import type { Transactor } from '../../shared/transactor';
import type { DistanceProvider } from '../geography/distance-provider';
import type { ZoneDistanceMatrix } from '../geography/zone-distance-matrix';
import type { FarePolicy } from '../pricing/fare-policy';
import type { RideQueries } from './ride.queries';
import { RideRequest } from './ride-request.entity';
import type { RideRequestRepository } from './ride-request.repository';

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
          estimatedSolo: Money.ofPaisa(solo.total.paisa),
          estimatedPooled: Money.ofPaisa(pooled.total.paisa),
          pricingVersion: this.farePolicy.version,
        },
        Actor.user(passengerId),
      );
      this.rides.add(em, request);
      this.audit.persist(em, request);
      await em.flush(); // surfaces uq_active_request_per_passenger before anything is locked

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

  async cancel(passengerId: string, requestId: string): Promise<RideDto> {
    return this.transactor.run(async (em) => {
      const request = await this.rides.findByIdForUpdate(em, requestId);
      if (!request || !request.isOwnedBy(passengerId)) throw new NotFoundError('Ride');
      request.cancel(Actor.user(passengerId));
      this.audit.persist(em, request);
      await em.flush();
      const [view] = await this.queries.passengerViews(em, [request], { timeline: true });
      return view;
    });
  }
}
