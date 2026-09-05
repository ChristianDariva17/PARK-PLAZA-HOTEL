# Tasks: All Views Backend Integration

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,200–1,800 authored lines across shared clients, admitted views, blocked states, tests, and prerequisite fixes |
| 400-line budget risk | High |
| Chained PRs recommended | No — authorized single-PR size exception |
| Suggested split | One PR under documented `size:exception` |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Authorized exception: maintainers approved one oversized PR because the cross-view migration must preserve one contract-gated rollout and rollback boundary. Keep work-unit commits, tests with behavior, and exact verification evidence.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Shared contract admission and resource boundary | Single PR | `cd Fronted && npm test -- --run` | Admin login/property switch; customer session isolation | `Fronted/src/auth`, resource clients, gates |
| 2 | Domain migrations and blocked fallbacks | Single PR | `cd Fronted && npm test -- --run` | Mounted routes against verified Backend contracts | Each domain's providers/views; unverified routes remain blocked |
| 3 | Cross-view verification and cleanup | Single PR | `cd Backend && npm run test:integration` | Admin/customer route smoke pass; no E2E runner exists | Integration tests, matrices, docs only |

## Phase 1: Contract Foundation

- [x] 1.1 Inventory every mounted `Fronted` and `Fronted-Cliente` route; create the admission matrix with route, endpoint, DTO, session, permission, server scope, errors, money, idempotency, invalidation, approval, and verification. Corrective evidence on 2026-08-31 records the concrete Backend/controller/session findings; no domain was admitted without complete verification.
- [x] 1.2 Add the shared admin resource boundary in `Fronted/src/auth/authClient.js` and domain clients; normalize DTO/errors, cancel obsolete reads, serialize exact values, preserve keyed commands, and target invalidation.
- [x] 1.3 Add reusable blocked rendering in `Fronted/src/App.jsx` and customer routing; any incomplete or failed matrix must show Backend-contract-blocked state with no data or mutation controls.
- [ ] 1.4 Add RED tests for unauthorized/cross-property access, malformed money, duplicate replay, obsolete reads, and customer/admin session separation; assert no local state change.

## Phase 2: Ordered Domain Integration

- [x] 2.1 Wire confirmed administrative contract families to their existing clients/resources. Dashboard, reports, and unsupported QR routes remain blocked.
- [x] 2.2 Update `Fronted-Cliente/src/api*`, `App.jsx`, and `AuthContext.jsx` only for approved customer-session matrices; never inherit admin identity, permissions, or property context.
- [ ] 2.3 For every migrated domain, remove equivalent reducer/mock/prototype authority in the same cut; retain only drafts, filters, selections, pagination, and retry keys.
- [ ] 2.4 Modify `Backend/src/**` and `Backend/test/**` only for verified prerequisite contract defects; preserve server authorization, property predicates, canonical transitions, and idempotency evidence.

## Phase 3: Verification and Rollback

- [ ] 3.1 Test successful scoped reads, settled empty, loading, 401/403/404/409/422 mapping, safe retry, canonical command replay, targeted refresh, and stale-response suppression.
- [ ] 3.2 Verify each mounted route is authoritative only when `approved && verified`; otherwise assert visible blocked state, no mock data/actions, and rollback returns to that state.
- [ ] 3.3 Run `cd Fronted && npm test`, `cd Fronted-Cliente && npm test`, `cd Backend && npm run test:integration`, and `cd Backend && npx tsc --noEmit`; record exact results and contract gaps.
- [ ] 3.4 Remove duplicate wrappers/demo writes and document matrix assumptions, per-domain rollout/rollback boundaries, and that RDD remains disabled and uninvoked.

## Work Unit: Connect Confirmed Backend Contracts

- [x] Connect the verified admin and customer contract families, correct document and property-scoped paths, preserve isolated cookies, and keep unsupported routes visibly blocked.

## Work Unit: Fix Customer Session 500

- [x] Bypass the global staff session guard before any staff-cookie lookup on public customer authentication routes; preserve customer session enforcement and its 401 contract.
