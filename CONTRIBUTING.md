# Contributing

## Setup

```bash
npm install
npm run build:shared
npm run db:test:up        # throwaway Postgres on :5433 for the integration tests
```

`docker compose up --build` runs the whole stack (see the README).

## Everyday commands

| Command                           | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run lint` / `npm run format` | ESLint / Prettier                                             |
| `npm run typecheck`               | type-check shared, api and web                                |
| `npm run test:unit`               | pure domain, policies, web presentation logic                 |
| `npm run test:integration`        | HTTP against a real Postgres, including the concurrency suite |
| `npm run build`                   | build shared, api and web                                     |

Integration tests need a real Postgres: the guarantees under test are Postgres locks and constraints.
`TEST_DATABASE_URL` overrides the default `postgresql://tesla:change-me@localhost:5433/tesla_pool_test`.

## Git workflow

- `main` is always integrated and working. `pre-release` is for integration fixes, docs and deployment
  checks; `release/vX.Y.Z` is tagged and is the version shown in the demo.
- Work on `feature/<topic>` branches from `main`, open a pull request, and merge with a **merge commit**
  (not squashed) so step-by-step history stays visible. Fixes made on `pre-release` are merged back to `main`.
- Every pull request must pass CI (lint, format, type-check, unit, integration, build, Docker smoke test).

## Commit messages

`<type>(<scope>): <short description>` with type one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
`build`. One commit is one understandable change. Avoid "update", "changes", "final", "working now".

```
feat(auth): add passenger login endpoint
feat(pool): enforce Bullet's seat capacity
fix(pool): prevent overbooking available seats
build(docker): add compose setup for api and postgres
```

## Rules that keep the system correct

1. **State changes go through the lifecycle tables** (`ride-request.lifecycle.ts`, `pool.lifecycle.ts`).
   Add a test for every illegal transition you introduce.
2. **Pool membership changes take locks in one order**: vehicle, then pool, then request
   (`docs/concurrency.md`). Load the pool with `SELECT ... FOR UPDATE` before reading its seat count.
3. **One use case is one transaction**, in an application service. Controllers only validate, call one
   service method and map the result. Entities never touch the `EntityManager`.
4. **Entities never serialise directly.** Add fields to a presenter explicitly, and check that no
   passenger-facing response can leak another passenger's name, id or fare.
5. **Money is integer paisa** and goes through `Money`.
6. **Schema changes are migrations** in `apps/api/src/database/migrations/` and are listed in
   `migrations/index.ts`. Keep constraints in the database, not only in code.
7. Never commit secrets: `.env` is git-ignored and `.env.example` holds placeholders only.
