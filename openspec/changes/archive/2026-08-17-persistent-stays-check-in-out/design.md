# Design: Persistent Stays Check-in and Check-out

## Technical Approach

Replace civil-date reservation boundaries with property-local, UTC-backed intervals, then add a `StaysModule` for transactional reception commands. Reservations remain booking contracts; `stays`, `stay_guests`, and one zero-balance `folios` row record occupancy. Property configuration seeds day-use as 09:00–18:00, minimum 180 minutes, at 30-minute granularity. This implements all three delta specs without reconnecting the demo reducer state.

## Architecture Decisions

| Decision | Choice | Alternative / tradeoff | Rationale |
|---|---|---|---|
| Persistence | Property-scoped UUID stays, copied `stay_guests`, one `folios.stay_id`, and `stay_commands` idempotency receipts. | Derive guests solely through reservations; retry without a receipt. | Snapshot associations preserve actual occupants; composite property FKs, unique stay/folio links, and `(property_id, operation, idempotency_key)` prevent cross-property and retry duplicates. |
| Time | `check_in_at`/`check_out_at` are `timestamptz`; local input resolves to one 30-minute UTC candidate. Properties seed configurable day-use 09:00–18:00 with a 180-minute minimum. | Civil dates or server timezone. | `Intl` rejects nonexistent/ambiguous DST times without silent occupancy changes; explicit defaults make day-use selectable and testable. |
| Concurrency | Keep property advisory lock before `FOR UPDATE` room lock; PostgreSQL exclusion constraints are the final guard. | Application overlap query only. | Matches existing transaction order and remains correct across concurrent workers. |
| Operations | Check-in requires `available`, sets `occupied`; check-out sets `cleaning`; only explicit cleaning completion sets `available`. Cleaning is not an invented occupancy interval. | Generic room status override. | Separates future interval inventory from the operational admission gate and excludes manual overrides. |
| Client boundary | New `stays` client/model/policy and authoritative `persistentStays`; `CheckInOutView` uses persistent reservations/stays only. | Reuse `state.reservations`, `state.stays`, contracts, accounts, or payments. | The legacy reducer fabricates payments and local state; the new minimal folio must not do either. |

## Data Flow

```
Reception UI -> staysClient -> StaysController -> transaction
                                      |             -> property lock -> room row lock
                                      |             -> identity/interval checks
                                      |             -> reservation + stay + guests + folio + audit
                                      v
                         exact StayCommandResponse <- idempotency receipt
```

`POST /stays/reservation/:id/check-in` optionally accepts an earlier local start (maximum one local day); it amends the reservation, creates the stay/folio, marks room `occupied`, and records only IDs, statuses, interval, and reason in audit metadata. `POST /stays/walk-in` creates the reservation with the category rate snapshot and all stay records atomically. `POST /stays/:id/check-out` closes the stay, completes its reservation, and sets `cleaning`; `POST /stays/rooms/:id/cleaning-complete` is the sole targeted `cleaning -> available` transition. All commands require existing `stays.*`/`cleaning.progress` grants, scope every lookup by `propertyId`, and return the original receipt on a matching retry; stale/ambiguous failures trigger authoritative reload before UI retry.

## Interfaces / Contracts

```ts
type StayCommandResponse = {
  stay: { id: string; reservationId: string; roomId: string; status: 'active' | 'checked_out'; checkInAt: string; checkOutAt: string | null };
  folio: { id: string; stayId: string; openingBalance: '0.00' };
  reservation: { id: string; status: string; checkInAt: string; checkOutAt: string };
  room: { id: string; status: 'available' | 'occupied' | 'cleaning' };
};
```

Reservation create/availability contracts expose the property-local day-use policy (`09:00`, `18:00`, `180`, and `30` minutes initially) and reject intervals outside it or shorter than 180 minutes; models reject extra/missing keys and invalid UUID, UTC timestamp, status, or decimal values. Requests require an opaque UUID `Idempotency-Key`; audits exclude document numbers, names, and payment data.

## File Changes

| File | Action | Description |
|---|---|---|
| `Backend/src/database/schema/{hotel,reservations,stays}.schema.ts`, `schema/index.ts` | Modify/Create | Property time configuration (including seeded day-use defaults), interval reservations, stay/folio/receipt constraints. |
| `Backend/drizzle/0005_persistent_stays_intervals.sql`, `drizzle/meta/_journal.json` | Create/Modify | Safe additive migration, constraints, grants, and journal entry. |
| `Backend/src/{reservations,stays}/` and `app.module.ts` | Modify/Create | Interval API plus dedicated lifecycle module. |
| `Backend/test/{reservations,stays}-*.spec.ts`, `database.integration.spec.ts` | Modify/Create | Service/controller and PostgreSQL invariants. |
| `Fronted/src/stays/`, `reservations/{reservationModel,reservationsClient,reservationRequestPolicy}.js` | Create/Modify | Strict interval/lifecycle contracts and reconciliation policies. |
| `Fronted/src/state/{HotelContext.jsx,hotelReducer.js}`, `components/views/checkin/CheckInOutView.jsx` | Modify | Persistent commands and reception UI; remove demo-flow dependency. |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (RED first) | `Intl` local resolution; 30-minute, overnight, 09:00–18:00, 180-minute minimum, and DST rejection; exact adapters, permissions, stale retry policy. | Vitest pure tests before implementation. |
| Service/controller | Reservation check-in, walk-in snapshot, early amendment, checkout, cleaning, PII-safe audit, atomic rollback/idempotency. | Mocked transaction ordering and HTTP permission/contract tests. |
| PostgreSQL integration | Composite scope FKs, active-stay uniqueness, `[)` overlap exclusion, adjacent intervals, concurrent claims, migration backfill. | Rolled-back `pg` transactions following `database.integration.spec.ts`. |
| UI | Persistent-only arrivals/departures, loading/error/reconciliation, no payment controls. | Vitest component/reducer tests; no E2E runner exists. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

`0005` first adds nullable UTC fields and configuration, seeds each property with day-use 09:00–18:00, 180-minute minimum, and 30-minute granularity, validates every property timezone and legacy mapping, then backfills each civil reservation as local 15:00 check-in and 11:00 check-out. It aborts on invalid/ambiguous conversion or resulting active overlap; only then makes fields required, replaces `reservations_no_active_overlap` with a GiST `[)` exclusion constraint, and adds active-stay partial uniqueness. Legacy civil dates remain immutable compatibility shadows and are populated for new records. Rollback disables interval/lifecycle commands and restores the prior application while shadows remain; it must not resume the civil-date API for interval-only day-use records.

## Open Questions

None.
