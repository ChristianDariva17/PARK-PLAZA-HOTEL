# Interval Reservation Availability Specification

## Purpose

Define property-local reservation intervals while preserving compatibility with civil-date reservations.

## Requirements

### Requirement: Property-local UTC-backed intervals

The system MUST store reservation and stay boundaries as UTC instants while evaluating them in the property's configured timezone. Valid boundaries MUST use 30-minute intervals, including selectable overnight times and configured day-use windows.

#### Scenario: Overnight interval
- GIVEN a property timezone and a stay crossing local midnight
- WHEN availability is evaluated
- THEN local boundaries are interpreted correctly and persisted as UTC instants

#### Scenario: Invalid interval
- GIVEN a boundary not aligned to 30 minutes or outside the configured day-use window
- WHEN a reservation is requested
- THEN it is rejected without changing availability

### Requirement: Overlap and room-state availability

The system MUST reject overlapping intervals for the same room and property, and MUST reject any room not in `available`, including `cleaning`. Availability checks MUST be safe under concurrent requests.

#### Scenario: Non-overlapping intervals
- GIVEN an available room with an existing interval
- WHEN a non-overlapping 30-minute interval is requested
- THEN it is accepted

#### Scenario: Overlap or cleaning conflict
- GIVEN an overlapping reservation or a room in `cleaning`
- WHEN a check-in or reservation is requested
- THEN it fails with a conflict and creates no partial records

### Requirement: Audited early check-in

The system MAY permit check-in up to one local day before the reservation start only when the interval and room are available. Such a change MUST atomically update the reservation, preserve its audit trail, and fail without mutation on conflict.

#### Scenario: Eligible early check-in
- GIVEN an eligible reservation, available room, and requested start no more than one local day early
- WHEN early check-in is authorized
- THEN the reservation interval and audit event update together

#### Scenario: Ineligible early check-in
- GIVEN a request more than one local day early or an unavailable room
- WHEN early check-in is requested
- THEN it is rejected and the original reservation interval remains unchanged

### Requirement: Civil-date migration compatibility

The system MUST continue to interpret existing civil-date reservations consistently during migration, without silently changing their property, room, or occupancy meaning. New interval behavior MUST remain observable as equivalent boundaries where legacy dates are used.

#### Scenario: Existing reservation remains usable
- GIVEN a pre-migration civil-date reservation
- WHEN availability or check-in is evaluated
- THEN its legacy occupancy range remains honored under the property's local calendar

#### Scenario: Migration conflict
- GIVEN legacy data that cannot map unambiguously to a valid interval
- WHEN it is evaluated
- THEN the operation fails explicitly and does not silently create an overlapping reservation
