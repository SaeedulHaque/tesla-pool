import { randomUUID } from 'node:crypto';
import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { type PoolStatus } from '@tesla-pool/shared';
import type { Actor } from '../../shared/domain/actor';
import { AggregateRoot } from '../../shared/domain/aggregate-root';
import {
  IncompatibleRequestError,
  InvalidTransitionError,
  NotFoundError,
  PoolFullError,
  PoolNotJoinableError,
} from '../../shared/domain/domain-error';
import { EventType } from '../audit/event-types';
import { User } from '../auth/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { Zone } from '../geography/zone.entity';
import type { FarePolicy } from '../pricing/fare-policy';
import type { RideRequest } from '../rides/ride-request.entity';
import type { PoolCompatibilityPolicy } from './pool-compatibility-policy';
import { PoolLifecycle } from './pool.lifecycle';
import { PoolMembership, type LeaveReason } from './pool-membership.entity';

/**
 * Aggregate root for one Tesla trip. It owns `seatsOccupied` and decides who may join;
 * changes to its own status cascade to its members. Methods never touch the EntityManager.
 */
@Entity({ tableName: 'pools' })
export class Pool extends AggregateRoot {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne({ entity: () => Vehicle, mapToPk: true, fieldName: 'vehicle_id' })
  vehicleId!: string;

  /** Snapshot of who drove this trip. */
  @ManyToOne({ entity: () => User, mapToPk: true, fieldName: 'driver_id' })
  driverId!: string;

  @ManyToOne({ entity: () => Zone, mapToPk: true, fieldName: 'pickup_zone_id' })
  pickupZoneId!: number;

  @Property({ type: 'string' })
  status: PoolStatus = 'ACCEPTED';

  /** Snapshot of the vehicle's capacity. */
  @Property({ type: 'smallint' })
  seatCapacity!: number;

  @Property({ type: 'smallint' })
  seatsOccupied: number = 0;

  @Property({ type: 'Date', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany({ entity: () => PoolMembership, mappedBy: 'pool' })
  memberships = new Collection<PoolMembership>(this);

  /** A driver starts a trip at `pickupZoneId`. The pool is empty until the first request is admitted. */
  static open(vehicle: Vehicle, pickupZoneId: number, actor: Actor): Pool {
    const pool = new Pool();
    pool.vehicleId = vehicle.id;
    pool.driverId = vehicle.driverId;
    pool.pickupZoneId = pickupZoneId;
    pool.seatCapacity = vehicle.seatCapacity;
    pool.record({
      type: EventType.POOL_CREATED,
      poolId: pool.id,
      actor,
      toStatus: 'ACCEPTED',
      data: { vehicleId: vehicle.id, seatCapacity: vehicle.seatCapacity },
    });
    return pool;
  }

  isOwnedBy(driverId: string): boolean {
    return this.driverId === driverId;
  }

  /** Members still in the pool (not cancelled out). Requires `memberships.rideRequest` to be loaded. */
  activeMemberships(): PoolMembership[] {
    return this.memberships.getItems().filter((membership) => membership.isActive());
  }

  activeRequests(): RideRequest[] {
    return this.activeMemberships().map((membership) => membership.rideRequest);
  }

  isJoinable(): boolean {
    return this.status === 'ACCEPTED' || this.status === 'DRIVER_ARRIVED';
  }

  seatsLeft(): number {
    return this.seatCapacity - this.seatsOccupied;
  }

  hasRoomFor(seats: number): boolean {
    return this.seatsOccupied + seats <= this.seatCapacity;
  }

  canAdmit(request: RideRequest, policy: PoolCompatibilityPolicy): boolean {
    return this.isJoinable() && this.hasRoomFor(request.seats) && policy.accepts(this, request);
  }

  /**
   * Both entry paths (passenger auto-join and driver accept) end here, with the policy passed in
   * rather than checked by callers first, so the rules can never diverge. Call this only on a
   * pool loaded under `SELECT ... FOR UPDATE`.
   */
  admit(request: RideRequest, policy: PoolCompatibilityPolicy, actor: Actor): void {
    if (!this.isJoinable()) throw new PoolNotJoinableError(this.id, this.status);
    if (!this.hasRoomFor(request.seats)) throw new PoolFullError(this.id, this.seatsLeft());
    if (!policy.accepts(this, request)) throw new IncompatibleRequestError(this.id, request.id);

    request.markMatched(actor, this.id); // guarded by RideRequestLifecycle
    this.seatsOccupied += request.seats;
    this.memberships.add(PoolMembership.open(this, request));
    this.record({
      type: EventType.PASSENGER_JOINED,
      poolId: this.id,
      rideRequestId: request.id,
      actor,
      data: { seats: request.seats, seatsOccupied: this.seatsOccupied },
    });
  }

  /** The driver reached the pick-up zone. New riders may still join. */
  arrive(actor: Actor): void {
    this.moveTo('DRIVER_ARRIVED', EventType.DRIVER_ARRIVED, actor);
  }

  /**
   * Locks membership and every rider's fare. Pooled means at least two active requests right now:
   * a rider whose co-rider cancelled earlier pays the solo fare, and nothing changes it afterwards.
   */
  start(actor: Actor, farePolicy: FarePolicy): void {
    const riders = this.activeRequests();
    if (riders.length === 0) throw new InvalidTransitionError('Pool', this.status, 'STARTED');
    const from = this.status;
    PoolLifecycle.assert(from, 'STARTED');

    const pooled = riders.length >= 2;
    for (const rider of riders) {
      const fare = farePolicy.quote({ distanceM: rider.distanceM, seats: rider.seats, pooled });
      rider.start(fare, actor, this.id);
    }
    this.status = 'STARTED';
    this.record({
      type: EventType.POOL_STARTED,
      poolId: this.id,
      actor,
      fromStatus: from,
      toStatus: 'STARTED',
      data: {
        pooled,
        riders: riders.length,
        seatsOccupied: this.seatsOccupied,
        pricingVersion: farePolicy.version,
      },
    });
  }

  /** One rider reaches their destination. The last drop-off completes the pool. */
  dropOff(requestId: string, actor: Actor): void {
    const membership = this.activeMemberships().find((m) => m.rideRequest.id === requestId);
    if (!membership) throw new NotFoundError('Pool member');
    membership.rideRequest.complete(actor, this.id); // guarded: only IN_PROGRESS riders can be dropped off

    if (this.activeRequests().every((rider) => rider.status === 'COMPLETED')) {
      this.moveTo('COMPLETED', EventType.POOL_COMPLETED, actor);
    }
  }

  /**
   * The driver cancels the whole trip. Riders did nothing wrong, so they go back to REQUESTED
   * (not CANCELLED) and their membership records why they left. They are not re-matched here.
   */
  cancelByDriver(actor: Actor): void {
    const riders = this.activeMemberships();
    this.moveTo('CANCELLED', EventType.POOL_CANCELLED, actor, {
      reason: 'DRIVER_CANCELLED',
      requeuedRiders: riders.length,
    });
    const reason: LeaveReason = 'DRIVER_CANCELLED';
    for (const membership of riders) {
      membership.leave(reason);
      membership.rideRequest.requeue(actor, this.id);
    }
    this.seatsOccupied = 0;
  }

  /** A passenger cancels. Frees their seats; if they were the last rider, the pool cancels itself. */
  removeMember(request: RideRequest, actor: Actor): void {
    const membership = this.activeMemberships().find((m) => m.rideRequest.id === request.id);
    if (!membership) throw new NotFoundError('Pool member');
    request.cancel(actor, this.id); // guarded: not once the trip has started

    membership.leave('PASSENGER_CANCELLED');
    this.seatsOccupied -= request.seats;
    this.record({
      type: EventType.PASSENGER_LEFT,
      poolId: this.id,
      rideRequestId: request.id,
      actor,
      data: {
        seats: request.seats,
        seatsOccupied: this.seatsOccupied,
        reason: 'PASSENGER_CANCELLED',
      },
    });
    if (this.activeMemberships().length === 0) {
      this.moveTo('CANCELLED', EventType.POOL_CANCELLED, actor, { reason: 'LAST_MEMBER_LEFT' });
    }
  }

  private moveTo(
    to: PoolStatus,
    type: EventType,
    actor: Actor,
    data: Record<string, unknown> = {},
  ): void {
    const from = this.status;
    PoolLifecycle.assert(from, to);
    this.status = to;
    this.record({ type, poolId: this.id, actor, fromStatus: from, toStatus: to, data });
  }
}
