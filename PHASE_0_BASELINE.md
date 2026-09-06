# Phase 0 Baseline

Recorded: 2026-09-05

## Repository state

- Branch: `main`, tracking `origin/main`.
- HEAD: `7955f24862c9b1dae8a3bcd5f23c5b23d3f8207d`.
- Working tree is not clean: 46 tracked files are modified and 8 paths are untracked.
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
- The applied schema could not be verified: Docker Desktop is not running, so the local PostgreSQL service is unavailable.
- `npm run test:integration` could not initialize because required secrets are absent: `ATTENDANCE_QR_SECRET` and `BIOMETRIC_BRIDGE_CAPABILITY_SECRET`.

## Test baseline

| Suite | Result |
| --- | --- |
| `Backend: npm test` | Failed: 15 test files and 36 tests failed; 45 test files and 228 tests passed. |
| `Backend: npm run test:integration` | Failed during environment validation before any test ran. |
| `Fronted: npm test` | Passed: 33 test files and 177 tests. |
| `Fronted-Cliente: npm test` | Failed: 1 of 11 tests. The expected error label uses a shorter code prefix than the implementation. |
| `Backend: realtime and capability focus` | Passed: `test/realtime-gateway.spec.ts` (3 tests) and `test/bridge-capability.spec.ts` (1 test). |

## Regression guard status

- Socket.IO account change: a focused gateway test exists and passes, but this result is from the already-modified worktree.
- Expired capability: no executable regression test was added in this phase. The bridge capability code is already modified in the worktree, so an initial failing state cannot be honestly reconstructed here.
- Clean and upgraded schema: blocked by unavailable Docker and missing required test environment.
- Folio with multiple entries: no dedicated executable regression test was added in this phase because the worktree already contains unrelated failing backend tests; it must be added after those failures are triaged or isolated.

## Exit decision

Phase 0 has an auditable baseline but is not closed. Close it only after the backend and customer-suite failures are classified, a disposable database is available for clean/upgrade migration tests, and the four regression guards are independently executable.
