import { randomUUID } from 'node:crypto';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { RideRequest } from '../rides/ride-request.entity';
import { Pool } from './pool.entity';

export type LeaveReason = 'PASSENGER_CANCELLED' | 'DRIVER_CANCELLED';

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
}
