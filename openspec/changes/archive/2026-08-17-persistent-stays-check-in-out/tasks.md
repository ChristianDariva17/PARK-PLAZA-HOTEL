# Tasks: Persistent Stays Check-in and Check-out

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 900–1,300 authored additions/deletions across 15 new and 20 modified files |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single size-exception delivery; retain three internal work units |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |
| Testing mode | standard; user-executed verification |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | UTC intervals and compatible migration | Single PR, internal slice 1 | `cd Backend && npx vitest run test/reservations-interval.spec.ts test/database.integration.spec.ts` | Apply `0005` on a legacy fixture; verify local 15:00–11:00 mapping and abort on ambiguous data | Revert interval API/migration; retain legacy shadows |
| 2 | Transactional stay, checkout, walk-in lifecycle | Single PR, internal slice 2 | `Set-Location -LiteralPath 'C:\Users\crist\Downloads\prototipo V6\prototipo PP\Backend'; npx vitest run test/stays.dto.spec.ts test/stays.controller.spec.ts test/stays.service.spec.ts test/reservations-service.spec.ts test/reservations-lifecycle.spec.ts` | Authorized reservation and walk-in check-in, checkout, cleaning completion, retry same key | Disable `/stays` commands; revert `Backend/src/stays/` and lifecycle handlers |
| 3 | Persistent reception behavior | Single PR, internal slice 3 | `cd Fronted && npm test -- src/stays src/components/views/checkin` | Reception arrival/departure flow with stale-error reload; confirm no payment controls | Revert `Fronted/src/stays/` and reception wiring only |

## Phase 1: Interval Foundation (internal slice 1)

- [ ] 1.1 Add unit/integration coverage for Overnight, Invalid interval, Non-overlapping intervals, Overlap or cleaning conflict, Eligible/Ineligible early check-in, Existing reservation remains usable, and Migration conflict (`interval-reservation-availability/spec.md`); user runs the Unit 1 command.
- [x] 1.2 Add UTC/local interval models and policy in `Backend/src/database/schema/reservations.schema.ts`; add property defaults in `Backend/src/database/schema/hotel.schema.ts` and `schema/index.ts`.
- [x] 1.3 Create `Backend/drizzle/0005_persistent_stays_intervals.sql` and update `Backend/drizzle/meta/_journal.json` with validation, backfill, GiST `[)` exclusion, grants, and compatibility shadows; user runs migration harness.
- [ ] 1.4 Consolidate timezone/DST and interval validation helpers; preserve strict contracts in `Backend/src/reservations/`; user reruns Unit 1 verification.

## Phase 2: Persistent Lifecycle (internal slice 2)

- [x] 2.1 Add service/controller tests for eligible/invalid check-in, checkout, cleaning gate, cross-property, concurrent check-in, folio minimality, and all walk-in scenarios (`persistent-stay-lifecycle/spec.md`, `walk-in-stays/spec.md`); the user-run Unit 2 command passed all 20 tests across five lifecycle files.
- [x] 2.2 Create `Backend/src/database/schema/stays.schema.ts`; implement `Backend/src/stays/` and register it in `Backend/src/app.module.ts` with locks, receipts, permissions, audit-safe metadata, and atomic transitions.
- [x] 2.3 Extend `Backend/src/reservations/` for early amendment, rate snapshots, interval availability, and strict `StayCommandResponse` contracts; the user-run HTTP smoke on 2026-08-17 confirmed check-in, checkout, and walk-in runtime behavior.
- [x] 2.4 Add PostgreSQL invariant/concurrency coverage in `Backend/test/database.integration.spec.ts`; the user-run suite on 2026-08-17 passed 17/17 tests, including eight stay invariant tests.

## Phase 3: Reception Integration (internal slice 3)

- [x] 3.1 Add frontend tests for persistent-only arrivals/departures, loading/errors, stale retry reconciliation, and absent payment controls.
- [x] 3.2 Create `Fronted/src/stays/`; update `Fronted/src/reservations/{reservationModel,reservationsClient,reservationRequestPolicy}.js`, `Fronted/src/state/HotelContext.jsx`, `hotelReducer.js`, and `components/views/checkin/CheckInOutView.jsx` to use `persistentStays`.
- [ ] 3.3 Remove demo reducer dependencies and centralize authoritative reload/retry policy; user runs Unit 3 command and reception harness.
- [ ] 3.4 Run final user verification: backend unit/integration suites, frontend suite, type-check, lint, migration/runtime smoke checks, and confirm all listed spec scenarios.

Testing is standard rather than strict TDD; tests remain paired with each behavior unit. Threat matrix rows are explicitly N/A.

## Apply Status (2026-08-17)

Metadata reconciliation records **8/12** checked tasks: 1.2, 1.3, 2.1–2.4, 3.1, and 3.2. The exact PowerShell-safe Unit 2 command passed all 20 tests across five lifecycle files (evidence revision `sha256:602705552b01e5e5eaabc3308c86700297db5c11d12395bbb5744be315d56d4f`), the user-run HTTP smoke on 2026-08-17 supplied task 2.3 runtime evidence, and the user-run PostgreSQL suite passed 17/17 tests to supply task 2.4 invariant/concurrency evidence. Tasks 1.1, 1.4, 3.3, and 3.4 remain pending and user-owned. Backend lint is typed **UNAVAILABLE** because no `lint` script exists; it is neither PASS nor failure.

### Lifecycle Evidence Administrative Reconciliation

- Native runtime attempt ordinal 7 recorded the passing evidence as **interrupted** because the corrected candidate predated that attempt, triggering `unmanaged remediation requires a changed correction candidate`.
- The maintainer explicitly authorized an administrative reset at `sha256:ead5fadcc99e7c8fd90b90971a8ee91a2ca44e42074c2e80cb92af58e5679da2`.
- The current reconciliation token `sha256:7b5771609c411a1cd72c7f168f894a8a83c233bd8289a5cec7c52a013e72f223` remains orchestrator-owned and is not acquired, reset, or settled by this batch.
