# Route Admission Matrix

**Status:** Confirmed administrative and customer contract families are admitted. Dashboard, reports, and unsupported customer marketing/VIP routes remain intentionally blocked. Admitted routes retain Backend authority for identity, permissions, property scope, canonical data, and mutations.

| Session | Mounted routes (historical pre-connection snapshot) | Endpoint | DTO | Permission / server property scope | Errors | Money | Idempotency | Invalidation | Approved | Verified |
|---|---|---|---|---|---|---|---|---|---|---|
| Admin | `dashboard`, `habitaciones`, `reservas`, `contratos`, `checkin-checkout`, `finanzas`, `clientes`, `limpieza`, `mantenimiento`, `incidencias`, `evidencias`, `notificaciones`, `pedidos-qr`, `inventario`, `cocina-bar`, `proveedores`, `cochera`, `mascotas`, `recreacion`, `eventos`, `calendario-eventos`, `encuestas`, `personal`, `personal-directorio`, `caja`, `reportes`, `cuentas-acceso`, `roles`, `auditoria`, `configuracion` | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | No | No |
| Customer | `/`, `/habitaciones`, `/room-service`, `/terraza`, `/bar`, `/piscina`, `/eventos`, `/mirador`, `/vip`, `/login`, `/registro` | Unverified | Unverified | Customer session; server scope unverified | Unverified | Unverified | Unverified | Unverified | No | No |

## Current Admission (2026-08-31)

| Session | Admitted mounted routes | Canonical endpoint family | Authoritative scope | Blocked routes |
|---|---|---|---|---|
| Admin | `habitaciones`, `reservas`, `contratos`, `checkin-checkout`, `finanzas`, `clientes`, `limpieza`, `mantenimiento`, `incidencias`, `evidencias`, `notificaciones`, `pedidos-qr`, `inventario`, `cocina-bar`, `proveedores`, `cochera`, `mascotas`, `recreacion`, `eventos`, `calendario-eventos`, `encuestas`, `personal`, `personal-directorio`, `caja`, `cuentas-acceso`, `roles`, `auditoria`, `configuracion` | Admin cookie/session; controller derives or validates property scope. Documents use `/api/api/documents/...`; communications, surveys, and experiences use `/api/properties/:propertyId/...`. | `account.propertyId` from `GET /api/auth/session` is the only client path parameter source; Backend retains permission and property enforcement. | `dashboard`, `reportes` |
| Customer | `/habitaciones`, `/room-service`, `/terraza`, `/bar`, `/piscina`, `/login`, `/registro` | `/api/customer/auth/*`, `/api/customer/reservations/*`, `/api/customer/restaurant/*`, `/api/customer/amenities/reservations` | Customer cookie/session only. The configured portal property is resolved by Backend and customer requests never receive admin account, permissions, or property context. | `/`, `/eventos`, `/mirador`, `/vip` |

All admitted records have canonical DTO adapters, mapped 401/403/404/409/422 errors, exact-decimal money handling where applicable, stable keyed commands where required, and targeted refresh/resource invalidation. Amenity reservations have no Backend idempotency-key requirement and therefore remain `not-applicable`; the client does not invent one as a contract requirement.

## Activation Rule

A route can be activated only when its record has a canonical endpoint and DTO, the correct isolated session authority, permission and server-enforced property scope, mapped 401/403/404/409/422 errors, exact-decimal money representation, idempotency policy, invalidation set, and both approval and verification. Until then the route must render the static blocked view without domain data or mutation controls.

## Historical Pre-Connection Contract Evidence (2026-08-31)

The Backend was inspected before the connection work unit. The entries below preserve the former blocked-state evidence; the Current Admission section supersedes it for routes explicitly listed there. Routes not listed in Current Admission remain blocked.

| Domain / mounted route | Concrete Backend route and session boundary | DTO / scope evidence | Why it remains blocked |
|---|---|---|---|
| Admin `reservas` | `GET /api/reservations`, `GET /api/reservations/:id`, `POST /api/reservations`, and keyed lifecycle commands; admin session guard | `ReservationDetailTransport` uses exact-decimal strings; controller derives `propertyId` from the authenticated account and checks named permissions | The mounted view still has prototype authority and lacks the complete view-level error, retry, invalidation, and runtime-contract proof. |
| Admin `habitaciones`, `checkin-checkout`, `finanzas`, `clientes` | Rooms, stays, folios/receivables, and guests controllers are present under the admin session guard | Property IDs are derived from the authenticated account in the verified controller patterns; money fields are stored as numeric strings in folio/reservation schemas | A route-by-route DTO/error/idempotency/invalidation matrix and mounted-view proof are not complete. |
| Admin `limpieza`, `mantenimiento`, `incidencias` | Cleaning and incident controllers expose scoped administrative routes | Cleaning requires named permissions; incident/room schemas carry `propertyId` | The view/client contracts do not yet prove all failure and reconciliation paths. |
| Admin `pedidos-qr`, `cocina-bar`, `inventario` | `GET/POST/PATCH /api/restaurant/*`; order commands use `Idempotency-Key` and controller permissions | Restaurant service scopes reads/writes to `actor.propertyId`; order receipts persist per property and exact prices are decimal strings | The different mounted views share incomplete adapters and have no complete per-view admission verification. |
| Admin `personal`, `personal-directorio` | `GET/POST/PATCH /api/staff/*` plus `/api/attendance/*`; admin session and named staff permissions | Staff controller passes `actor.propertyId` into each service call | The staff UI has not demonstrated the complete command/reconciliation matrix. The resource-hook import was repaired only to restore the build; the route stays blocked. |
| Admin `eventos`, `calendario-eventos` | `/api/events` endpoints require explicit event permissions | Events controller exposes list/detail/create/update/lifecycle commands | Mounted calendar/list adapters and required verification evidence are incomplete. |
| Admin `proveedores`, `cuentas-acceso`, `roles`, `auditoria`, `configuracion`, `contratos`, `evidencias` | Supplier, accounts, roles, audit, settings, and documents controllers/clients exist | These routes use the admin session boundary; several schemas include `propertyId` | Contract coverage is uneven and no complete approved DTO/error/idempotency/invalidation matrix exists for each mounted view. |
| Admin `dashboard`, `reportes`, `notificaciones`, `cochera`, `mascotas`, `recreacion`, `encuestas` | Some related controllers or schemas exist; others have no matching mounted-route contract | No single canonical response/adaptor matrix is evidenced for the mounted UI | The route must remain blocked rather than infer authority from prototype state or partial APIs. |
| Customer `/habitaciones` | `GET /api/customer/reservations/availability` is public for the configured portal property; booking/detail use `CustomerSessionGuard` | Customer reservation DTO parsing and keyed booking commands are implemented; the customer cookie is distinct from the admin cookie | The mounted route is not yet mapped to a complete approved customer resource, error, and invalidation matrix. |
| Customer `/room-service`, `/bar`, `/terraza` | Public menu and guarded customer orders/active stays are under `/api/customer/restaurant/*` | Customer order create/cancel require `CustomerSessionGuard` and `Idempotency-Key`; scope is customer identity plus configured property | The shared UI route mapping and complete reconciliation proof are incomplete. |
| Customer `/piscina` | Guarded `/api/customer/amenities/reservations` routes exist | The service receives the customer session, but the create route has no idempotency-key contract | The required idempotency policy and mounted UI proof are incomplete. |
| Customer `/`, `/eventos`, `/mirador`, `/vip`, `/login`, `/registro` | Customer authentication endpoints exist at `/api/customer/auth/*`; no complete endpoint matrix exists for each mounted content route | `CustomerSessionGuard` reads only `CUSTOMER_COOKIE_NAME`; it does not consume admin session identity, permissions, or property context | Content/API contracts are absent or incomplete, so these routes remain explicitly blocked. |

### Session Isolation Evidence

- Administrative requests use `/api/auth/*` and the `AUTH_COOKIE_NAME` cookie. `SessionGuard` resolves that cookie into `request.auth`.
- Customer requests use `/api/customer/*` and the independent `CUSTOMER_COOKIE_NAME` cookie. `CustomerSessionGuard` resolves it into `request.customer`.
- No customer matrix is admitted by inheriting administrative account, permission, or property fields.

### Remaining Verification Required for Any Admission

For every individual mounted route: approve the exact DTO adapter and endpoint set; prove 401/403/404/409/422 mapping, exact-money serialization where applicable, idempotency replay, targeted invalidation, stale-read cancellation, property isolation, and a real route/runtime path. Until that evidence exists, the explicit blocked state is the only permitted UI behavior.

## Rollback

Set `approved` or `verified` to `false` for a domain and it returns to the same blocked view. Do not re-enable reducer, mock, or prototype writes. RDD remains disabled and was not invoked.
