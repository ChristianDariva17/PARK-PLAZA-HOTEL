# Walk-in Stays Specification

## Purpose

Define walk-in occupancy as a transactional reservation, stay, folio, and historical rate snapshot.

## Requirements

### Requirement: Atomic walk-in creation

The system MUST allow an authorized user to check in a walk-in only when the selected room is available and every guest is active and persistently identified. It MUST atomically create a property-scoped reservation, active stay, zero-opening-balance folio, audit event, and catalog-rate snapshot.

#### Scenario: Create an eligible walk-in
- GIVEN an available room and active guests with persistent identities
- WHEN an authorized user checks in the walk-in
- THEN the reservation, stay, folio, audit event, and rate snapshot are all committed

#### Scenario: Roll back a rejected walk-in
- GIVEN an unavailable room or an inactive/unidentified guest
- WHEN walk-in check-in is requested
- THEN it fails and none of the reservation, stay, folio, audit, or snapshot records remain

### Requirement: Historical catalog rate snapshot

The walk-in reservation MUST preserve the catalog rate applicable at creation as historical data. Later catalog changes MUST NOT alter that reservation snapshot.

#### Scenario: Preserve the creation rate
- GIVEN a catalog rate at walk-in creation
- WHEN the catalog rate is later changed
- THEN the reservation continues to expose the original snapshot

### Requirement: Idempotent and property-scoped conflicts

Walk-in commands MUST be scoped to one property and MUST handle concurrent or retried requests without duplicate reservations or stays. A stale availability or identity conflict MUST leave no partial records.

#### Scenario: Retry the same walk-in
- GIVEN a committed walk-in request with the same idempotency identity
- WHEN the request is retried
- THEN the original result is returned and no second stay or reservation is created

#### Scenario: Concurrent room claim
- GIVEN two walk-ins target the same room and overlapping interval
- WHEN both requests execute concurrently
- THEN one succeeds and the other receives a conflict with no partial records

### Requirement: Explicit scope exclusions

This capability MUST NOT perform ledger entries, charges, payments, refunds, taxes, fiscal processing, gateways, room moves, split or multi-room stays, overbooking, or manual room-state overrides.

#### Scenario: No payment workflow
- GIVEN a successful walk-in
- WHEN its initial records are inspected
- THEN only the minimal zero-balance folio exists and no payment or charge is created
