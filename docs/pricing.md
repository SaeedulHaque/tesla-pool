# Fare model

All money is **integer paisa** (1 taka = 100 paisa) in the database, the API and the domain. It becomes
taka only at the UI edge (`formatBDT`). Nothing stores a float or a `NUMERIC`.

## Formula (pricing version `v1`)

```
passengerFare  = baseFare + distanceCharge - poolDiscount
baseFare       = 30 taka per request (3,000 paisa); never discounted
distanceCharge = 20 taka per km x km x seats   (2 paisa per metre)
poolDiscount   = 30% of distanceCharge (3,000 basis points), floored to whole paisa,
                 only if the pool has at least 2 active requests at the moment it STARTS
```

`distanceM * seats * 2` is far below 2^53, so the arithmetic is exact. The discount is floored, so
rounding never favours the rider.

## Worked examples (asserted in the tests)

|                 | Nusrat                              | Rafiq                               |
| --------------- | ----------------------------------- | ----------------------------------- |
| Trip            | Banani to Mohakhali, 3.0 km, 1 seat | Banani to Gulshan 1, 2.0 km, 1 seat |
| Base fare       | 30.00                               | 30.00                               |
| Distance charge | 60.00                               | 40.00                               |
| Pool discount   | -18.00                              | -12.00                              |
| **Pooled fare** | **72.00** (7,200 paisa)             | **58.00** (5,800 paisa)             |
| Solo fare       | 90.00 (9,000 paisa)                 | 70.00 (7,000 paisa)                 |

Two seats over 3.0 km alone: `30 + 2 x 60 = 150.00`; pooled: `30 + 120 - 36 = 114.00`.

## When a fare is decided

1. **At request time** the passenger sees both `estSoloFarePaisa` and `estPooledFarePaisa`, because it is
   not yet known whether they will share. Both are stored on the request.
2. **At pool start** the final fare is computed once per active member, stored
   (`fare_base_paisa`, `fare_distance_paisa`, `fare_discount_paisa`, `fare_total_paisa`) with
   `pricing_version = 'v1'`, and never changes again.
3. Because membership is locked at start, a co-rider can no longer cancel afterwards, so nobody's fare
   moves. A rider whose co-rider cancelled _before_ the start is priced solo.

The database also enforces `fare_total = base + distance - discount` and that an `IN_PROGRESS` or
`COMPLETED` request has a fare.

## Changing prices

Do not edit `StandardFarePolicy`. Add a new `FarePolicy` with a new `version` and switch the
composition root to it. Existing rides keep the version they were priced with.

## Distances

Zone-to-zone distances live in the `zone_distances` table (seeded, both directions) and are loaded into
a `ZoneDistanceMatrix` at startup. A pair with no row raises `VALIDATION_FAILED` instead of guessing.
The same table drives the pool matching rule (drop-offs within 3.0 km of each other).
