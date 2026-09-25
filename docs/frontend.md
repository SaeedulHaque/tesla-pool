# Frontend

Next.js 15 (App Router) with Tailwind and TanStack Query. The browser only ever talks to the Next.js
origin.

## Request path

```
Browser -> /api/v1/... (same origin) -> app/api/[...path]/route.ts -> API_INTERNAL_URL (Express)
```

The catch-all route handler forwards the method, body and headers (minus hop-by-hop ones), passes
`Set-Cookie` back unchanged, and reads `API_INTERNAL_URL` at request time, so one built image works in
Compose and in production. Because the cookie is first-party there is no CORS. An unreachable API becomes a
`502 UPSTREAM_UNAVAILABLE` with the standard error shape.

## Routes and guards

| Route                   | Who        | Shows                                                            |
| ----------------------- | ---------- | ---------------------------------------------------------------- |
| `/login`, `/register`   | signed out | phone + password forms                                           |
| `/ride`                 | passenger  | request form with live fare estimate, or the active ride tracker |
| `/rides`, `/rides/[id]` | passenger  | history; one ride with fare breakdown and timeline               |
| `/driver`               | driver     | availability, request queue, active pool card with seat meter    |
| `/driver/trips`         | driver     | trip history with members and fares                              |

Each route group `(auth)`, `(passenger)`, `(driver)` has a Server Component layout that calls `/auth/me`
with the incoming cookie (`lib/server-session.ts`) and redirects on the wrong role. This is defence in
depth; the API still enforces every rule. If the API cannot be reached the layout throws, so the error page
shows instead of a misleading redirect to `/login`.

## Data flow

- **TanStack Query** for all server state: caching, polling and mutations. There is no global client store.
- **Polling:** the active ride refreshes every 4 s until it is finished; the driver queue and active pool
  every 5 s.
- **No optimistic updates.** Seat claims and status changes disable their button while in flight and show
  exactly what the server answered. After a mutation the relevant queries are invalidated and refetched.
- An expired session during polling redirects to `/login` (`QueryCache.onError`), as a convenience.

## One place for each mapping

| Concern                                                                        | File                    |
| ------------------------------------------------------------------------------ | ----------------------- |
| `(request status, pool status)` to `{ label, tone, allowedActions, finished }` | `lib/ride-status.ts`    |
| API error code to message                                                      | `lib/error-messages.ts` |
| Money and distance formatting (`formatBDT`)                                    | `lib/format.ts`         |
| Query keys                                                                     | `lib/query-keys.ts`     |
| Fetch wrapper and `ApiError`                                                   | `lib/api-client.ts`     |

Components never switch on raw status strings; they ask `ride-status.ts`, so a button can never be offered
for a transition the API would reject.

## The four states

Every data view renders **loading** (skeleton, plus "Waking up the server..." after 5 s because free hosting
sleeps), **error** (message from `error-messages.ts`, a reference id, and a retry button), **empty** (for
example "No ride requests in Banani right now.") and **data**.

## Forms

Login, registration and the trip form validate with the same Zod schemas from `packages/shared` that the API
uses, so client and server can never disagree about what is valid.

## Tests

`apps/web/test` unit-tests the pure logic (status mapping, error messages, formatting, shared schemas).
`scripts/e2e-story.mjs` drives the whole story in a real browser against the Docker stack.
