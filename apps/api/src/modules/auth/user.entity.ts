import { randomUUID } from 'node:crypto';
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import type { UserRole } from '@tesla-pool/shared';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'string', length: 80 })
  fullName!: string;

  /** Login id, E.164: +8801800000001 */
  @Property({ type: 'string', length: 14, unique: true })
  phone!: string;

  @Property({ type: 'text' })
  passwordHash!: string;

  @Property({ type: 'string' })
  role!: UserRole;

  @Property({ type: 'Date', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  constructor(fullName: string, phone: string, passwordHash: string, role: UserRole) {
    this.fullName = fullName;
    this.phone = phone;
    this.passwordHash = passwordHash;
    this.role = role;
  }

  isPassenger(): boolean {
    return this.role === 'PASSENGER';
  }

  isDriver(): boolean {
    return this.role === 'DRIVER';
  }
}
