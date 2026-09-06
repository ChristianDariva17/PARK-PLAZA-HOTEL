# Phase 0 Baseline

Recorded: 2026-09-05

## Repository state

- Branch: `main`, tracking `origin/main`.
- HEAD: `e6b717e` plus the current uncommitted remediation fixes.
- Working tree is not clean because the fixes described below are not committed yet.
- The uncommitted work includes files in the Phase 1 and Phase 2 areas. This baseline reflects that in-progress state, not the pre-remediation state.

## Toolchain and lockfiles

- Node.js: `v22.16.0`.
- npm: `11.6.2`.
- Backend lockfile SHA-256: `DC866FB7E7A26A8CBBA51848F4EC9F9993AC613B7780B9F0A5E4AAD7412887A0`.
- Fronted lockfile SHA-256: `6FAB4D9AFFFC9EFCAA555AEC5565512A4059AE5741246BBB8753FE9D351F046F`.
- Fronted-Cliente lockfile SHA-256: `C1128CC1E52B86FC7A2BA65B4B044C1D2FC4F5C03847D101BE445628384CDABF`.

## Database and schema

- Product schema migrations run through `Backend/src/database/migrate.ts` using Drizzle's migrator and `Backend/drizzle`.
- Compose starts PostgreSQL and then runs `node dist/src/database/migrate.js` in the `setup` service.
- PostgreSQL is now running in Docker on `127.0.0.1:5433`.
- The setup migration completed successfully with ephemeral local test secrets supplied through `docker compose run -e`; no secrets were written to the repository.

## Test baseline

| Suite | Result |
| --- | --- |
| `Backend: npm test` | Passed: 60 test files and 273 tests. |
| `Backend: npm run test:integration` | Passed: 1 test file and 21 tests, including schema readiness and folio multi-entry/idempotency coverage. |
| `Fronted: npm test` | Passed: 33 test files and 177 tests. |
| `Fronted-Cliente: npm test` | Passed: 11 tests. |
| `Backend: build` | Passed: `npm run build`. |
| `Backend: realtime and capability focus` | Passed: `test/realtime-gateway.spec.ts` (3 tests) and `test/bridge-capability.spec.ts` (2 tests, including expiry). |

## Regression guard status

- Socket.IO account change: a focused gateway test exists and passes, but this result is from the already-modified worktree.
- Expired capability: `BridgeCapabilityService.verify` validates signature, operation, subject, and expiration; a focused expiry regression test passes.
- Clean and upgraded schema: verified against the running PostgreSQL container through the 21-test integration suite.
- Folio with multiple entries: covered by the passing integration suite, including multiple entries, decimal safety, deduplication, reversal uniqueness, and reconciliation isolation.

## Exit decision

Phase 0 validation is green for the recorded automated checks: backend unit tests, backend build, PostgreSQL integration, capability expiry, realtime, and both frontend suites. The working tree remains uncommitted; formal closure still requires the project owner to review and commit the remediation set.
