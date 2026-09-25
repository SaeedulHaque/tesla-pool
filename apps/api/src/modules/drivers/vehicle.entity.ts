import { randomUUID } from 'node:crypto';
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { User } from '../auth/user.entity';
import { Zone } from '../geography/zone.entity';

@Entity({ tableName: 'vehicles' })
export class Vehicle {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  /** One vehicle per driver in the MVP (UNIQUE in the schema). */
  @ManyToOne({ entity: () => User, mapToPk: true, fieldName: 'driver_id' })
  driverId!: string;

  /** 'Bullet' */
  @Property({ type: 'string', length: 40 })
  displayName!: string;

  @Property({ type: 'string', length: 20, unique: true })
  plateNumber!: string;

  @Property({ type: 'smallint' })
  seatCapacity!: number;

  @Property({ type: 'boolean' })
  isOnline: boolean = false;

  @ManyToOne({ entity: () => Zone, mapToPk: true, fieldName: 'current_zone_id', nullable: true })
  currentZoneId: number | null = null;

  @Property({ type: 'Date', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(driverId: string, displayName: string, plateNumber: string, seatCapacity: number) {
    this.driverId = driverId;
    this.displayName = displayName;
    this.plateNumber = plateNumber;
    this.seatCapacity = seatCapacity;
  }
}
