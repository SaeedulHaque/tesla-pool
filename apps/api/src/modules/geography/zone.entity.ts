import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'zones' })
export class Zone {
  @PrimaryKey({ type: 'smallint', autoincrement: false })
  id!: number;

  /** Stable machine name, e.g. 'BANANI'. */
  @Property({ type: 'string', length: 24, unique: true })
  code!: string;

  @Property({ type: 'string', length: 40 })
  name!: string;

  @Property({ type: 'string', columnType: 'numeric(8,5)' })
  latitude!: string;

  @Property({ type: 'string', columnType: 'numeric(8,5)' })
  longitude!: string;

  constructor(id: number, code: string, name: string, latitude: string, longitude: string) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
  }
}
