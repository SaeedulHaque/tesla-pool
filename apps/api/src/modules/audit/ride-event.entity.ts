import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import type { DomainEvent } from '../../shared/domain/aggregate-root';
import { User } from '../auth/user.entity';
import { Pool } from '../pools/pool.entity';
import { RideRequest } from '../rides/ride-request.entity';

/** Append-only history, written in the same transaction as the change it describes. */
@Entity({ tableName: 'ride_events' })
export class RideEvent {
  /** `bigint GENERATED ALWAYS AS IDENTITY`: assigned by the database, surfaced as a string. */
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne({
    entity: () => RideRequest,
    mapToPk: true,
    fieldName: 'ride_request_id',
    nullable: true,
  })
  rideRequestId: string | null = null;

  @ManyToOne({ entity: () => Pool, mapToPk: true, fieldName: 'pool_id', nullable: true })
  poolId: string | null = null;

  /** NULL means the system acted. */
  @ManyToOne({ entity: () => User, mapToPk: true, fieldName: 'actor_user_id', nullable: true })
  actorUserId: string | null = null;

  @Property({ type: 'string', length: 40 })
  type!: string;

  @Property({ type: 'string', length: 20, nullable: true })
  fromStatus: string | null = null;

  @Property({ type: 'string', length: 20, nullable: true })
  toStatus: string | null = null;

  @Property({ type: 'json', columnType: 'jsonb' })
  data: Record<string, unknown> = {};

  @Property({ type: 'Date', columnType: 'timestamptz' })
  occurredAt: Date = new Date();

  static from(event: DomainEvent): RideEvent {
    const row = new RideEvent();
    row.rideRequestId = event.rideRequestId;
    row.poolId = event.poolId;
    row.actorUserId = event.actor.userId;
    row.type = event.type;
    row.fromStatus = event.fromStatus;
    row.toStatus = event.toStatus;
    row.data = { ...event.data };
    row.occurredAt = event.occurredAt;
    return row;
  }
}
