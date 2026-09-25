import { randomUUID } from 'node:crypto';
import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import type { PoolStatus } from '@tesla-pool/shared';
import { User } from '../auth/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { Zone } from '../geography/zone.entity';
import { PoolMembership } from './pool-membership.entity';

@Entity({ tableName: 'pools' })
export class Pool {
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
}
