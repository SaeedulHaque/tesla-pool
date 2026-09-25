import { randomUUID } from 'node:crypto';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import type { RideRequestStatus } from '@tesla-pool/shared';
import { User } from '../auth/user.entity';
import { Zone } from '../geography/zone.entity';

@Entity({ tableName: 'ride_requests' })
export class RideRequest {
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
  paymentMethod: 'CASH' = 'CASH';

  @Property({ type: 'Date', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'Date', columnType: 'timestamptz', nullable: true })
  completedAt: Date | null = null;

  @Property({ type: 'Date', columnType: 'timestamptz', nullable: true })
  cancelledAt: Date | null = null;
}
