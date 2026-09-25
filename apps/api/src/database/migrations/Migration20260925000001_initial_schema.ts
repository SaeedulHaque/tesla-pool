import { Migration } from '@mikro-orm/migrations';

/** Section 8 of DESIGN.md, verbatim. Hand-written: constraints are the point of this schema. */
const STATEMENTS: string[] = [
  `CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     varchar(80) NOT NULL,
  phone         varchar(14) NOT NULL UNIQUE,              -- login id, E.164: +8801800000001
  password_hash text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('PASSENGER','DRIVER')),
  created_at    timestamptz NOT NULL DEFAULT now()
)`,

  `CREATE TABLE zones (
  id        smallint PRIMARY KEY,
  code      varchar(24)  NOT NULL UNIQUE,                  -- 'BANANI'
  name      varchar(40)  NOT NULL,
  latitude  numeric(8,5) NOT NULL,
  longitude numeric(8,5) NOT NULL
)`,

  `CREATE TABLE zone_distances (
  from_zone_id smallint NOT NULL REFERENCES zones(id),
  to_zone_id   smallint NOT NULL REFERENCES zones(id),
  distance_m   integer  NOT NULL CHECK (distance_m > 0),
  PRIMARY KEY (from_zone_id, to_zone_id),
  CHECK (from_zone_id <> to_zone_id)
)`,

  `CREATE TABLE vehicles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid        NOT NULL UNIQUE REFERENCES users(id),
  display_name    varchar(40) NOT NULL,                    -- 'Bullet'
  plate_number    varchar(20) NOT NULL UNIQUE,
  seat_capacity   smallint    NOT NULL CHECK (seat_capacity BETWEEN 1 AND 6),
  is_online       boolean     NOT NULL DEFAULT false,
  current_zone_id smallint    REFERENCES zones(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_online OR current_zone_id IS NOT NULL)
)`,

  `CREATE TABLE ride_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id          uuid     NOT NULL REFERENCES users(id),
  pickup_zone_id        smallint NOT NULL REFERENCES zones(id),
  dropoff_zone_id       smallint NOT NULL REFERENCES zones(id),
  seats                 smallint NOT NULL CHECK (seats BETWEEN 1 AND 6),
  distance_m            integer  NOT NULL CHECK (distance_m > 0),   -- snapshot used for pricing
  status                text     NOT NULL DEFAULT 'REQUESTED'
                        CHECK (status IN ('REQUESTED','MATCHED','IN_PROGRESS','COMPLETED','CANCELLED')),
  est_solo_fare_paisa   integer  NOT NULL CHECK (est_solo_fare_paisa > 0),
  est_pooled_fare_paisa integer  NOT NULL CHECK (est_pooled_fare_paisa > 0),
  fare_base_paisa       integer,
  fare_distance_paisa   integer,
  fare_discount_paisa   integer,
  fare_total_paisa      integer,
  pricing_version       varchar(16) NOT NULL,
  payment_method        text NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  CHECK (pickup_zone_id <> dropoff_zone_id),
  CHECK (num_nulls(fare_base_paisa, fare_distance_paisa, fare_discount_paisa, fare_total_paisa) IN (0, 4)),
  CHECK (fare_total_paisa = fare_base_paisa + fare_distance_paisa - fare_discount_paisa),
  CHECK (status NOT IN ('IN_PROGRESS','COMPLETED') OR fare_total_paisa IS NOT NULL),
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
)`,

  `CREATE TABLE pools (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     uuid     NOT NULL REFERENCES vehicles(id),
  driver_id      uuid     NOT NULL REFERENCES users(id),  -- snapshot of who drove this trip
  pickup_zone_id smallint NOT NULL REFERENCES zones(id),
  status         text     NOT NULL DEFAULT 'ACCEPTED'
                 CHECK (status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED','COMPLETED','CANCELLED')),
  seat_capacity  smallint NOT NULL,                        -- snapshot of vehicle capacity
  seats_occupied smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (seats_occupied BETWEEN 0 AND seat_capacity)       -- the overbooking backstop
)`,

  `CREATE TABLE pool_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         uuid NOT NULL REFERENCES pools(id),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  left_at         timestamptz,
  leave_reason    text CHECK (leave_reason IN ('PASSENGER_CANCELLED','DRIVER_CANCELLED')),
  UNIQUE (pool_id, ride_request_id),
  CHECK ((left_at IS NULL) = (leave_reason IS NULL))
)`,

  `CREATE TABLE ride_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_request_id uuid REFERENCES ride_requests(id),
  pool_id         uuid REFERENCES pools(id),
  actor_user_id   uuid REFERENCES users(id),               -- NULL means system
  type            varchar(40) NOT NULL,                    -- PASSENGER_JOINED, POOL_STARTED, ...
  from_status     varchar(20),
  to_status       varchar(20),
  data            jsonb NOT NULL DEFAULT '{}',             -- fare breakdown, seats after, reason
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ride_request_id IS NOT NULL OR pool_id IS NOT NULL)
)`,

  // integrity
  `CREATE UNIQUE INDEX uq_active_request_per_passenger ON ride_requests (passenger_id)
  WHERE status IN ('REQUESTED','MATCHED','IN_PROGRESS')`,
  `CREATE UNIQUE INDEX uq_active_pool_per_vehicle ON pools (vehicle_id)
  WHERE status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED')`,
  `CREATE UNIQUE INDEX uq_active_membership_per_request ON pool_memberships (ride_request_id)
  WHERE left_at IS NULL`,

  // access paths (Postgres does not index foreign keys automatically)
  `CREATE INDEX ix_requests_queue      ON ride_requests (pickup_zone_id, created_at) WHERE status = 'REQUESTED'`,
  `CREATE INDEX ix_requests_passenger  ON ride_requests (passenger_id, created_at DESC)`,
  `CREATE INDEX ix_pools_joinable      ON pools (pickup_zone_id, created_at) WHERE status IN ('ACCEPTED','DRIVER_ARRIVED')`,
  `CREATE INDEX ix_pools_driver        ON pools (driver_id, created_at DESC)`,
  `CREATE INDEX ix_memberships_active  ON pool_memberships (pool_id) WHERE left_at IS NULL`,
  `CREATE INDEX ix_events_request      ON ride_events (ride_request_id, occurred_at)`,
  `CREATE INDEX ix_events_pool         ON ride_events (pool_id, occurred_at)`,
  `CREATE INDEX ix_vehicles_online     ON vehicles (current_zone_id) WHERE is_online`,
];

export class Migration20260925000001_initial_schema extends Migration {
  override async up(): Promise<void> {
    for (const statement of STATEMENTS) this.addSql(statement);
  }

  override async down(): Promise<void> {
    for (const table of [
      'ride_events',
      'pool_memberships',
      'pools',
      'ride_requests',
      'vehicles',
      'zone_distances',
      'zones',
      'users',
    ]) {
      this.addSql(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
