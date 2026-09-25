import type { MikroORM } from '@mikro-orm/postgresql';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { buildApp } from './app';
import type { Env } from './config/env';
import { DriverService } from './modules/drivers/driver.service';
import { createDriverRouter } from './modules/drivers/driver.routes';
import { VehicleRepository } from './modules/drivers/vehicle.repository';
import { DistanceCompatibilityPolicy } from './modules/pools/pool-compatibility-policy';
import { PoolPresenter } from './modules/pools/pool.presenter';
import { PoolQueries } from './modules/pools/pool.queries';
import { PoolRepository } from './modules/pools/pool.repository';
import { createPoolRouter } from './modules/pools/pool.routes';
import { PoolService } from './modules/pools/pool.service';
import { AuditTrail } from './modules/audit/audit-trail';
import { RideQueries } from './modules/rides/ride.queries';
import { RidePresenter } from './modules/rides/ride.presenter';
import { createRideRouter } from './modules/rides/ride.routes';
import { RideService } from './modules/rides/ride.service';
import { RideRequestRepository } from './modules/rides/ride-request.repository';
import { createAuthenticate } from './http/authenticate';
import { Argon2PasswordHasher, type PasswordHasher } from './modules/auth/password-hasher';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { TokenService } from './modules/auth/token-service';
import { MikroOrmUserRepository } from './modules/auth/user.repository';
import { createZonesRouter } from './modules/geography/zones.routes';
import { ZoneDistanceMatrix } from './modules/geography/zone-distance-matrix';
import { FareEstimateService } from './modules/pricing/fare-estimate.service';
import { createFareEstimatesRouter } from './modules/pricing/fare-estimates.routes';
import { StandardFarePolicy } from './modules/pricing/standard-fare-policy';
import { MikroOrmTransactor } from './shared/transactor';

export interface Overrides {
  hasher?: PasswordHasher;
}

/** Builds every service once with constructor injection; tests can pass fakes instead. */
export async function composeApp(
  orm: MikroORM,
  env: Env,
  logger: Logger,
  overrides: Overrides = {},
): Promise<Express> {
  const transactor = new MikroOrmTransactor(orm);
  const tokens = new TokenService(env.JWT_SECRET, env.JWT_TTL_HOURS);
  const authenticate = createAuthenticate(tokens);

  // Reference data is immutable at runtime: load it once.
  const zones = await ZoneDistanceMatrix.load(orm.em.fork());
  const farePolicy = new StandardFarePolicy();
  const audit = new AuditTrail();

  const ridePresenter = new RidePresenter({ nameOf: (id) => zones.requireZone(id).name });
  const compatibility = new DistanceCompatibilityPolicy(zones);
  const poolRepository = new PoolRepository();
  const poolQueries = new PoolQueries(
    new PoolPresenter({ nameOf: (id) => zones.requireZone(id).name }),
  );
  const rideRepository = new RideRequestRepository();
  const driverService = new DriverService(
    transactor,
    new VehicleRepository(),
    poolRepository,
    rideRepository,
    zones,
    compatibility,
    audit,
    poolQueries,
  );
  const poolService = new PoolService(transactor, poolRepository, poolQueries);
  const rideService = new RideService(
    transactor,
    rideRepository,
    zones,
    farePolicy,
    audit,
    new RideQueries(ridePresenter),
  );

  const authService = new AuthService(
    transactor,
    new MikroOrmUserRepository(),
    overrides.hasher ?? new Argon2PasswordHasher(),
    tokens,
  );

  return buildApp({
    env,
    logger,
    database: {
      ping: async () => {
        await orm.em.getConnection().execute('select 1');
      },
    },
    routers: {
      driver: createDriverRouter(driverService, authenticate),
      pools: createPoolRouter(poolService, authenticate),
      rideRequests: createRideRouter(rideService, authenticate),
      zones: createZonesRouter(zones, authenticate),
      fareEstimates: createFareEstimatesRouter(
        new FareEstimateService(zones, farePolicy),
        authenticate,
      ),
      auth: createAuthRouter({
        service: authService,
        authenticate,
        cookie: { secure: env.COOKIE_SECURE, maxAgeMs: tokens.maxAgeMs },
        rateLimit: {
          max: env.AUTH_RATE_LIMIT_MAX,
          windowMinutes: env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
        },
      }),
    },
  });
}
