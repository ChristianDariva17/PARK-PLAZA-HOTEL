# Persistent Stay Lifecycle Specification

## Purpose

Define property-scoped, auditable occupancy from check-in through cleaning, with a minimal zero-balance folio.

## Requirements

### Requirement: Reservation-backed check-in

The system MUST create exactly one persistent stay and one zero-opening-balance folio when an eligible reservation is checked in. The stay MUST reference the same property, room, reservation, and active identified guests, and MUST record an auditable lifecycle event.

#### Scenario: Check in an eligible reservation
- GIVEN a reservation at the requested property, an available room, and only active identified guests
- WHEN an authorized user checks in
- THEN one active stay, one minimal zero-balance folio, and one audit event persist

#### Scenario: Reject invalid check-in atomically
- GIVEN a reservation with an unavailable room or inactive/unidentified guest
- WHEN check-in is requested
- THEN the request fails with a conflict/validation outcome and creates no stay, folio, or audit event

### Requirement: Persistent check-out and cleaning gate

The system MUST atomically close a stay, complete its reservation, and set its room to `cleaning`. A room in `cleaning` MUST NOT accept a future check-in until an explicit cleaning completion changes it to `available`.

#### Scenario: Check out a stay
- GIVEN an active stay and its room
- WHEN an authorized user checks out
- THEN the stay closes, the reservation completes, and the room becomes `cleaning` together

#### Scenario: Complete cleaning before reuse
- GIVEN a checked-out room in `cleaning`
- WHEN check-in is attempted before cleaning completion
- THEN check-in fails and the room remains `cleaning`
- AND after explicit cleaning completion, the room is `available`

### Requirement: Scope, authorization, and conflict safety

Operations MUST be restricted to the target property and authorized users. Concurrent or repeated lifecycle commands MUST produce one committed outcome; stale or duplicate commands MUST return an idempotent result or a conflict without partial records.

#### Scenario: Cross-property access
- GIVEN a user or resource belonging to another property
- WHEN a lifecycle command is submitted
- THEN it is rejected without changing either property

#### Scenario: Concurrent check-in
- GIVEN two requests target the same eligible reservation or room
- WHEN both execute concurrently
- THEN at most one stay is created and the other receives an idempotent success or explicit conflict

### Requirement: Explicit scope exclusions

This capability MUST NOT require ledger operations, charges, payments, refunds, balance enforcement, room moves, split or multi-room stays, overbooking, or manual room-state overrides.

#### Scenario: Folio remains minimal
- GIVEN a newly created stay
- WHEN its folio is inspected
- THEN it has a zero opening balance and no ledger, payment, refund, or charge operation is performed
