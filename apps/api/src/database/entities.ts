import { RideEvent } from '../modules/audit/ride-event.entity';
import { User } from '../modules/auth/user.entity';
import { Vehicle } from '../modules/drivers/vehicle.entity';
import { Zone } from '../modules/geography/zone.entity';
import { ZoneDistance } from '../modules/geography/zone-distance.entity';
import { PoolMembership } from '../modules/pools/pool-membership.entity';
import { Pool } from '../modules/pools/pool.entity';
import { RideRequest } from '../modules/rides/ride-request.entity';

// Every mapped entity, in one place.
export const ALL_ENTITIES = [
  User,
  Zone,
  ZoneDistance,
  Vehicle,
  RideRequest,
  Pool,
  PoolMembership,
  RideEvent,
];
