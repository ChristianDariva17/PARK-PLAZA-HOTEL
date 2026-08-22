# Proposal: Persistent Stays Check-in and Check-out

## Intent

Replace the reception demo workflow with persistent, auditable occupancy. Reservations remain booking contracts; stays record actual occupancy.

## Scope

### In Scope
- Persist property-scoped stays and zero-opening-balance folios.
- Check in reservations and walk-ins; each walk-in atomically creates a reservation, stay, and catalog-rate snapshot.
- Check out atomically: close stay, complete reservation, and set the room to `cleaning`.
- Require active identified guests and an `available` room; cleaning explicitly restores availability.
- Replace civil-date availability with UTC-backed, property-local 30-minute intervals, configurable day-use windows, overnight times, and eligible audited one-day early check-in.

### Out of Scope
- Ledger entries, charges, payments, refunds, balance enforcement, tax/fiscal, or gateways.
- Room moves, split/multi-room stays, overbooking, fixed buffers, and manual overrides.

## Capabilities

### New Capabilities
- `persistent-stay-lifecycle`: Stays, minimal folios, transactional lifecycle, status, identity, permission, and audit invariants.
- `walk-in-stays`: Atomic reservation/stay creation with historical current-rate snapshots.
- `interval-reservation-availability`: Property-local overnight, day-use, and early-check-in interval rules.

### Modified Capabilities
None — `openspec/specs/` has no established capability specs. The interval capability formalizes a change to the existing civil-date reservation contract.

## Approach

Use row locking and guarded transactions. Store UTC instants, apply property-local boundary rules, and separate operational status from inventory. Replace only reception demo commands. Suggested slices: interval contract, lifecycle/walk-ins, reception integration.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `Backend/src/database/schema/reservations.schema.ts` | Modified | Interval contract and links. |
| `Backend/src/database/schema/hotel.schema.ts` | Modified | Stay/folio and room status. |
| `Backend/src/reservations/` | Modified | Atomic availability and audit. |
| `Fronted/src/components/views/checkin/CheckInOutView.jsx` | Modified | Persistent reception. |
| `Fronted/src/state/HotelContext.jsx` | Modified | Stay commands and reconciliation. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hourly intervals alter the civil-date contract and likely exceed 400 changed lines. | High | Specify compatibility and independently reviewable slices. |
| Concurrent/stale operations conflict. | Medium | Constraints, row locks, guarded transitions, audit. |
| Local-time boundaries misclassify intervals. | Medium | UTC persistence and local boundary scenarios. |

## Rollback Plan

Disable persistent commands, restore civil-date availability, and revert application/migration releases together. Preserve created history and snapshots.

## Dependencies

- Property timezone/day-use configuration and catalog rate snapshot contract.
- Migration and `stays.*` grants; cleaning must explicitly set `available`.
- This is an oversized delivery risk: resolve chained/stacked slices before apply under `ask-on-risk`.

## Success Criteria

- [ ] Reservation and walk-in check-ins persist one stay, reservation, audit record, and zero-balance folio; conflicts leave no partial records.
- [ ] Check-out closes the stay, sets its room to `cleaning`, and blocks another check-in until `available`.
- [ ] Availability rejects overlapping 30-minute intervals and accepts valid local overnight, day-use, and early check-in.
