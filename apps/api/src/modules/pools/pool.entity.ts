import { randomUUID } from 'node:crypto';
import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { type PoolStatus } from '@tesla-pool/shared';
import type { Actor } from '../../shared/domain/actor';
import { AggregateRoot } from '../../shared/domain/aggregate-root';
import {
  IncompatibleRequestError,
  PoolFullError,
  PoolNotJoinableError,
} from '../../shared/domain/domain-error';
import { EventType } from '../audit/event-types';
import { User } from '../auth/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { Zone } from '../geography/zone.entity';
import type { RideRequest } from '../rides/ride-request.entity';
import type { PoolCompatibilityPolicy } from './pool-compatibility-policy';
import { PoolMembership } from './pool-membership.entity';

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
}
