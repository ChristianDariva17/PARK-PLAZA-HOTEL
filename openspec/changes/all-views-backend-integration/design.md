# Design: All Views Backend Integration

## Technical Approach

Backend remains the sole authority. Extend the existing administrative `authRequest` clients and isolated customer portal API boundary into contract-gated resources. A route is authoritative only after its admission matrix is approved and its verification passes; otherwise it renders a reusable blocked state. This implements `frontend-resource-boundary`, `authoritative-domain-views`, and `contract-gated-views` without activating unverified APIs.

## Architecture Decisions

| Decision | Options / tradeoff | Choice and rationale |
|---|---|---|
| Authority boundary | Keep `HotelContext`/reducer as domain truth; or use Backend responses | Backend DTOs/transitions are truth. Retire a migrated domain's reducer/mock/prototype authority in the same cut; retain drafts, filters, selections, and retry keys only. `HotelContext` currently owns broad prototype state, so migration is domain-by-domain. |
| Session separation | Share admin context with portal; or isolated clients | Keep `Fronted/src/auth/AuthContext.jsx` administrative sessions separate from `Fronted-Cliente/src/AuthContext.jsx` customer sessions. Admin identity, permissions, and property context must never reach customer requests; the customer cookie/guard remains its authority. |
| Contract admission | Route-by-route judgement; or auditable matrix | Require a versioned per-domain matrix: mounted route, endpoint, canonical DTO/adapter, admin/customer session, permission, server property predicate, error mapping, exact-money format, idempotency requirement, invalidation set, and tests. Missing one entry means blocked. This permits integration only for verified contracts. |
| Failure model | Optimistic/local success; or reconciliation | Commands retain one stable idempotency key through retry, serialize exact values, then accept only the canonical response. Abort/superseded reads cannot replace newer state; transport ambiguity, 404, or 409 disables resubmission until targeted refresh reconciles. Existing cleaning/stay clients establish this pattern. |

## Data Flow

```text
mounted route -> admission gate -> [blocked state | domain resource]
domain resource -> admin authRequest OR customer API -> Backend guard/service
Backend canonical DTO/error -> adapter -> view state
command -> stable key -> Backend response -> targeted invalidation/refresh
```

The gate is explicit UI state: route title plus “Backend contract not verified”; no domain data, simulated success, or mutation controls. A settled successful read with zero records renders an explicit empty, non-authoritative state rather than mock or retained local data. Permission hiding is presentation only; Backend enforces permission and property scope. Map 401 to session recovery, 403 forbidden, 404 absent/stale, 409 reconciliation, and 422 validation; retry only safe reads or the same keyed command.

## File Changes

| File | Action | Description |
|---|---|---|
| `Fronted/src/auth/authClient.js` and `Fronted/src/*/*Client.js` | Modify when admitted | Consolidate authenticated request, DTO/error adapters, cancellation, keys, and invalidation while preserving client conventions. |
| `Fronted/src/App.jsx`, `Fronted/src/state/HotelContext.jsx`, `Fronted/src/components/views/**` | Modify per domain | Apply admission/blocked rendering and remove migrated local authority. |
| `Fronted-Cliente/src/api*`, `Fronted-Cliente/src/App.jsx`, `Fronted-Cliente/src/AuthContext.jsx` | Modify when admitted | Keep customer-only resources and route gating isolated. |
| `Backend/src/**`, `Backend/test/**` | Modify only for verified prerequisite defects | Enforce contracts; no unrelated business-rule changes. |
| `Fronted/src/**/*.test.*`, `Fronted-Cliente/src/**/*.test.*` | Create/modify per domain | Contract, reconciliation, and route-state coverage. |

## Interfaces / Contracts

```ts
type ContractMatrix = {
  route: string; endpoint: string; dto: string; session: 'admin' | 'customer';
  permission?: string; propertyScope: 'server-enforced'; errors: readonly number[];
  idempotency: 'required' | 'not-applicable'; invalidates: readonly string[];
  approved: boolean; verified: boolean;
};
```

Activation requires `approved && verified`; disabling either returns the route to blocked state. Migrate in proposal order: hotel/finance, operations/restaurant, staff/events, compliance/platform, dashboard/reports. Within each domain: matrix -> read states -> safe commands -> reconciliation -> remove local authority -> cross-view verification.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit | adapters, exact values, normalized 401/403/404/409/422, cancellation, replay, and settled empty reads | Vitest client/resource tests; assert an empty response renders the explicit empty state and no stale/local transition. |
| Integration | permission/property isolation and canonical command replay | Backend + frontend contract tests, including foreign identifiers and ambiguous refresh. |
| Route smoke | every mounted admin/customer route | Assert loading, explicit empty, error/forbidden, retry, and authoritative lifecycle when admitted; otherwise visible blocked state with no data/actions. No E2E runner exists. |

## Threat Matrix

| Boundary | Applicability | Design response / RED tests |
|---|---|---|
| Documentation-like paths | N/A — no executable classification | None. |
| Git repository selection | N/A — no VCS integration | None. |
| Commit state | N/A — no commit automation | None. |
| Push state | N/A — no push automation | None. |
| PR commands | N/A — no PR automation | None. |

## Migration / Rollout

Enable one admitted domain at a time. On failed verification, disable its matrix/capability, preserve Backend records and idempotency evidence, and return to blocked state; never restore mock writes/data. Scope is limited to approved domain matrices, authoritative reads and safe commands, local-authority retirement, and blocked states for unverified contracts. RDD stays disabled and is not invoked.

## Open Questions

- [ ] Which domains have a complete, approved admission matrix at implementation start?
