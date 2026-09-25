# Dhaka Tesla Pool

A ride-pooling MVP for Dhaka. Passengers request a ride between fixed zones; compatible
requests share a three-wheeled "Tesla" (a CNG-style auto-rickshaw) driven by an independent
driver. Each passenger sees only their own fare and status, and the system keeps a full history
of what happened.

- Build specification: [`DESIGN.md`](DESIGN.md) (architecture, schema, API, build order).
- Demo video: **not recorded yet.** The 6-minute walkthrough (0-1 min pitch, 1-3 min live pooling
  story, 3-6 min code and concurrency) still needs to be recorded and linked here.
- Live deployment: **not deployed yet.** See [Deployment](#deployment) for the Vercel + Render + Neon
  recipe; `docker compose up` is the reproducible fallback and is what was tested.

## Problem statement

Getting across Dhaka in a CNG costs the same whether one person or three ride in it. Oi Tesla
lets riders heading the same way share a vehicle and split the cost, while:

1. **Bullet's capacity can never be exceeded**, even when two passengers claim the last seat in
   the same instant.
2. **Invalid state changes are rejected** (start before the driver arrives, cancel after the trip
   started, and so on).
3. **Pooled fares are computed correctly** and locked once the trip starts.
4. **Nobody can see or change another person's ride.**
5. **Every change leaves an audit trail.**

## Features

- Passenger sign-up / sign-in (phone number + password), httpOnly session cookie.
- Live fare estimate (alone vs shared) before requesting.
- Auto-join: a new request is admitted straight into a qualifying pool under that pool's row lock.
- Driver dashboard: go online in a zone, request queue (flagged with "fits your trip"), accept,
  seat meter, arrive / start / drop off / cancel.
- Fares locked at trip start; pool discount only applies if at least two riders are aboard then.
- Driver cancels a trip: riders return to the queue as `REQUESTED` (they keep their place).
- Passenger cancels: seat freed, membership closed, empty pool cancels itself.
- Append-only `ride_events` history written in the same transaction as every change.
- Polling UI (4 s for the active ride, 5 s for the driver), loading / error / empty / data states
  everywhere, and a "Waking up the server…" hint for sleepy free hosting.

## Screenshots

The full Nusrat, Rafiq and Shirin story, captured by [`scripts/e2e-story.mjs`](scripts/e2e-story.mjs)
against the Docker stack:

|                                                                                                                                        |                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ![Fare estimate](docs/screenshots/02-passenger-request-with-fare-estimate.png) Nusrat sees the shared and solo fare before requesting. | ![Driver queue](docs/screenshots/04-driver-queue-with-request.png) Jashim sees the request in the Banani queue. |
| ![3/3](docs/screenshots/07-driver-pool-3-of-3.png) Bullet is 3/3: Rafiq and Shirin auto-joined.                                        | ![Locked fare](docs/screenshots/09-passenger-fare-locked.png) Trip started: Nusrat's fare is locked at ৳72.00.  |
| ![Rafiq](docs/screenshots/10-passenger-rafiq-own-fare.png) Rafiq sees only his own ৳58.00.                                             | ![Driver trips](docs/screenshots/13-driver-trip-history.png) Trip history with members and fares.               |

## Architecture

```mermaid
flowchart LR
  B["Browser"]
  subgraph WEB["web container: Next.js App Router"]
    UI["Pages and components"]
    PX["/api/* proxy route handler"]
  end
  subgraph API["api container: Express 5"]
    MW["Middleware: request id, auth, zod validation, rate limit"]
    CT["Controllers"]
    SV["Application services (one use case = one transaction)"]
    DM["Domain: entities, policies, state machines"]
    RP["Repositories (MikroORM EntityManager)"]
  end
  DB[("PostgreSQL")]
  MG["migrate job: migrations + seed"]

  B -->|"pages"| UI
  B -->|"fetch /api/*, httpOnly cookie"| PX
  PX -->|"HTTP on internal network"| MW
  MW --> CT --> SV --> DM
  SV --> RP --> DB
  MG --> DB
```

Source: [`docs/architecture.mmd`](docs/architecture.mmd). The browser only ever talks to Next.js; a
catch-all route handler (`apps/web/src/app/api/[...path]/route.ts`) forwards `/api/*` to Express over
the internal network and passes the cookie through, so the cookie stays first-party and CORS never
comes up. `API_INTERNAL_URL` is read at request time, so one image runs anywhere.

Inside the API: routes → application services → domain. Each service method is one transaction;
entities hold behaviour (`Pool.admit`, `RideRequest.cancel`) and never touch the `EntityManager`.

### Data model (ERD)

```mermaid
erDiagram
  USERS ||--o| VEHICLES : "drives"
  USERS ||--o{ RIDE_REQUESTS : "requests"
  USERS ||--o{ POOLS : "drove"
  VEHICLES ||--o{ POOLS : "runs"
  ZONES ||--o{ RIDE_REQUESTS : "pickup, dropoff"
  ZONES ||--o{ POOLS : "pickup"
  ZONES ||--o{ ZONE_DISTANCES : "from, to"
  POOLS ||--o{ POOL_MEMBERSHIPS : "has"
  RIDE_REQUESTS ||--o{ POOL_MEMBERSHIPS : "joins"
  RIDE_REQUESTS ||--o{ RIDE_EVENTS : "history"
  POOLS ||--o{ RIDE_EVENTS : "history"
  USERS ||--o{ RIDE_EVENTS : "acted"
```

Source: [`docs/erd.mmd`](docs/erd.mmd). The migration
([`Migration20260925000001_initial_schema.ts`](apps/api/src/database/migrations/Migration20260925000001_initial_schema.ts))
is the SQL from `DESIGN.md` section 8, verbatim.

### Lifecycles

A passenger's journey (`RideRequest`) and a Tesla's trip (`Pool`) are separate state machines,
each a single transition table (`ride-request.lifecycle.ts`, `pool.lifecycle.ts`). Any transition
not in the table is rejected with `409 INVALID_TRANSITION`.

```
RideRequest: REQUESTED -> MATCHED -> IN_PROGRESS -> COMPLETED
             REQUESTED|MATCHED -> CANCELLED      MATCHED -> REQUESTED (driver cancelled the pool)
Pool:        ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
             ACCEPTED|DRIVER_ARRIVED -> CANCELLED
```

### How the last seat is protected

Three layers, in order of authority (`DESIGN.md` section 7):

1. **Row lock.** Every use case that changes pool membership opens a transaction and loads the
   pool with `SELECT … FOR UPDATE` before reading its seat count. Lock order is always
   vehicle → pool → request; candidate pools are locked in `(created_at, id)` order.
2. **Domain check.** `Pool.admit()` re-validates against the freshly locked row.
3. **Database backstop.** `CHECK (seats_occupied BETWEEN 0 AND seat_capacity)`, plus partial
   unique indexes (one active request per passenger, one active pool per vehicle, one active
   membership per request).

## Tech stack

TypeScript everywhere · Express 5 · MikroORM 6 on PostgreSQL 17 · Zod (shared schemas) · argon2id +
`jose` JWT in an httpOnly cookie · pino · Next.js 15 App Router · TanStack Query · Tailwind CSS ·
Vitest + Supertest against a real Postgres · Docker Compose · GitHub Actions. Reasoning and
"switch when" notes are in `DESIGN.md` section 13.

## Project structure

```
apps/api/src
  app.ts, composition-root.ts, main.ts     bootstrap and constructor wiring
  config/env.ts                            zod-validated environment (fails fast)
  http/                                    request id, authenticate, require-role, validate, error handler
  shared/domain/                           StateMachine, DomainError, AggregateRoot, Money, Actor
  modules/
    auth/        User, PasswordHasher, TokenService, AuthService, routes
    geography/   Zone, ZoneDistanceMatrix (DistanceProvider)
    pricing/     FarePolicy, StandardFarePolicy, estimates
    rides/       RideRequest (+ lifecycle), passenger use cases, RidePresenter
    pools/       Pool, PoolMembership, PoolMatcher, compatibility policy, driver trip use cases
    drivers/     Vehicle, availability, queue, accept
    audit/       RideEvent, AuditTrail
  database/      mikro-orm config, migrations, seeders, migrate-and-seed entrypoint
apps/api/test    unit/ (pure domain) and integration/ (HTTP against real Postgres)
apps/web/src     app/ (routes), features/{auth,rides,driver}, components/ui, lib/
packages/shared  Zod schemas, DTO types and status enums used by both apps
docs/            Mermaid sources and screenshots
scripts/         e2e-story.mjs (browser walkthrough)
```

## Getting started

### Prerequisites

Docker with Compose v2 (for the one-command path), or Node.js 22+ and a PostgreSQL 17 to run
things by hand.

### Run everything with Docker

```bash
docker compose up --build
```

That starts `db` → `migrate` (migrations + seed, then exits) → `api` → `web`, with no manual steps.
It works out of the box because Compose loads `.env.example` first and an optional `.env`
after it, so a `.env` (created with `cp .env.example .env`) only needs the values you change.
Then open <http://localhost:3000>. The API is also exposed on <http://localhost:4000>
(`/health/live`, `/health/ready`).

The `.env.example` secrets are placeholders for local use. Set a real `JWT_SECRET` (32+ random
characters) anywhere that is not your laptop.

### Environment variables

| Variable                                                                    | Purpose                                                    | Default in `.env.example`                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`                         | Postgres container                                         | `tesla`, `change-me`, `tesla_pool`                |
| `DATABASE_URL`                                                              | API connection string                                      | `postgresql://tesla:change-me@db:5432/tesla_pool` |
| `DATABASE_SSL`                                                              | `true` for hosted Postgres such as Neon                    | `false`                                           |
| `API_PORT`                                                                  | API port                                                   | `4000`                                            |
| `JWT_SECRET`                                                                | HS256 signing secret, at least 32 characters               | placeholder                                       |
| `JWT_TTL_HOURS`                                                             | Session lifetime                                           | `12`                                              |
| `COOKIE_SECURE`                                                             | `true` behind HTTPS                                        | `false`                                           |
| `LOG_LEVEL`                                                                 | pino level                                                 | `info`                                            |
| `API_INTERNAL_URL`                                                          | Where the web proxy reaches the API (read at request time) | `http://api:4000`                                 |
| `SEED_DEMO_PASSWORD`                                                        | Password of every demo account                             | `pool-demo-123`                                   |
| `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MINUTES`, `TRUST_PROXY_HOPS` | Auth rate limiting (optional)                              | `20`, `15`, `1`                                   |

### Without Docker

```bash
npm install
npm run build:shared
# Point at any Postgres 17 (the Compose `db` service does not publish a port):
export DATABASE_URL=postgresql://tesla:change-me@localhost:5432/tesla_pool
export JWT_SECRET=replace-with-at-least-32-random-characters
npm run build -w @tesla-pool/api && npm run migrate -w @tesla-pool/api   # migrations + seed
npm run dev:api                                                         # http://localhost:4000
API_INTERNAL_URL=http://localhost:4000 npm run dev:web                  # http://localhost:3000
```

### Migrations and seed data

`node dist/database/migrate-and-seed.js` (the `migrate` Compose service, or
`npm run migrate -w @tesla-pool/api`) applies pending migrations, then seeds. It runs from compiled
JS via MikroORM's Migrator and Seeder APIs, so the runtime image needs no CLI or dev dependencies.
Seeding **upserts** by zone code and phone number: re-running never duplicates rows, and it never
resets a driver's live online state. Pass `--skip-seed` to migrate only.

Seed contents: 9 zones and their symmetric distance table, the five cast members and two
vehicles, and one completed pooled ride from "yesterday" (so history screens are not empty).
**No active rides exist at boot**, so a live demo starts clean.

**Zones and distances** (metres in `zone_distances`; estimates, round numbers):

| Zone pair               | km   | Zone pair               | km   |
| ----------------------- | ---- | ----------------------- | ---- |
| Banani – Mohakhali      | 3.0  | Banani – Gulshan 1      | 2.0  |
| Gulshan 1 – Mohakhali   | 2.5  | Banani – Gulshan 2      | 1.5  |
| Banani – Farmgate       | 4.0  | Banani – Dhanmondi      | 6.5  |
| Banani – Mirpur 10      | 6.0  | Banani – Uttara         | 9.0  |
| Banani – Bashundhara    | 5.0  | Gulshan 1 – Gulshan 2   | 1.5  |
| Gulshan 1 – Farmgate    | 5.0  | Gulshan 1 – Dhanmondi   | 7.5  |
| Gulshan 1 – Mirpur 10   | 8.0  | Gulshan 1 – Uttara      | 10.5 |
| Gulshan 1 – Bashundhara | 3.5  | Gulshan 2 – Mohakhali   | 3.0  |
| Gulshan 2 – Farmgate    | 5.0  | Gulshan 2 – Dhanmondi   | 7.5  |
| Gulshan 2 – Mirpur 10   | 7.5  | Gulshan 2 – Uttara      | 9.5  |
| Gulshan 2 – Bashundhara | 3.0  | Mohakhali – Farmgate    | 2.5  |
| Mohakhali – Dhanmondi   | 5.0  | Mohakhali – Mirpur 10   | 5.5  |
| Mohakhali – Uttara      | 10.0 | Mohakhali – Bashundhara | 6.0  |
| Farmgate – Dhanmondi    | 2.5  | Farmgate – Mirpur 10    | 6.0  |
| Farmgate – Uttara       | 11.5 | Farmgate – Bashundhara  | 8.5  |
| Dhanmondi – Mirpur 10   | 7.5  | Dhanmondi – Uttara      | 13.0 |
| Dhanmondi – Bashundhara | 10.0 | Mirpur 10 – Uttara      | 9.5  |
| Mirpur 10 – Bashundhara | 10.5 | Uttara – Bashundhara    | 9.0  |

The source of truth is [`reference-data.ts`](apps/api/src/database/seeders/reference-data.ts).

### Demo credentials

Every demo account uses the password `pool-demo-123` (`SEED_DEMO_PASSWORD`). Sign in with the
phone number (`01800000001` and `+8801800000001` are the same).

| Person | Role      | Phone       | Notes                                           |
| ------ | --------- | ----------- | ----------------------------------------------- |
| Jashim | Driver    | 01800000001 | Owns **Bullet**, a 3-seat Tesla                 |
| Kamal  | Driver    | 01800000002 | Owns **Toofan**, a 3-seat Tesla, starts offline |
| Nusrat | Passenger | 01800000003 | Banani → Mohakhali                              |
| Rafiq  | Passenger | 01800000004 | Banani → Gulshan 1                              |
| Shirin | Passenger | 01800000005 | Banani → Mohakhali (last seat / overflow case)  |

**Try the story** (use separate browser profiles or private windows so the cookies do not clash):
Jashim goes online at Banani → Nusrat requests Banani → Mohakhali → Jashim accepts her (1/3) →
Rafiq requests Banani → Gulshan 1 and Shirin requests Banani → Mohakhali; both auto-join (3/3) →
Jashim marks arrival, starts the trip (Nusrat ৳72.00, Rafiq ৳58.00), drops everyone off.
Have Shirin ask for 2 seats instead and she stays in the queue: Bullet is never overbooked.

### Running the tests

```bash
npm run db:test:up          # throwaway Postgres on :5433 (Compose profile "test", RAM-backed)
npm run test:unit           # pure domain, fare policy, state machines, auth, web presentation mapping
npm run test:integration    # HTTP against the real database, including the concurrency suite
npm test                    # both
CONCURRENCY_RUNS=200 npm run test:integration   # push the last-seat race harder (default 50)
npm run lint && npm run typecheck
```

Integration tests build the schema from the real migrations on every run. They need a real
Postgres because the guarantees under test are Postgres locks and constraints; a fake would pass
things the real system fails. `TEST_DATABASE_URL` overrides the default
`postgresql://tesla:change-me@localhost:5433/tesla_pool_test`.

What is covered (see `DESIGN.md` section 12):

| Requirement                                 | Where                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capacity can never be exceeded              | `pool.test.ts`; `driver-flow.test.ts` (409 `POOL_FULL`); `capacity.test.ts` (raw `UPDATE pools SET seats_occupied = 4` fails the CHECK)                |
| Invalid transitions rejected                | `lifecycles.test.ts` (every pair, both machines); `trip-lifecycle.test.ts` (start before arrive, drop-off before start, cancel after start)            |
| Pooled fares correct                        | `standard-fare-policy.test.ts`, `trip-lifecycle.test.ts` (7,200 / 5,800; solo 9,000 / 7,000; Rafiq cancels, Nusrat pays solo)                          |
| Users cannot touch each other's rides       | `rides.test.ts`, `trip-lifecycle.test.ts`, `pooling.test.ts` (no trace of Rafiq in Nusrat's responses)                                                 |
| Cancellation rules                          | `trip-lifecycle.test.ts`                                                                                                                               |
| Concurrent requests cannot corrupt capacity | `concurrency.test.ts`: Nusrat vs Shirin on the last seat ×50, driver-accept vs auto-join, an eight-passenger crowd, and a **forced interleaving** test |
| Double submit                               | `rides.test.ts`: one 201, one 409 `ACTIVE_RIDE_EXISTS`                                                                                                 |

The concurrency suite was checked by mutation: removing `FOR UPDATE` from the pool lookup makes it
fail. The forced-interleaving test holds both transactions right after they read the pool, so it
fails deterministically without the lock rather than depending on timing.

Browser walkthrough (optional): `docker compose down -v && docker compose up -d --build`, then
`npm i --no-save playwright && npx playwright install chromium && node scripts/e2e-story.mjs`.

## API overview

All routes are under `/api/v1`; errors are always `{ "error": { "code", "message", "requestId" } }`.

| Method | Path                                               | Who           | Purpose                                                            |
| ------ | -------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| POST   | `/auth/register`                                   | public        | Passenger sign-up (also signs in)                                  |
| POST   | `/auth/login`                                      | public        | Sets the httpOnly session cookie                                   |
| POST   | `/auth/logout`                                     | signed in     | Clears the cookie                                                  |
| GET    | `/auth/me`                                         | signed in     | Current user and role                                              |
| GET    | `/zones`                                           | signed in     | Zone list                                                          |
| GET    | `/fare-estimates?pickupZoneId&dropoffZoneId&seats` | passenger     | Solo and pooled quote                                              |
| POST   | `/ride-requests`                                   | passenger     | Create a ride; auto-joins a pool if one qualifies                  |
| GET    | `/ride-requests?scope=active\|history`             | passenger     | Own rides only                                                     |
| GET    | `/ride-requests/:id`                               | owner         | Status, own fare, pool summary, timeline                           |
| POST   | `/ride-requests/:id/cancel`                        | owner         | Cancel while `REQUESTED` / `MATCHED`                               |
| PUT    | `/driver/availability`                             | driver        | `{ online, zoneId }`; refused while a pool is active               |
| GET    | `/driver/queue`                                    | driver        | Vehicle state plus waiting requests, each flagged `fitsActivePool` |
| POST   | `/driver/queue/:requestId/accept`                  | driver        | Create a pool or admit into the active one                         |
| GET    | `/pools?scope=active\|history`                     | driver        | Own pools with members and seats                                   |
| POST   | `/pools/:id/arrive` · `/start` · `/cancel`         | owning driver | Trip actions                                                       |
| POST   | `/pools/:id/members/:requestId/drop-off`           | owning driver | Member completes; the last one completes the pool                  |
| GET    | `/health/live`, `/health/ready`                    | public        | Process up; database reachable                                     |

Error codes: `VALIDATION_FAILED` 400 · `UNAUTHENTICATED` / `INVALID_CREDENTIALS` 401 · `FORBIDDEN` 403 ·
`NOT_FOUND` 404 (also for "not yours") · `INVALID_TRANSITION`, `POOL_FULL`, `POOL_NOT_JOINABLE`,
`INCOMPATIBLE_REQUEST`, `ACTIVE_RIDE_EXISTS`, `ACTIVE_POOL_EXISTS`, `DRIVER_OFFLINE`,
`PHONE_ALREADY_REGISTERED`, `CONFLICT` 409 · `PAYLOAD_TOO_LARGE` 413 · `RATE_LIMITED` 429 · `INTERNAL` 500.

## Deployment

Target (free tiers only), per `DESIGN.md` section 11:

- **Database: Neon** free plan. Set `DATABASE_URL` to the Neon connection string and `DATABASE_SSL=true`.
  Render's free Postgres is deleted after 30 days, which is why it is not used.
- **API: Render** free web service from `apps/api/Dockerfile` (build context = repository root).
  Start command: `sh -c "node dist/database/migrate-and-seed.js && node dist/main.js"` (migrations
  are a no-op when nothing is pending; safe with a single instance). Set `JWT_SECRET`,
  `COOKIE_SECURE=true`, `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL`.
- **Web: Vercel** Hobby, root directory `apps/web` with the monorepo included; set
  `API_INTERNAL_URL` to the Render service URL.

Cold starts: a free Render service sleeps after 15 minutes idle and takes about a minute to wake;
the UI shows "Waking up the server…" after 5 seconds of loading. This deployment has **not** been
performed in this repository; `docker compose up` is the verified, reproducible path.

## Key decisions and trade-offs

Where the spec was silent or ambiguous, this is what was chosen:

- **`DESIGN.md` stays at the repository root** (the layout diagram shows `docs/DESIGN.md`).
- **Sign-up also signs in** (the cookie is set on `201`), so the passenger lands in the app.
- **Extra error codes** beyond the spec table: `INVALID_CREDENTIALS` (401), `PHONE_ALREADY_REGISTERED`,
  `ACTIVE_POOL_EXISTS`, `DRIVER_OFFLINE`, `CONFLICT`, `PAYLOAD_TOO_LARGE`. Wrong password and unknown
  phone give the identical answer and both spend one hash verification.
- **At most 3 seats per request** at the API (the database allows 6 for other vehicles).
- **`GET /driver/queue` returns `{ vehicle, items }`** so the dashboard knows online state and zone
  in one call; it returns an empty list, not an error, while offline.
- **Drivers see passenger first names** in the queue and their trip; passengers never see co-riders'
  names or fares, only a co-rider count. Presenters map each audience explicitly.
- **Passenger timeline** shows only their own request events plus "driver arrived" for their pool.
- **A driver's cancelled trip does not re-match riders in the same transaction** (that would need to
  lock other pools while holding this one); they reappear in queues.
- **Seats are not freed on drop-off.** A started pool is locked, and freeing seats mid-trip has no use.
- **Lock order is vehicle → pool → request everywhere.** Passenger cancel of a `MATCHED` ride only
  peeks at the ride first, locks the pool, then re-checks; if the ride moved in between it retries
  (up to 3 times) instead of taking locks out of order.
- **Event order** is fixed by a process-wide sequence number on recorded events, so `ride_events`
  rows follow the order things happened, not aggregate by aggregate.
- **Hand-written migration** (not schema-generated): the constraints are the point.
- **Money** is integer paisa end to end; `formatBDT` uses `currencyDisplay: 'narrowSymbol'` so it
  renders `৳72.00` (Node's default for `en-BD` prints `BDT 72.00`).
- **Rate limiting behind the proxy:** the API trusts one proxy hop (`TRUST_PROXY_HOPS`). Locally in
  Compose the web container is the only client the API sees, so the auth limit is effectively
  shared by all local users; behind Vercel the forwarded client IP is used.
- **Compose defaults:** `env_file` lists `.env.example` then an optional `.env`, so a fresh clone
  runs without any manual step.
- **JWTs cannot be revoked before expiry** (12 h); acceptable for a demo, see next improvements.

## Known limitations

- Pickup and drop-off are zones, and a pool has a single pick-up zone.
- One Tesla per driver; drivers are seeded, not self-registered.
- Every request can be pooled (no opt-out); requests do not expire; cash only; no cancellation fee.
- No cancelling once the trip has started; no per-passenger no-show handling.
- Status updates use polling, not push.
- Not deployed and no demo video yet (see the top of this file).

## Next improvements

Request expiry job · no-show removal · pool opt-out · TeslaPay wallet on a double-entry ledger ·
SSE push for live updates · refresh-token rotation. The "if Oi Tesla goes viral" reasoning
(real-time gateway, H3 cells, event-partitioned matching, read replicas, idempotency keys,
observability) is written up in `DESIGN.md` section 16 and deliberately not implemented.

## AI usage

- **Tools:** Claude Code (Claude Sonnet 5) implemented this project from `DESIGN.md`, working
  step by step on the feature branches listed in the spec and running the build, lint and tests
  after each step.
- **One accepted suggestion:** ordering audit events with a process-wide sequence number. The first
  integration test showed `ride_events` rows written aggregate by aggregate (pool events before the
  request events that caused them); sorting by a recorded sequence before persisting made the
  history follow real order without relying on timestamps that collide within a millisecond.
- **One suggestion that was changed:** the first version of the concurrency tests (Nusrat vs Shirin
  ×50) passed, but when the `FOR UPDATE` lock was deliberately removed to check them, they still
  passed, so they could not be trusted (the requests rarely overlapped). That was changed by adding a
  deterministic test that pauses both transactions right after they read the pool, which fails
  without the lock. A "driver accept vs auto-join" test that actually only raced two auto-joins was
  likewise rewritten to race the two real entry paths.

## License

Assignment project; no license granted.
