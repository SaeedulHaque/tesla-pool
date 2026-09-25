import { randomUUID } from 'node:crypto';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { RideRequest } from '../rides/ride-request.entity';
import { Pool } from './pool.entity';

export type LeaveReason = 'PASSENGER_CANCELLED' | 'DRIVER_CANCELLED';

/** Who was in which pool, when they joined and why they left. */
@Entity({ tableName: 'pool_memberships' })
export class PoolMembership {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne({ entity: () => Pool, fieldName: 'pool_id' })
  pool!: Pool;

  @ManyToOne({ entity: () => RideRequest, fieldName: 'ride_request_id' })
  rideRequest!: RideRequest;

  @Property({ type: 'Date', columnType: 'timestamptz' })
  joinedAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', nullable: true })
  leftAt: Date | null = null;

  @Property({ type: 'string', nullable: true })
  leaveReason: LeaveReason | null = null;

  static open(pool: Pool, rideRequest: RideRequest): PoolMembership {
    const membership = new PoolMembership();
    membership.pool = pool;
    membership.rideRequest = rideRequest;
    return membership;
  }

  isActive(): boolean {
    return this.leftAt === null;
  }

  leave(reason: LeaveReason): void {
    this.leftAt = new Date();
    this.leaveReason = reason;
  }
}
