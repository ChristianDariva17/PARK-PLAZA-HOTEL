# Contract-Gated Views Specification

## Purpose

Keep mounted views safe and discoverable when their Backend contracts are not verified.

## Requirements

### Requirement: Explicit blocked state

An unverified route MUST remain visible when mounted, MUST identify that its Backend contract is blocked, and MUST provide no mock data, simulated success, or actionable domain mutation controls.

#### Scenario: Unknown contract access

- GIVEN a route lacks an approved endpoint, DTO, permission, scope, error, or idempotency matrix
- WHEN a user opens it
- THEN the view renders an explicit blocked state and no domain data or mutation action

#### Scenario: Contract becomes verified

- GIVEN the complete matrix is approved and verification succeeds
- WHEN the capability is enabled
- THEN the route may expose authoritative reads and safe commands through the shared boundary

#### Scenario: Rollback or failed verification

- GIVEN a migrated domain fails verification or is rolled back
- WHEN the capability is disabled
- THEN the route returns to the explicit blocked state without restoring mock writes or data
