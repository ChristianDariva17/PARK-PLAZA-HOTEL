# Authoritative Domain Views Specification

## Purpose

Ensure every migrated mounted administrative or customer view uses verified Backend data, identity, permissions, scope, and transitions.

## Requirements

### Requirement: Verified Backend authority

Each migrated domain MUST have an approved endpoint, DTO, permission, property-scope, error, and idempotency matrix before activation. Equivalent reducer, mock, or prototype authority MUST be removed in the same migration cut; UI-only drafts, filters, selections, and retry keys MAY remain.

#### Scenario: Verified view lifecycle

- GIVEN a domain matrix is approved and its route is mounted
- WHEN the view reads or performs an allowed command
- THEN it renders canonical Backend state and reconciles the returned transition

#### Scenario: Loading, empty, forbidden, and retry states

- GIVEN a read has no data or returns 401, 403, 404, 409, or 422
- WHEN the view settles
- THEN it shows the corresponding non-authoritative state and offers retry only when safe

#### Scenario: Property isolation

- GIVEN a user supplies an identifier from another property
- WHEN a read or command is processed
- THEN Backend rejects it and the view changes no local domain state

### Requirement: Customer-session isolation

Customer resources MUST use the customer-session authority and MUST NOT inherit administrative identity, permissions, or property context from the administrative boundary.

#### Scenario: Customer action

- GIVEN a valid customer session
- WHEN the customer requests an allowed resource or command
- THEN only that session's authorized Backend result is rendered
