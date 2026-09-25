import type { EntityManager } from '@mikro-orm/postgresql';
import type {
  AvailabilityBody,
  DriverPoolDto,
  DriverQueueDto,
  QueueItemDto,
  VehicleDto,
} from '@tesla-pool/shared';
import { Actor } from '../../shared/domain/actor';
import {
  ActivePoolExistsError,
  DriverOfflineError,
  NotFoundError,
} from '../../shared/domain/domain-error';
import type { Transactor } from '../../shared/transactor';
import { AuditTrail } from '../audit/audit-trail';
import { User } from '../auth/user.entity';
import type { ZoneDistanceMatrix } from '../geography/zone-distance-matrix';
import type { PoolCompatibilityPolicy } from '../pools/pool-compatibility-policy';
import { Pool } from '../pools/pool.entity';
import type { PoolQueries } from '../pools/pool.queries';
import type { PoolRepository } from '../pools/pool.repository';
import type { RideRequestRepository } from '../rides/ride-request.repository';
import type { Vehicle } from './vehicle.entity';
import type { VehicleRepository } from './vehicle.repository';

/** Driver use cases: availability, the request queue and accepting a request. One transaction each. */
export class DriverService {
  constructor(
    private readonly transactor: Transactor,
    private readonly vehicles: VehicleRepository,
    private readonly pools: PoolRepository,
    private readonly rides: RideRequestRepository,
    private readonly zones: Pick<ZoneDistanceMatrix, 'requireZone'>,
    private readonly compatibility: PoolCompatibilityPolicy,
    private readonly audit: AuditTrail,
    private readonly poolQueries: PoolQueries,
  ) {}

  async setAvailability(driverId: string, input: AvailabilityBody): Promise<VehicleDto> {
    return this.transactor.run(async (em) => {
      const vehicle = await this.requireVehicleForUpdate(em, driverId);
      if (await this.pools.findActiveForVehicle(em, vehicle.id)) {
        throw new ActivePoolExistsError(
          'Finish or cancel your active trip before changing availability.',
        );
      }
      if (input.online) vehicle.goOnline(this.zones.requireZone(input.zoneId as number).id);
      else vehicle.goOffline();
      await em.flush();
      return this.toVehicleDto(vehicle);
    });
  }

  async queue(driverId: string): Promise<DriverQueueDto> {
    return this.transactor.run(async (em) => {
      const vehicle = await this.vehicles.findByDriver(em, driverId);
      if (!vehicle) throw new NotFoundError('Vehicle');
      const dto = this.toVehicleDto(vehicle);
      if (!vehicle.isOnline || vehicle.currentZoneId === null) return { vehicle: dto, items: [] };

      const [requests, activePool] = await Promise.all([
        this.rides.findQueue(em, vehicle.currentZoneId, vehicle.seatCapacity),
        this.pools.findActiveForVehicle(em, vehicle.id),
      ]);
      const passengers = requests.length
        ? await em.find(User, {
            id: { $in: [...new Set(requests.map((request) => request.passengerId))] },
          })
        : [];
      const passengerName = new Map(passengers.map((user) => [user.id, user.fullName]));

      const items: QueueItemDto[] = requests.map((request) => ({
        id: request.id,
        passengerName: passengerName.get(request.passengerId) ?? 'Passenger',
        pickup: this.zones.requireZone(request.pickupZoneId).name,
        dropoff: this.zones.requireZone(request.dropoffZoneId).name,
        seats: request.seats,
        distanceM: request.distanceM,
        createdAt: request.createdAt.toISOString(),
        fitsActivePool: activePool?.canAdmit(request, this.compatibility) ?? false,
      }));
      return { vehicle: dto, items };
    });
  }

  /** Creates a new pool for the driver's Tesla, or admits the request into the active one. */
  async accept(driverId: string, requestId: string): Promise<DriverPoolDto> {
    return this.transactor.run(async (em) => {
      // Lock order, always: vehicle, then pool, then request.
      const vehicle = await this.requireVehicleForUpdate(em, driverId);
      if (!vehicle.isOnline || vehicle.currentZoneId === null) throw new DriverOfflineError();

      const activePool = await this.pools.findActiveForVehicleForUpdate(em, vehicle.id);
      const request = await this.rides.findByIdForUpdate(em, requestId);
      // Not in this driver's queue (unknown, other zone, too many seats): indistinguishable from missing.
      if (
        !request ||
        request.pickupZoneId !== vehicle.currentZoneId ||
        !vehicle.canCarry(request.seats)
      ) {
        throw new NotFoundError('Ride request');
      }

      const actor = Actor.user(driverId);
      let pool = activePool;
      if (!pool) {
        pool = Pool.open(vehicle, vehicle.currentZoneId, actor);
        this.pools.add(em, pool);
      }
      pool.admit(request, this.compatibility, actor);
      this.audit.persist(em, pool, request);
      await em.flush();

      const [view] = await this.poolQueries.driverViews(em, [pool]);
      return view;
    });
  }

  private async requireVehicleForUpdate(em: EntityManager, driverId: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.findByDriverForUpdate(em, driverId);
    if (!vehicle) throw new NotFoundError('Vehicle');
    return vehicle;
  }

  private toVehicleDto(vehicle: Vehicle): VehicleDto {
    const zone =
      vehicle.currentZoneId === null ? undefined : this.zones.requireZone(vehicle.currentZoneId);
    return {
      id: vehicle.id,
      displayName: vehicle.displayName,
      seatCapacity: vehicle.seatCapacity,
      online: vehicle.isOnline,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
    };
  }
}
