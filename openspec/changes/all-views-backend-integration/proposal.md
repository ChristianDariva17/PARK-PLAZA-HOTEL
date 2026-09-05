# Proposal: All Views Backend Integration

## Intent

Make Backend the only authority for data, identity, permissions, property scope, and domain transitions in every mounted administrative and customer view. Replace hybrid/local prototype behavior with confirmed server reads and safe commands; do not make unverified contracts appear functional.

## Scope

### In Scope
- Establish a shared administrative API/resource boundary and retain the separate customer-session boundary.
- Migrate each domain only after its verified reads and safe mutations provide loading, empty, error, forbidden, retry, permission, and property-isolation behavior.
- Remove that domain's equivalent reducer/prototype/mock authority in the same migration cut; retain only UI drafts, filters, selections, and retry keys.
- Keep unverified contracts visible but explicitly blocked, with no mock data or actionable controls.
- Reconcile mounted routes, endpoint/permission/DTO/error/idempotency matrices, invalidation, and cross-view verification.

### Out of Scope
- Inventing, activating, or simulating Backend APIs for blocked domains.
- Changing unrelated Backend business rules or enabling RDD/receipt-driven tooling.
- Public booking, amenities, VIP, reporting, recreation, notifications, communications, experiences, documents, surveys, roles, or settings before their contracts are verified.

## Capabilities

### New Capabilities
- `frontend-resource-boundary`: Typed authenticated clients, canonical DTO adapters, normalized errors, cancellation, idempotent-command recovery, and targeted invalidation.
- `authoritative-domain-views`: Mounted administrative and customer views consume confirmed Backend reads/mutations and retire equivalent local authority.
- `contract-gated-views`: Unverified routes remain visible, non-actionable, and explicitly blocked until their contract matrix is approved and verified.

### Modified Capabilities
- None. Existing reservation and stay specifications remain Backend lifecycle contracts; this change integrates against them without changing their requirements.

## Approach

Freeze and verify each contract matrix first. Build the shared boundary, then migrate domains in dependency order: hotel/finance, operations/restaurant, staff/events, compliance/platform, then dashboard/reports. A domain is ready only when confirmed responses reconcile UI state, Backend rechecks authorization and property scope, ambiguous writes preserve their idempotency key, and all local/prototype authority is removed in that same cut.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `Fronted/src/auth`, `state`, domain clients/views | Modified | Authoritative administrative resources and route gates |
| `Fronted-Cliente/src` | Modified | Isolated customer-session resources and commands |
| `Backend/src/*` | Modified when verified | Contract defects, permissions, scope, and idempotency prerequisites |
| `openspec/changes/all-views-backend-integration` | New | Reconciled SDD artifacts and matrices |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Contract/permission mismatch exposes false readiness | High | Block until route, DTO, permission, scope, and errors are verified |
| Duplicate or cross-property command | Medium | Server scope checks, idempotency, conflict refresh, security scenarios |
| Financial/room-state divergence | Medium | Exact-money DTOs, canonical responses, targeted reconciliation |

## Rollback Plan

Revert by domain boundary, disable its capability, and preserve Backend records plus idempotency/request evidence. Do not restore mock writes; return the domain to its explicit blocked state until reconciliation completes.

## Dependencies

- Verified Backend prerequisites: startup/contracts, money, stay lifecycle, folio charges, staff operations, and independent administration.
- Approved endpoint/permission/DTO/property/error/idempotency matrix per domain.

## Success Criteria

- [ ] Every mounted view is either authoritative and verified or explicitly blocked without mock actions/data.
- [ ] Ready domains pass reads, safe mutations, loading/error/forbidden, permission, property-isolation, idempotency, and stale-response scenarios.
- [ ] No migrated domain retains local/prototype authority for Backend-owned data or transitions.
- [ ] RDD remains disabled and is neither enabled nor invoked.
