# API reference

Base path `/api/v1`. All bodies are JSON. The session is an `httpOnly` cookie (`tesla_session`) set by
login/register; through the web app the browser calls `/api/*` on the Next.js origin, which proxies to
this API. Every response carries `x-request-id` and `Cache-Control: no-store`.

## Errors

Always this shape:

```json
{
  "error": {
    "code": "POOL_FULL",
    "message": "Pool ... has only 0 seat(s) left.",
    "requestId": "..."
  }
}
```

| Code                                                     | HTTP | When                                                        |
| -------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `VALIDATION_FAILED`                                      | 400  | Zod rejects body/params/query, or malformed JSON            |
| `UNAUTHENTICATED`                                        | 401  | Missing, expired or invalid cookie                          |
| `INVALID_CREDENTIALS`                                    | 401  | Wrong phone or password (same answer for both)              |
| `FORBIDDEN`                                              | 403  | Wrong role for this endpoint                                |
| `NOT_FOUND`                                              | 404  | Does not exist **or is not yours** (indistinguishable)      |
| `INVALID_TRANSITION`                                     | 409  | The lifecycle table forbids it, e.g. start before arrive    |
| `POOL_FULL`, `POOL_NOT_JOINABLE`, `INCOMPATIBLE_REQUEST` | 409  | Pool admission rules                                        |
| `ACTIVE_RIDE_EXISTS`                                     | 409  | Passenger already has an active ride (also a double submit) |
| `ACTIVE_POOL_EXISTS`                                     | 409  | Driver cannot change availability with an active trip       |
| `DRIVER_OFFLINE`                                         | 409  | Driver must be online in a zone to accept                   |
| `PHONE_ALREADY_REGISTERED`, `CONFLICT`                   | 409  | Uniqueness or data rule violated                            |
| `PAYLOAD_TOO_LARGE`                                      | 413  | Body over 16 kB                                             |
| `RATE_LIMITED`                                           | 429  | Too many auth attempts                                      |
| `INTERNAL`                                               | 500  | Unexpected; details are in the logs only                    |

## Auth

| Method | Path             | Body                            | Result                                               |
| ------ | ---------------- | ------------------------------- | ---------------------------------------------------- |
| POST   | `/auth/register` | `{ fullName, phone, password }` | `201 { user }` and a session cookie (passenger only) |
| POST   | `/auth/login`    | `{ phone, password }`           | `200 { user }` and a session cookie                  |
| POST   | `/auth/logout`   | none                            | `204`, cookie cleared                                |
| GET    | `/auth/me`       | none                            | `200 { user: { id, fullName, phone, role } }`        |

Phones are Bangladeshi mobiles; `01800000003` and `+8801800000003` are the same number.

## Reference data and estimates

| Method | Path                                               | Who       | Result                                                                                                |
| ------ | -------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/zones`                                           | signed in | `{ items: [{ id, code, name, latitude, longitude }] }`                                                |
| GET    | `/fare-estimates?pickupZoneId&dropoffZoneId&seats` | passenger | `{ estimate: { distanceM, solo, pooled, estimatedSoloPaisa, estimatedPooledPaisa, pricingVersion } }` |

## Passenger

| Method | Path                                                                    | Result                                                               |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| POST   | `/ride-requests` body `{ pickupZoneId, dropoffZoneId, seats }` (1 to 3) | `201 { ride }`, `REQUESTED` or already `MATCHED` if a pool qualified |
| GET    | `/ride-requests?scope=active\|history`                                  | `{ items: [ride] }`, own rides only                                  |
| GET    | `/ride-requests/:id`                                                    | `{ ride }` with `timeline`                                           |
| POST   | `/ride-requests/:id/cancel`                                             | `{ ride }`; only while `REQUESTED` or `MATCHED`                      |

A passenger's `ride` never contains another passenger's name, id or fare:

```json
{
  "id": "4b1e...",
  "status": "MATCHED",
  "pickup": "Banani",
  "dropoff": "Mohakhali",
  "seats": 1,
  "distanceM": 3000,
  "fare": {
    "estimatedSoloPaisa": 9000,
    "estimatedPooledPaisa": 7200,
    "final": null,
    "pricingVersion": "v1"
  },
  "pool": {
    "status": "DRIVER_ARRIVED",
    "driverName": "Jashim",
    "vehicleName": "Bullet",
    "coRiderCount": 1
  },
  "createdAt": "...",
  "completedAt": null,
  "cancelledAt": null
}
```

Once the trip starts `fare.final` holds `{ basePaisa, distancePaisa, discountPaisa, totalPaisa }` and never changes.

## Driver

| Method | Path                                              | Result                                                                                                                           |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PUT    | `/driver/availability` body `{ online, zoneId? }` | `{ vehicle }`; `zoneId` required to go online; `409` while a pool is active                                                      |
| GET    | `/driver/queue`                                   | `{ vehicle, items: [{ id, passengerName, pickup, dropoff, seats, distanceM, createdAt, fitsActivePool }] }`; empty while offline |
| POST   | `/driver/queue/:requestId/accept`                 | `{ pool }`: creates a pool, or admits into the active one                                                                        |
| GET    | `/pools?scope=active\|history`                    | `{ items: [pool] }`, own pools only                                                                                              |
| POST   | `/pools/:id/arrive`                               | `ACCEPTED -> DRIVER_ARRIVED`                                                                                                     |
| POST   | `/pools/:id/start`                                | `DRIVER_ARRIVED -> STARTED`; locks membership and finalizes every rider's fare                                                   |
| POST   | `/pools/:id/members/:requestId/drop-off`          | rider `COMPLETED`; the last one completes the pool                                                                               |
| POST   | `/pools/:id/cancel`                               | pool `CANCELLED`; riders return to `REQUESTED`; not allowed once `STARTED`                                                       |

A driver's `pool` lists its riders:

```json
{
  "id": "...",
  "status": "STARTED",
  "pickup": "Banani",
  "vehicleName": "Bullet",
  "seatCapacity": 3,
  "seatsOccupied": 3,
  "createdAt": "...",
  "members": [
    {
      "requestId": "...",
      "passengerName": "Nusrat",
      "dropoff": "Mohakhali",
      "seats": 1,
      "status": "IN_PROGRESS",
      "farePaisa": 7200,
      "joinedAt": "..."
    }
  ]
}
```

## Health

`GET /health/live` (process is up) and `GET /health/ready` (database reachable, `SELECT 1`); both are
outside `/api/v1`, public and uncached.
