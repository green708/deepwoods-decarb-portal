# tests/ — Test Suite

Placeholder for the test suite. Currently empty.

## What belongs here

- Unit tests for GHG calculation functions (`src/lib/`, `backend/api/`)
- Integration tests for PHP API endpoints
- End-to-end tests for critical user flows (login, data submission, report generation)

## What does NOT belong here

- Manual test data or client seed files (use `database/migrations/`)
- Lovable/browser preview screenshots

## Recommended test setup (future)

```
tests/
├── unit/
│   ├── ghg-calculations.test.ts    (emission factor math)
│   └── submission-validation.test.ts
├── integration/
│   ├── auth.test.php               (login / session flow)
│   └── submissions.test.php        (full CRUD cycle)
└── e2e/
    └── critical-paths.test.ts      (login, submit, review)
```

Suggested tools:
- Unit/integration (TS): Vitest
- PHP API: PHPUnit
- E2E: Playwright

This is tracked in `docs/TODO.md` as a future infrastructure task.
