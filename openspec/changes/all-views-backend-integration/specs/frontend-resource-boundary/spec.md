# Frontend Resource Boundary Specification

## Purpose

Define the shared authenticated resource boundary used by administrative and customer views without making local state authoritative.

## Requirements

### Requirement: Canonical resource access

The system MUST expose typed authenticated resources that normalize Backend DTOs and errors, cancel obsolete reads, and preserve the customer-session boundary separately from administrative access.

#### Scenario: Successful scoped read

- GIVEN an authenticated user and approved property context
- WHEN a view requests a Backend resource
- THEN the canonical DTO is presented with loading and settled states

#### Scenario: Rejected or obsolete read

- GIVEN a request is unauthorized, malformed, or superseded
- WHEN the response is received
- THEN the view exposes a normalized error or ignores the obsolete response without changing current data

### Requirement: Safe command reconciliation

Commands MUST serialize exact values, carry a stable idempotency key, and treat the canonical Backend response as authoritative; ambiguous outcomes MUST be recoverable by refresh and MUST NOT create local success.

#### Scenario: Duplicate command replay

- GIVEN the same command is submitted again with its idempotency key
- WHEN Backend responds
- THEN the UI reconciles to the single canonical result and does not duplicate the transition

#### Scenario: Targeted invalidation

- GIVEN a command changes one resource
- WHEN it succeeds
- THEN only affected resources are invalidated or refreshed without a full-page reload
