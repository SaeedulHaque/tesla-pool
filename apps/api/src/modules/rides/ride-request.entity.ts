import { randomUUID } from 'node:crypto';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ACTIVE_REQUEST_STATUSES, type RideRequestStatus } from '@tesla-pool/shared';
import type { Actor } from '../../shared/domain/actor';
import { AggregateRoot } from '../../shared/domain/aggregate-root';
import type { Money } from '../../shared/domain/money';
import { EventType } from '../audit/event-types';
import { User } from '../auth/user.entity';
import { Zone } from '../geography/zone.entity';
import type { FareBreakdown } from '../pricing/fare-policy';
import { RideRequestLifecycle } from './ride-request.lifecycle';

/** Only cash for now; a `TESLA_PAY` wallet is a planned addition. */
export type PaymentMethod = 'CASH';

export interface NewRideRequest {
  passengerId: string;
  pickupZoneId: number;
  dropoffZoneId: number;
  seats: number;
  distanceM: number;
  estimatedSolo: Money;
  estimatedPooled: Money;
  pricingVersion: string;
}

/** One passenger's journey: owns its seats, distance, fare quotes and allowed transitions. */
@Entity({ tableName: 'ride_requests' })
export class RideRequest extends AggregateRoot {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne({ entity: () => User, mapToPk: true, fieldName: 'passenger_id' })
  passengerId!: string;

  @ManyToOne({ entity: () => Zone, mapToPk: true, fieldName: 'pickup_zone_id' })
  pickupZoneId!: number;

  @ManyToOne({ entity: () => Zone, mapToPk: true, fieldName: 'dropoff_zone_id' })
  dropoffZoneId!: number;

  @Property({ type: 'smallint' })
  seats!: number;

  /** Snapshot of the route distance used for pricing. */
  @Property({ type: 'number' })
  distanceM!: number;

  @Property({ type: 'string' })
  status: RideRequestStatus = 'REQUESTED';

  @Property({ type: 'number' })
  estSoloFarePaisa!: number;

  @Property({ type: 'number' })
  estPooledFarePaisa!: number;

  @Property({ type: 'number', nullable: true })
  fareBasePaisa: number | null = null;

  @Property({ type: 'number', nullable: true })
  fareDistancePaisa: number | null = null;

  @Property({ type: 'number', nullable: true })
  fareDiscountPaisa: number | null = null;

  @Property({ type: 'number', nullable: true })
  fareTotalPaisa: number | null = null;

  @Property({ type: 'string', length: 16 })
  pricingVersion!: string;

  @Property({ type: 'string' })
  paymentMethod: PaymentMethod = 'CASH';

  @Property({ type: 'Date', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', nullable: true })
  completedAt: Date | null = null;

  @Property({ type: 'Date', columnType: 'timestamptz', nullable: true })
  cancelledAt: Date | null = null;

  /** A passenger asks for a ride. Starts REQUESTED; matching happens afterwards. */
  static create(input: NewRideRequest, actor: Actor): RideRequest {
    const request = new RideRequest();
    request.passengerId = input.passengerId;
    request.pickupZoneId = input.pickupZoneId;
    request.dropoffZoneId = input.dropoffZoneId;
    request.seats = input.seats;
    request.distanceM = input.distanceM;
    request.estSoloFarePaisa = input.estimatedSolo.paisa;
    request.estPooledFarePaisa = input.estimatedPooled.paisa;
    request.pricingVersion = input.pricingVersion;
    request.record({
      type: EventType.RIDE_REQUESTED,
      rideRequestId: request.id,
      actor,
      toStatus: 'REQUESTED',
      data: {
        seats: input.seats,
        pickupZoneId: input.pickupZoneId,
        dropoffZoneId: input.dropoffZoneId,
        estimatedSoloPaisa: request.estSoloFarePaisa,
        estimatedPooledPaisa: request.estPooledFarePaisa,
      },
    });
    return request;
  }

  isActive(): boolean {
    return ACTIVE_REQUEST_STATUSES.includes(this.status);
  }

  isOwnedBy(userId: string): boolean {
    return this.passengerId === userId;
  }

  /** Admitted to a pool. Called by `Pool.admit`, never directly by services. */
  markMatched(actor: Actor, poolId: string): void {
    this.moveTo('MATCHED', EventType.REQUEST_MATCHED, actor, poolId);
  }

  /** The pool started: the fare is locked in and never changes again. */
  start(fare: FareBreakdown, actor: Actor, poolId: string): void {
    const from = this.status;
    RideRequestLifecycle.assert(from, 'IN_PROGRESS');
    this.status = 'IN_PROGRESS';
    this.fareBasePaisa = fare.base.paisa;
    this.fareDistancePaisa = fare.distance.paisa;
    this.fareDiscountPaisa = fare.discount.paisa;
    this.fareTotalPaisa = fare.total.paisa;
    this.pricingVersion = fare.version;
    this.record({
      type: EventType.REQUEST_STARTED,
      rideRequestId: this.id,
      poolId,
      actor,
      fromStatus: from,
      toStatus: 'IN_PROGRESS',
      data: {
        basePaisa: this.fareBasePaisa,
        distancePaisa: this.fareDistancePaisa,
        discountPaisa: this.fareDiscountPaisa,
        totalPaisa: this.fareTotalPaisa,
        pricingVersion: fare.version,
      },
    });
  }

  /** Dropped off at the destination. */
  complete(actor: Actor, poolId: string): void {
    this.moveTo('COMPLETED', EventType.REQUEST_COMPLETED, actor, poolId);
    this.completedAt = new Date();
  }

  /** Passenger cancels (REQUESTED or MATCHED only). */
  cancel(actor: Actor, poolId: string | null = null): void {
    this.moveTo('CANCELLED', EventType.REQUEST_CANCELLED, actor, poolId);
    this.cancelledAt = new Date();
  }

  /** The driver cancelled the pool: the passenger did nothing wrong, so they wait in the queue again. */
  requeue(actor: Actor, poolId: string): void {
    this.moveTo('REQUESTED', EventType.REQUEST_REQUEUED, actor, poolId, {
      reason: 'DRIVER_CANCELLED',
    });
  }

  private moveTo(
    to: RideRequestStatus,
    type: EventType,
    actor: Actor,
    poolId: string | null,
    data: Record<string, unknown> = {},
  ): void {
    const from = this.status;
    RideRequestLifecycle.assert(from, to);
    this.status = to;
    this.record({
      type,
      rideRequestId: this.id,
      poolId,
      actor,
      fromStatus: from,
      toStatus: to,
      data,
    });
  }
}
