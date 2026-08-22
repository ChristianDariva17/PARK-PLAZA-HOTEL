## Exploration: Persistent stays and check-in/check-out

### Current State

The product has two incompatible operational models. The reservation slice is persistent, property-scoped, UUID-based, and backed by PostgreSQL: `reservations` references a property, room, and primary guest; reservation statuses already include `checked_in` and `completed`; availability excludes active overlapping reservations and non-sellable room statuses. `ReservationsService` protects creation with a property transaction lock, room row locking, overlap checks, and audit events.

The reception UI and reducer still use a legacy demo graph. `hotelModel.js` seeds `RES-*`, `CLI-*`, numeric room IDs, `EST-*` stays, accounts, payments, contracts, and cleaning tasks in memory. `CheckInOutView.jsx` can list these demo records, but deliberately blocks submit when UUID-backed guest/room references cannot resolve; its confirmation copy explicitly says persistent check-in/out is not integrated. The reducer's legacy `CHECK_IN` creates an in-memory stay/account, marks the room `Ocupada`, and updates a demo reservation; `CHECK_OUT` closes the demo account/stay, creates cleaning, marks the room `En limpieza`, and completes the demo reservation. `HotelContext` persists guests, rooms, and reservations through feature clients but has no stay command, load state, or mutation reconciliation.

Room inventory already distinguishes operational status from reservation availability: the backend room enum contains `available`, `reserved`, `occupied`, `cleaning`, `maintenance`, `blocked`, and `out_of_service`; availability currently excludes only maintenance/blocked/out_of_service and treats occupied/cleaning as sellable for date-based inventory. Check-in/out must therefore update operational status deliberately without making room status the source of inventory date availability.

Authentication is property-scoped through `AuthenticatedAccount.propertyId`; controllers use `@RequirePermissions`, and the guard requires every declared permission. Frontend permissions already define `stays.read`, `stays.check_in`, and `stays.check_out`. Audit events support actor, subject, property, request context, and sanitized metadata, and existing reservation writes record audit rows inside the same transaction. Testing is Vitest with strict TDD, backend and frontend unit/integration suites, but no E2E runner.

### Affected Areas

- `Backend/src/database/schema/reservations.schema.ts` — existing reservation lifecycle and property-scoped foreign-key boundary; likely source for transition guards.
- `Backend/src/database/schema/hotel.schema.ts` — room operational status is separate from date availability and must be updated atomically with reception operations.
- `Backend/src/reservations/reservations.service.ts` and `reservations.controller.ts` — existing locking, overlap, property scoping, DTO, and audit patterns to reuse or extend.
- `Backend/src/audit/audit.service.ts` and `Backend/src/auth/guards/permissions.guard.ts` — audit transaction convention and permission enforcement.
- `Backend/src/database/schema/security.schema.ts` — existing permissions and audit event persistence; migration/seeding conventions need inspection during design.
- `Fronted/src/components/views/checkin/CheckInOutView.jsx` — legacy/demo UI and explicit blocked integration seam.
- `Fronted/src/domain/hotelModel.js` — demo stays, accounts, reservations, rooms, and cleaning fixtures; should become fallback/non-operational data or be removed from this route.
- `Fronted/src/state/hotelReducer.js` and `Fronted/src/state/HotelContext.jsx` — legacy reducer transitions versus persistent load/mutation orchestration, generation cancellation, permission checks, and reconciliation patterns.
- `Fronted/src/auth/permissions.js` — already declares stay permissions and action mapping.
- `Backend/test/*reservation*`, `Fronted/src/state/hotelReducer.test.js`, and related model/client tests — existing contract and concurrency-oriented test patterns; new transition tests are required before implementation.

### Approaches

1. **Separate persistent stay entity** — add a property-scoped `stays` aggregate (and, if needed, stay guests/account/payment tables later), with check-in creating a stay and linking it to a reservation; check-out closes the stay and separately transitions the reservation.
   - Pros: represents the real operational fact that a reservation is a plan while a stay is an actual occupancy; supports walk-ins, extensions, split/room moves, multiple operational records, and future folio work without overloading reservation history.
   - Cons: requires schema, DTO, service, client, reducer/context, and migration work; needs explicit consistency rules between stay and reservation.
   - Effort: High

2. **Reservation lifecycle only** — use `reservations.status` (`checked_in`/`completed`) as the operational record, adding identity/check-in/out timestamps and possibly payment/cleaning references directly to reservations.
   - Pros: smallest first migration and simpler list/read flow; aligns with the statuses already present.
   - Cons: conflates booking lifecycle with occupancy, makes folio/account state awkward, weakens support for walk-ins and future room changes, and turns one table into both inventory contract and operational history.
   - Effort: Medium

3. **Compatibility bridge over demo state** — map persistent reservations/rooms/guests into the existing reducer and keep stays/accounts in memory temporarily.
   - Pros: smallest UI disruption.
   - Cons: does not meet persistence outcome, leaves reload/data-loss behavior, and risks false room occupancy or duplicate operations.
   - Effort: Medium (not viable as the target slice)

### Recommendation

Choose the separate persistent stay entity, but keep the first slice narrow: one reservation-backed stay per check-in, no walk-ins, no room moves, no folio redesign, and no broad migration of every demo subsystem. Check-in should be one backend transaction that locks the property boundary and relevant reservation/room rows, verifies property ownership, reservation status/date/guest/room coherence, identity evidence, and absence of an active stay, then inserts the stay, transitions the reservation to `checked_in`, and changes the room to `occupied`. Check-out should be a separate transaction that locks the stay and room, verifies the active stay and settlement input, closes the stay, transitions the reservation to `completed`, and changes the room to `cleaning`; cleaning approval later returns the room to `available` (or the existing derived/blocked status), not check-out itself.

The first UI slice should load persistent reservations, rooms, guests, and stays through explicit clients/models, render only records with valid UUID relationships, and replace demo submit blocking with real commands and reconciliation. Preserve the existing reducer/context request-generation and stale-response protections. Do not treat `occupied` or `cleaning` as a permanent date-inventory exclusion without an explicit availability policy: date availability and current operational readiness are related but distinct invariants.

### Dependencies

- Confirm migration/seeding conventions and whether roles already receive `stays.*` permissions.
- Define stay response shape, lifecycle enum, identity-validation persistence, and actor/request audit metadata.
- Decide whether account/folio persistence is part of this change or a later bounded change; the current demo checkout requires it, but the reservation backend has no financial tables.
- Establish transaction/locking rules and idempotency or stale-operation behavior for repeated check-in/check-out requests.
- Add backend unit/integration coverage and frontend model/client/reducer/context tests under strict TDD; no E2E assumptions.

### Invariants and Concurrency Risks

- Every stay, reservation, room, guest, and audit subject must remain property-scoped; never trust client-supplied property IDs.
- Check-in must be atomic across stay insertion, reservation transition, and room operational update; concurrent requests must yield one success and one conflict/idempotent result.
- Check-out must not close a different or already-closed stay after stale UI state; use row locks and guarded status predicates.
- A room can have at most one active stay; enforce this in the database where practical, not only in service code.
- Reservation date overlap and room operational status solve different problems. Avoid changing availability semantics accidentally when introducing `occupied`/`cleaning` transitions.
- Audit records must be written in the same transaction as lifecycle changes and must not contain identity secrets or tokens.
- Frontend optimistic reducer state must not report success before persistence; ambiguous transport failures require reload/reconciliation, matching reservation behavior.

### Explicit Non-Goals

- No implementation, migration execution, test/build/lint execution, server, package, Docker, or Git operation in this phase.
- No walk-in reservations, date extensions, room transfers, split stays, multi-room stays, or overbooking policy.
- No full persistent folio/account, tax/fiscal integration, payment gateway, or reversal/refund workflow unless separately approved as a dependency.
- No redesign of cleaning, maintenance, biometric hardware integration, contracts, recreation access, orders, vehicles, or pets.
- No broad removal of unrelated demo modules; only the reception path should stop depending on demo stay data.

### Ready for Proposal

Yes. The orchestrator should carry forward the separate-stay decision, the deliberately narrow reservation-backed first slice, the transaction/locking and room-status boundaries, and the explicit folio/account dependency before asking for proposal/spec/design.
