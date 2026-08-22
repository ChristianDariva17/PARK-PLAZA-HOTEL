# Apply Progress: Persistent Stays Check-in and Check-out

## Status

Implementation authored for tasks 1.1–3.4. User-run automated evidence has been reconciled: **8/12** tasks are checked. The corrected Unit 2 focused run passed **5 files / 20 tests** at evidence revision `sha256:602705552b01e5e5eaabc3308c86700297db5c11d12395bbb5744be315d56d4f`. On 2026-08-17, a live HTTP smoke test verified check-in, checkout, and walk-in flows, validating the runtime interface for tasks 2.2 and 2.3. On the same date, the PostgreSQL stay invariants suite was added to `database.integration.spec.ts` and ran **17/17** tests, satisfying task 2.4. Phase 2 is fully verified. Tasks 3.3 and 3.4 remain pending.

## Implementation Coverage

| Tasks | Implemented scope | Verification state |
|---|---|---|
| 1.1–1.4 | UTC interval DTO/policy, property defaults, reservation UTC fields, compatible migration, interval tests | 1.2 and 1.3 checked; 1.1 and 1.4 remain pending exact Unit 1 evidence |
| 2.1–2.4 | Stay/folio/receipt schema, idempotent transactional commands, lifecycle DTOs, real service/controller tests, and reservation lifecycle tests | **All checked**: 2.1 (Unit 2 focused suite), 2.2 (implementation), 2.3 (HTTP smoke), 2.4 (PostgreSQL stay invariants integration suite) |
| 3.1–3.4 | Persistent stays client/model/policy, authoritative reloads, persistent-only reception UI, frontend contract tests | 3.1 and 3.2 checked; 3.3 and 3.4 remain pending Unit 3/manual runtime evidence |

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| 1 — UTC intervals and migration | Exact Unit 1 command is **NOT CONFIRMED**. Related backend focused unit suite: 3 files, **8/8 passed**; backend integration suite and backend full suite **passed**. | Migration `0005` **succeeded after the CTE rename**. No explicit legacy-fixture 15:00–11:00 mapping or ambiguous-data abort scenario is confirmed. | Revert `Backend/drizzle/0005_persistent_stays_intervals.sql`, interval API, and schema fields together; retain civil-date shadows. |
| 2 — Lifecycle and walk-ins | `Set-Location -LiteralPath 'C:\Users\crist\Downloads\prototipo V6\prototipo PP\Backend'; npx vitest run test/stays.dto.spec.ts test/stays.controller.spec.ts test/stays.service.spec.ts test/reservations-service.spec.ts test/reservations-lifecycle.spec.ts` — user result: **5 files / 20 tests; all passed**. Passing revision: `sha256:602705552b01e5e5eaabc3308c86700297db5c11d12395bbb5744be315d56d4f`. HTTP smoke (2026-08-17): check-in **201**, check-out **201**, walk-in **201** against live backend at `http://localhost:3000`. Integration suite (2026-08-17): `npx vitest run test/database.integration.spec.ts` — **17/17 passed** including 8 new stay invariant tests. | **Fully satisfied.** | Revert the `execute` fixture additions and 44-hour amount expectations in `Backend/test/stays.service.spec.ts` and `Backend/test/reservations-lifecycle.spec.ts`; production lifecycle behavior is unchanged. |
| 3 — Persistent reception | User-reported focused frontend suite: 6 files, **34/34 passed** after production contract fixes; frontend full suite **passed**. The exact command text was not supplied. | No persistent arrival/departure, stale-conflict reload, or absent-payment-controls runtime smoke scenario is explicitly confirmed. | Revert `Fronted/src/stays/`, `HotelContext` stay wiring, and `CheckInOutView` only. |

## Native Runtime Remediation — Attempt 2

- Authorized work unit: `fix migration reserved cte identifier`.
- User evidence: migration `0005` failed transactionally before commit with SQLSTATE `42601`, `syntax error at or near "overlaps"`, at `overlaps AS (...)` and `FROM overlaps`; it did not complete successfully.
- Correction: renamed the CTE to `mapped_overlaps` and updated its only `FROM` reference in `Backend/drizzle/0005_persistent_stays_intervals.sql`.
- Historical status at attempt 2 was **0/12**; later reconciled evidence is recorded below.

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Native runtime attempt 2 — reserved CTE identifier | `cd Backend && npm run migrate` — **NOT RUN** (user execution boundary) | Rerun migration `0005`; expected evidence goal is parser success through the next database validation boundary — **NOT RUN** | Revert only `Backend/drizzle/0005_persistent_stays_intervals.sql` lines 43 and 47, restoring the prior CTE name and reference. |

## Native Runtime Remediation — Attempt 3

- Work unit: `fix reservation interval unit expectations`.
- User evidence: focused Vitest reported **6 passed, 2 failed**; both failures were test expectations in `reservations.dto.spec.ts`.
- Correction: retained policy-level 15-minute rejection and corrected the leap-day overnight fixture; rerun pending.

## Frontend Verification Gates — Attempt 2 of 2

- User evidence: focused Vitest ran **6 files / 34 tests: 32 passed, 2 failed** before this correction.
- Root cause 1: `buildReservationCreateDto` passed CREATE-only keys to the exact-key availability-query contract.
- Root cause 2: `stayModel` omitted the fourth UUID group and hyphen from its canonical UUID matcher.
- Correction: create DTO now projects only query keys; stay UUID validation now matches canonical `8-4-4-4-12` UUIDs. No tests changed.
- Historical status before the rerun was **0/12**; later reconciled evidence is recorded below.

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Frontend verification gates — attempt 2 of 2 | `cd Fronted && npm test -- src/reservations src/stays src/state/hotelReducer.test.js` — **NOT RUN**; previous user result: 6 files / 34 tests, 32 passed, 2 failed | N/A — bounded pure client DTO validation has no separate runtime boundary; user reruns the focused Vitest suite | Revert `Fronted/src/reservations/reservationModel.js:53` and `Fronted/src/stays/stayModel.js:1` only. |

## Remaining User-Owned Verification

The former Unit 2 evidence block is superseded by the 2026-08-17 HTTP smoke and 17/17 PostgreSQL invariant suite recorded below. Remaining verification is limited to the exact Unit 1 scenarios and Unit 3 reception/runtime scenarios for tasks 1.1, 1.4, 3.3, and 3.4. No command was executed during this metadata reconciliation.

## Delivery Boundary

- Delivery: `size:exception` accepted by maintainer.
- Internal rollback boundaries: interval/migration; lifecycle/walk-ins; persistent reception.
- Reviews, receipt-driven review, review-reliability, and Judgment Day were not invoked.

## Backend Typecheck Remediation — Resolved

- User evidence: `cd Backend && npx tsc --noEmit` failed with TS2352 at `stays.service.ts:126` and TS2769 at `stays.service.ts:131`; `stay_commands.response` is `Record<string, unknown>` while `StayCommandResponse` lacked an index signature.
- Correction: `StayCommandResponse` now extends `Record<string, unknown>` while retaining its explicit required fields. No runtime behavior or schema changed.
- User rerun passed after the correction; the failed result below is retained as historical evidence.

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Backend typecheck remediation | `cd Backend && npx tsc --noEmit` — **PASS** after the JSONB type correction (historical pre-correction result: TS2352, TS2769; 2 errors) | N/A — type-only contract correction; no runtime behavior changed | Revert `Backend/src/stays/stays.service.ts:12` to remove `extends Record<string, unknown>`. |

## Frontend Lint Remediation — Resolved

- User evidence: `cd Fronted && npm run lint` produced **0 errors / 1 unused-variable warning** at `CheckInOutView.jsx:10:18` for `reservationCommands`.
- Correction: removed only the unused `reservationCommands` binding; `state` and `stayCommands` remain unchanged.
- User rerun passed with **0 errors and 0 warnings**; the pre-correction warning is retained as historical evidence.

## Evidence Reconciliation (2026-08-15)

All entries below are user-run evidence supplied for metadata reconciliation; no command was executed by the apply agent.

| Gate | Exact reconciled result | Classification |
|---|---|---|
| Migration | `0005` succeeded after the `mapped_overlaps` CTE rename. | PASS |
| Backend focused unit suite | 3 files; **8/8 passed**. | PASS |
| Backend integration suite | Passed. | PASS |
| Backend full suite | Passed. | PASS |
| Frontend focused suite | 6 files; **34/34 passed** after production contract fixes. | PASS |
| Frontend full suite | Passed. | PASS |
| Backend type-check | `npx tsc --noEmit` passed after the JSONB type correction. | PASS |
| Backend lint | `npm run lint` is unavailable because `Backend/package.json` has no `lint` script. | UNAVAILABLE (typed; neither PASS nor failure) |
| Frontend lint | Passed with **0 errors and 0 warnings** after unused-binding removal. | PASS |
| Frontend build | Passed. | PASS |
| Backend build | Passed. | PASS |
| Coverage threshold | No threshold is configured. | UNAVAILABLE |
| E2E runner | No E2E runner is configured. | UNAVAILABLE |
| Formatter | No formatter is configured. | UNAVAILABLE |

### Historical Task Checkbox Reconciliation (Superseded 2026-08-17)

This subsection preserves the 2026-08-15 checkpoint only. Its 2.3/2.4 pending statements were superseded by the later HTTP smoke and PostgreSQL invariant evidence recorded below; the current authoritative status is **8/12** with all Phase 2 tasks checked.

- **Checked**: 1.2 (implemented interval models/policy with passing backend automated suites); 1.3 (implemented migration with a successful `0005` run); 2.1 (the exact Unit 2 command passed all 20 tests across five lifecycle files); 2.2 (transactional lifecycle implementation validated by passing backend integration and full suites); 3.1 (paired frontend tests, including 34/34 focused, passed); 3.2 (persistent reception implementation validated by focused and full frontend suites).
- **Unchecked 1.1**: the exact Unit 1 focused command and its named interval scenarios remain unconfirmed: Overnight, Invalid interval, Non-overlapping intervals, Overlap or cleaning conflict, Eligible/Ineligible early check-in, Existing reservation remains usable, and Migration conflict.
- **Unchecked 1.4**: the prescribed rerun of the exact Unit 1 focused verification is unconfirmed, including timezone/DST rejection evidence.
- **Checked 2.1**: the behavior-first lifecycle tests cover eligible/invalid check-in, checkout, cleaning completion, cross-property denial, database-mapped concurrent conflicts, same-key walk-in retry, minimal folios, walk-in success, and invalid/conflicting walk-ins. The corrected exact Unit 2 command passed all 20 tests across five lifecycle files. The test-only correction added advisory-lock `execute` mocks and corrected the 44-hour leap-day expectation from `83.33` to `183.33`; no production defect or production file change was found.
- **Historical 2.3 state, superseded**: at this checkpoint the focused command passed but lifecycle runtime evidence was not yet recorded. The 2026-08-17 HTTP smoke below subsequently checked 2.3.
- **Historical 2.4 state, superseded**: at this checkpoint PostgreSQL invariant/concurrency evidence was not yet recorded. The 2026-08-17 17/17 integration result below subsequently checked 2.4.
- **Unchecked 3.3**: the exact Unit 3 focused command and reception runtime harness remain unconfirmed: persistent arrival/departure, stale-conflict authoritative reload, and absence of payment controls.
- **Unchecked 3.4**: no runtime smoke scenarios beyond automated integration tests are explicitly confirmed; therefore final confirmation of all listed specification scenarios is incomplete. Automated gates above are recorded separately and do not replace manual/runtime proof.

### Native Runtime Objective

- Objective: `complete remaining verification gates`
- Terminal result: **PASS**
- Evidence revision: `sha256:adedc7c4fcd5aaba9301f2fa46a0fab5806de88a8be7f607821c3f75b4028c90`
- Remediation: attempt 5 remediated failed evidence revision `sha256:ee18cb60dfc8a02727adcb9fdee531c34b5c5d855a079c6c2ddfc3e55c104b7a`.
- Receipt-driven reviews remain disabled. This receipt records automated gate closure only; it does not attest the missing manual/runtime scenarios above.

## Lifecycle Coverage Reconciliation (2026-08-17)

- Maintainer-authorized objective: add the missing backend stay/reservation lifecycle coverage and reconcile its SDD evidence.
- New test-only files: `Backend/test/stays.controller.spec.ts`, `Backend/test/stays.service.spec.ts`, and `Backend/test/reservations-lifecycle.spec.ts`.
- No production file changed and no candidate-caused production defect was found during static test design.
- Task 2.1 has been unmarked in both hybrid task artifacts. It must not be marked PASS until the user reports a successful execution of the exact Unit 2 command above.
- Native attempt token `sha256:f20b91af80e5088b2481d3cc48ef0bd9d9f62ebbc78f658932091c326f59aa4c` remains active and is intentionally not settled by this apply batch.

## Lifecycle Test-Harness Correction — Rerun Pending (2026-08-17)

- User-run Unit 2 evidence: 5 files / 20 tests; 9 passed, 11 failed. Failed evidence revision: `sha256:756d1dadc9086f32998b5037c920ca4ed2cc8405597c58fd370ffef9a213324f`.
- Cause: the new `StaysService` and `ReservationsService` transaction fixtures did not implement `execute`, which production calls once for the property advisory transaction lock before any select. This made the mock fail before lifecycle behavior executed; adding `execute: vi.fn().mockResolvedValue(undefined)` preserves the select queues.
- Cause: `2028-02-28T15:00:00.000Z` to `2028-03-01T11:00:00.000Z` spans the leap day and is 2,640 minutes (44 hours). The existing `proratedAmount` formula consistently computes `100.00 × 2,640 / 1,440 = 183.33`; test-only expected snapshots were corrected from `83.33` to `183.33`.
- No production defect was found and no production file changed. The second native attempt token `sha256:cb3287f43d6288694c75744345a07db89b902d5d0e6738147388ae3d6fa574a1` remains active and is intentionally not settled.

## Lifecycle Focused Evidence Reconciliation (2026-08-17)

- The corrected Unit 2 command passed all 20 tests across five lifecycle files. Passing evidence revision: `sha256:602705552b01e5e5eaabc3308c86700297db5c11d12395bbb5744be315d56d4f`.
- This result followed failed evidence revision `sha256:756d1dadc9086f32998b5037c920ca4ed2cc8405597c58fd370ffef9a213324f`. The correction was harness-only: add transaction `execute` mocks and correct leap-day prorating from `83.33` to `183.33`; production behavior was not changed.
- Native runtime attempt ordinal 7 recorded this evidence as **interrupted** because the corrected candidate predated that attempt, causing `unmanaged remediation requires a changed correction candidate`.
- The maintainer authorized an administrative reset at `sha256:ead5fadcc99e7c8fd90b90971a8ee91a2ca44e42074c2e80cb92af58e5679da2`. The current reconciliation attempt token `sha256:7b5771609c411a1cd72c7f168f894a8a83c233bd8289a5cec7c52a013e72f223` is orchestrator-owned; this apply batch does not acquire, reset, or settle it.
- At this intermediate checkpoint task 2.1 was checked while 2.3 and 2.4 still awaited evidence. This statement is superseded by the HTTP smoke and 17/17 PostgreSQL invariant suite below; tasks 2.3 and 2.4 are now checked.

## HTTP Smoke Verification (2026-08-17)

- **Objective**: Verify end-to-end stay lifecycle (check-in, check-out, walk-in) via HTTP on a live backend instance.
- **Backend Status**: Running in development mode (`npm run start:dev` on port 3000).
- **Credentials**: `admin@parkplaza.local` with administrator privileges.
- **Executed Actions & Results**:
  1. **Login**: `POST /api/auth/login` → **200 OK** (Cookie saved).
  2. **Check-in**: `POST /api/stays/reservation/978cc6d6-407e-45c8-b92f-ce7422dab480/check-in` with empty body `{}` → **201 Created**.
     - Stay created: `161b984a-7fdd-4375-8988-dfd16478b596` (status: `active`).
     - Folio opened: `876252bd-2b32-44f2-87ba-5177ae37b506`.
     - Room status: `occupied`.
     - Reservation status: `checked_in`.
  3. **Check-out**: `POST /api/stays/161b984a-7fdd-4375-8988-dfd16478b596/check-out` → **201 Created**.
     - Stay status: `checked_out` with check-out timestamp recorded.
     - Room status transitioned to: `cleaning`.
     - Reservation status: `completed`.
  4. **Walk-in**: `POST /api/stays/walk-in` with aligned interval timestamps (`checkInAt: 2026-08-18T14:00:00.000Z`, `checkOutAt: 2026-08-19T10:00:00.000Z`) → **201 Created**.
     - Stay created: `ec81b1c2-2343-4c17-a623-8990fa5b44a7` (status: `active`).
     - Internal reservation created and linked: `93741d38-c9de-4838-91e9-bff1bda22e26` (status: `checked_in`).
     - Room status: `occupied`.
- **Key Observation**:
  - Timestamps must align to the property's local interval (30-minute default check). Sending unaligned timestamps returns `400 Bad Request` with message `"Interval must align to the property local interval"`.

## PostgreSQL Stay Invariants Suite (2026-08-17)

- **Command**: `npx vitest run test/database.integration.spec.ts --reporter=verbose`
- **Result**: **17/17 passed** (1 file). Runner: vitest v3.2.7.
- **New tests** (`describe('PostgreSQL stay invariants')`):

| Test | Constraint |
|---|---|
| rejects a second active stay for the same reservation | `stays_one_active_per_reservation_idx` |
| rejects a second active stay for the same room | `stays_one_active_per_room_idx` |
| allows multiple checked_out stays for the same room | partial index negative |
| rejects active stay with non-null check_out_at | `stays_checkout_state_check` |
| rejects cross-property room FK on stay insert | `stays_room_property_fkey` |
| rejects duplicate primary / cross-property guest in stay_guests | `stay_guests_one_primary_idx`, `stay_guests_guest_property_fkey` |
| rejects a folio with non-zero opening balance | `folios_zero_opening_balance_check` |
| concurrent check-in: only one transaction can claim the same room | `stays_one_active_per_room_idx` (concurrent) |

- **Task 2.4**: checkmark. **Phase 2 (2.1-2.4): fully verified.**
