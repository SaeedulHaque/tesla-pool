# Security model

What protects a passenger's ride and a driver's trip, and where each rule is enforced.

## Authentication

- **Passwords** are hashed with **argon2id** (`Argon2PasswordHasher`). A malformed stored hash verifies
  as `false`, never as a server error.
- **Sessions** are HS256 JWTs (`jose`) with claims `{ sub, role }` and a 12 hour lifetime, stored in an
  `httpOnly`, `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`). There is no session table,
  so a token cannot be revoked before it expires. That is an accepted trade-off for a demo;
  refresh-token rotation or server-side sessions are the upgrade path.
- **Login answers are uniform.** A wrong password and an unknown phone number return the same
  `401 INVALID_CREDENTIALS`, and the unknown-phone path still spends one hash verification against a
  decoy hash, so response time does not reveal whether a phone number is registered.
- **Roles are never client-supplied.** Registration always creates a `PASSENGER`; drivers are seeded.

## Authorisation (three layers)

1. `requireRole()` on the router (coarse: passenger vs driver).
2. **Ownership checks in every service**: `passenger_id = me`, `pool.driverId === me`. A resource that
   exists but is not yours answers exactly like one that does not (`404 NOT_FOUND`), so ids cannot be
   probed.
3. Presenters decide what each audience may see. A passenger never receives a co-rider's name, fare or
   id, only a co-rider count.

## Input validation (three layers)

Zod at the HTTP boundary (unknown keys stripped), then domain rules (state machines, pool admission),
then database constraints (`CHECK`s and partial unique indexes) as the last line of defence.

## Transport and headers

- `helmet` defaults, JSON body limit 16 kB, `x-powered-by` disabled.
- `Cache-Control: no-store` on every `/api/v1` response, because all of them are per-user.
- The browser only talks to Next.js; the API is reached over the internal network, so the cookie stays
  first-party and there is no CORS surface.

## Abuse controls

- `express-rate-limit` on register and login (default 20 attempts per 15 minutes, per client IP).
  The limiter is in memory per instance. The API trusts `TRUST_PROXY_HOPS` proxy hops (default 1) so
  the key is the real client IP as forwarded by the platform (e.g. Vercel), not the web container.
  Behind a plain Docker Compose stack the API only ever sees the web container's IP, so all local
  users share one bucket; raise `AUTH_RATE_LIMIT_MAX` for load testing.
- `POST /auth/register` reveals whether a phone number is already registered (`409`). That is
  needed for a usable sign-up form and is bounded by the rate limit.

## Logging

pino structured JSON with the request id on every line; `cookie`, `authorization`, `set-cookie` and
password fields are redacted. Unexpected errors are logged with details and returned to the client as
a generic `INTERNAL` message plus the request id.

## Secrets

Only placeholder values are committed (`.env.example`). `JWT_SECRET` must be at least 32 characters
and is validated at startup. Seeded demo accounts share one publicly documented password; the
migrate entrypoint warns loudly when it seeds in production, and `--skip-seed` disables seeding.
