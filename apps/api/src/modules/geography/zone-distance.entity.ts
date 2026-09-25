import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { Zone } from './zone.entity';

/** Reference data, stored in both directions (A→B and B→A). */
@Entity({ tableName: 'zone_distances' })
export class ZoneDistance {
  @ManyToOne({ entity: () => Zone, primary: true, mapToPk: true, fieldName: 'from_zone_id' })
  fromZoneId!: number;

  @ManyToOne({ entity: () => Zone, primary: true, mapToPk: true, fieldName: 'to_zone_id' })
  toZoneId!: number;

  @Property({ type: 'number' })
  distanceM!: number;

  constructor(fromZoneId: number, toZoneId: number, distanceM: number) {
    this.fromZoneId = fromZoneId;
    this.toZoneId = toZoneId;
    this.distanceM = distanceM;
  }
}
