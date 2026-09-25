## Summary

<!-- What changes and why. Link the step of DESIGN.md section 17 if it applies. -->

## Changes

-

## How to verify

```bash
npm run db:test:up && npm run lint && npm run typecheck && npm test
```

## Checklist

- [ ] Lint, type-check, unit and integration tests pass locally
- [ ] State changes are guarded by a lifecycle table and covered by a test for each illegal transition
- [ ] Anything that changes pool membership takes locks in the order vehicle, pool, request (see `docs/concurrency.md`)
- [ ] No passenger-facing response can contain another passenger's name, id or fare
- [ ] Docs updated (`README.md`, `docs/`) and no secrets committed
