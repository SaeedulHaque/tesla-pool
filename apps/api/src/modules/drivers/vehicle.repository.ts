import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Vehicle } from './vehicle.entity';

export class VehicleRepository {
  findByDriver(em: EntityManager, driverId: string): Promise<Vehicle | null> {
    return em.findOne(Vehicle, { driverId });
  }

  /**
   * Every driver-side use case locks the vehicle first. That serialises a driver's own actions
   * (a double-clicked accept cannot create two pools) and fixes the lock order: vehicle, pool, request.
   */
  findByDriverForUpdate(em: EntityManager, driverId: string): Promise<Vehicle | null> {
    return em.findOne(
      Vehicle,
      { driverId },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
  }
}
