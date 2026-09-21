# Inventario API de Fase 0

Fecha de referencia: 2026-09-17  
Prefijo actual: `/api`  
Fuente: decoradores de controladores bajo `Backend/src/`

## Cómo leer esta matriz

- Las rutas son relativas al `@Controller`; el prefijo `/api` se aplica en `Backend/src/main.ts`.
- `Staff RBAC` significa que la clase o método usa `SessionGuard` global y uno o más `@RequirePermissions`.
- `Customer guard` significa que la clase es pública para permitir el guard global, pero la operación protegida usa `CustomerSessionGuard`.
- `Idempotencia parcial` significa que existe en algunas mutaciones del grupo, no necesariamente en todas.
- `Revisar` no significa vulnerabilidad confirmada; significa que Fase 3 debe comprobarlo contra OpenAPI, consumidores y pruebas.

## Matriz de superficie

| Grupo | Controller | Rutas observadas | Exposición y autorización | Idempotencia/paginación | Estado |
| --- | --- | --- | --- | --- | --- |
| Auth staff | `auth/auth.controller.ts` | `POST login`, `GET google/challenge`, `POST google`, `GET session`, `POST change-password`, `POST logout` | Login/Google públicos; sesión protegida por `SessionGuard`; throttles específicos | No aplica a login; cambio de contraseña requiere política explícita | Documentado parcialmente |
| Auth customer | `customer/customer-auth.controller.ts` | `POST session`, `GET session`, `POST logout` | Clase pública; sesión usa `CustomerSessionGuard`; exchange throttled | No aplica a exchange; revisar logout/replay | Documentado parcialmente |
| Health | `health/health.controller.ts` | `GET live`, `GET ready` | Público y `SkipThrottle` | No aplica | Cumple función operativa |
| Métricas | `observability/metrics.controller.ts` | `GET` | Público con `X-Metrics-Token`; obligatorio en producción | No aplica | Requiere aislamiento de ingress |
| Accounts | `accounts/accounts.controller.ts` | `GET`, `POST`, `PATCH :accountId`, `POST :accountId/reset-password`, `POST google-requests/:requestId/approve`, `POST google-requests/:requestId/reject` | Staff RBAC, principalmente `accounts.read/manage` | Mutaciones requieren revisión de header uniforme | Revisar contrato |
| Roles | `roles/roles.controller.ts` | `GET`, `GET permissions`, `POST`, `PATCH :id`, `DELETE :id` | Staff RBAC | Mutaciones requieren revisión de idempotencia | Revisar contrato |
| Settings | `settings/settings.controller.ts` | `GET`, `PUT` | Staff autenticado y permiso de settings según controller | `PUT` es mutación; revisar key | Revisar contrato |
| Audit | `audit/audit.controller.ts` | `GET` | Staff RBAC `audit.read` | Listado y filtros requieren límites documentados | Parcial |
| Guests | `guests/guests.controller.ts` | `GET`, `POST`, `PATCH :guestId` | Staff RBAC `guests.read/create/update` | `POST/PATCH` requieren idempotencia uniforme | Parcial |
| Rooms | `rooms/rooms.controller.ts` | `GET amenities`, `GET categories`, `GET categories/:categoryId/amenities`, `PUT categories/:categoryId/amenities`, `GET categories/:categoryId/audit`, `PATCH categories/:categoryId`, `GET`, `PATCH :roomId`, `PATCH :roomId/block` | Staff RBAC | Mutaciones y listados deben mapearse individualmente | Parcial |
| Reservations | `reservations/reservations.controller.ts` | `GET`, `GET availability`, `POST` | Staff RBAC | `POST` requiere key; listados requieren límite/filtros | Parcial |
| Stays | `stays/stays.controller.ts` | `GET`, `POST reservation/:id/check-in`, `POST walk-in`, `POST :id/check-out`, `POST rooms/:id/cleaning-complete` | Staff RBAC `stays.read/check_in/check_out` y limpieza | Comandos usan `Idempotency-Key` | Bien encaminado |
| Folios | `folios/folio.controller.ts` | `GET stays/:stayId/folio`, `POST charges`, `POST payments`, `POST entries/:entryId/reverse` | Staff RBAC financiero | Comandos usan header; `GET` usa offset/limit | Bien encaminado |
| Receivables | `receivables/receivables.controller.ts` | `GET`, `GET :id`, `POST :id/collections`, `POST :id/collections/:entryId/reverse` | Staff RBAC financiero | Comandos usan header; filtros sin paginación completa | Parcial |
| Cash | `cash/cash.controller.ts` | `GET session/active`, `GET sessions`, `GET movements/:sessionId`, `GET session/:sessionId/counts`, `POST session/open`, `POST session/count/:id`, `POST session/close/:id`, `POST movements` | Staff RBAC financiero/caja | Comandos usan header; listados requieren límites | Parcial |
| Cleaning | `cleaning/cleaning.controller.ts` | `GET`, `POST`, `PATCH :id`, `POST :id/progress`, `POST :id/incident` | Staff RBAC `cleaning.*` | Comandos usan UUID `Idempotency-Key` | Bien encaminado |
| Incidents | `incidents/incidents.controller.ts` | `GET`, `POST`, `PATCH :id`, `POST :id/progress` | Staff RBAC `incidents.*` | Revisar porque no todas las rutas muestran header en controller | Parcial |
| Maintenance | `maintenance/maintenance.controller.ts` | `GET`, `POST`, `PATCH :id`, `POST :id/progress` | Staff RBAC `maintenance.*` | DTO declara esquema de key; confirmar aplicación en todas las mutaciones | Parcial |
| Parking | `parking/parking.controller.ts` | `GET`, `POST`, `PATCH :id`, `POST :id/exit`, `POST :id/archive` | Staff RBAC `parking.*` | Revisar keys y paginación | Parcial |
| Pets | `pets/pets.controller.ts` | `GET`, `POST`, `PATCH :id`, `POST :id/archive`, `POST :id/reactivate` | Staff RBAC `pets.*` | Revisar keys y paginación | Parcial |
| Attendance | `attendance/attendance.controller.ts` | `GET events`, `GET kiosk-qr`, `POST scan-qr`, `POST manual`, `POST biometric`, `POST biometric/capability`, `POST corrections`, `POST corrections/:id/decide` | Staff RBAC; capability biometric throttled | Key/bridge operation depende del comando; requiere contrato de seguridad | Sensible |
| Amenities staff | `amenities/amenities.controller.ts` | `GET/PUT config`, `GET occupancy`, `GET blocks`, `POST blocks`, `GET reservations`, `POST reservations/manual`, `GET :id/tab`, `POST :id/checkin`, `PATCH :id/identity`, `POST :id/settle` | Staff RBAC `amenities.*` y caja | Mutaciones requieren revisión de key; listados requieren límites | Parcial |
| Restaurant | `restaurant/restaurant.controller.ts` | `GET menu`, `GET internal/menu`, `POST menu`, `PATCH menu/:id`, `POST menu/:id/archive`, `POST menu/:id/reactivate`, `GET inventory`, `GET inventory/ledger`, `POST inventory`, `PATCH inventory/:id`, `POST inventory/:id/adjust`, `POST inventory/:id/archive`, `POST inventory/:id/reactivate`, `GET orders`, `POST orders`, `PATCH orders/:id`, `POST orders/:id/advance`, `POST orders/:orderId/items/:itemId/advance`, `POST orders/:id/cancel` | Staff RBAC, menú interno y cocina requieren permisos específicos | Alto número de comandos; validar key, paginación y límites | Prioridad Fase 1 |
| Customer restaurant | `customer/customer-restaurant.controller.ts` | `GET menu`, `GET orders`, `GET active-stays`, `POST orders`, `POST orders/:id/cancel` | Clase pública; lecturas protegidas por `CustomerSessionGuard` donde corresponde | Comandos usan header; listados requieren límites | Parcial |
| Events staff | `events/events.controller.ts` | `GET quarantine/inventory`, `POST quarantine/:id/resolve`, `GET`, `GET spaces`, `GET spaces/:id/availability`, `GET spaces/:id/policy`, `PATCH spaces/:id/policy`, `PUT spaces/:id/services`, `POST quote`, `GET :id`, `POST`, `PATCH :id`, `POST :id/confirm`, `POST :id/cancel`, `POST :id/preparing`, `POST :id/start`, `POST :id/complete`, `POST :id/archive` | Staff RBAC; quarantine es operación sensible | Varios comandos usan body key; revisar consistencia | Parcial |
| Customer events | `customer/customer-events.controller.ts` | `GET spaces`, `GET spaces/:id`, `POST quote`, `GET`, `POST`, `POST :id/cancel` | Clase pública; operaciones privadas usan `CustomerSessionGuard` | `POST` y cancel usan header; listados requieren límites | Parcial |
| Experiences | `experiences/experiences.controller.ts` | `POST`, `GET`, `PUT :experienceId`, `POST :experienceId/participations`, `GET :experienceId/participations` | Staff RBAC `experiences.*` | Participación requiere idempotencia; listar requiere límite | Parcial |
| Customer amenities | `customer/customer-amenities.controller.ts` | `GET config`, `GET reservations`, `POST reservations` | Clase pública; reservas usan `CustomerSessionGuard` | `POST` usa header UUID | Bien encaminado |
| Documents | `documents/documents.controller.ts` | `POST contracts`, `GET contracts`, `GET contracts/:id`, `POST contracts/:id/transition`, `POST contracts/:id/link-evidence`, `POST evidences`, `GET evidences`, `GET audit` | Staff RBAC según operación documental | Comandos usan receipts; listados requieren paginación documentada | Parcial |
| Communications | `communications/communications.controller.ts` | `PUT/GET preferences`, `GET notifications`, `POST notifications/read-all`, `DELETE/POST notifications/clear-read`, `POST notifications/:notificationId/read` | Property-scoped; permisos deben validarse por método | Mutaciones requieren decisión de idempotencia; notificaciones requieren límites | Revisar autorización |
| Suppliers | `suppliers/suppliers.controller.ts` | `GET reorder-suggestions`, `GET purchase-orders`, `GET purchase-orders/:id`, `POST purchase-orders`, `POST purchase-orders/:id/send`, `POST purchase-orders/:id/receive`, `POST :id/rate`, `GET`, `GET :id`, `GET :id/inventory`, `POST :id/inventory/assign`, `POST :id/restock`, `POST`, `PATCH :id`, `POST :id/archive`, `POST :id/reactivate` | Staff RBAC `suppliers.*` | Varias mutaciones exigen header; listados tienen paginación parcial | Parcial |
| Staff | `staff/staff.controller.ts` | `GET`, `GET :id`, `POST`, `PATCH :id`, `POST :id/archive`, `POST :id/reactivate`, `POST work-schedules`, `GET work-schedules`, `POST :id/work-schedule-assignments` | Staff RBAC | Mutaciones requieren revisión de key | Parcial |
| Property communications | `communications/communications.controller.ts` | Incluidas en grupo Communications bajo `properties/:propertyId/communications` | Debe comprobarse que `propertyId` de URL coincide con actor y datos | Revisar filtros, límites e idempotencia | Sensible a aislamiento |

## Clasificación de mutaciones

| Clase | Rutas representativas | Política objetivo de Fase 3 |
| --- | --- | --- |
| Creación de recurso | guests, reservations, stays/walk-in, restaurant orders, suppliers, documents, events | `Idempotency-Key` obligatorio, fingerprint, receipt y replay seguro |
| Transición de estado | check-in/out, order advance/cancel, event lifecycle, cleaning progress, cash open/close | Key obligatorio; transición validada por estado actual y respuesta replayable |
| Movimiento financiero | folio charges/payments/reverse, receivables, cash movements, amenity settle | Key obligatorio, transacción atómica, auditoría y no doble aplicación |
| Actualización parcial | rooms, guests, suppliers, settings, menu, incidents | Evaluar idempotencia y control de versión; no asumir que PATCH siempre es seguro de repetir |
| Operación técnica | biometric capability, metrics, health, outbox quarantine | Autorización/secretos/limites específicos; no usar la política de negocio sin adaptación |

## Gaps confirmados por la matriz

- El prefijo actual es `/api`, sin versionado de ruta.
- La idempotencia se recibe con `Idempotency-Key` en varias áreas, pero algunos comandos usan DTO/body o validaciones distintas.
- Los listados no comparten todavía un DTO de paginación y límite máximo.
- OpenAPI no tiene decoradores explícitos `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery` ni `@ApiHeader` en los controladores inspeccionados.
- La presencia de `@RequirePermissions` debe convertirse en un test automático de cobertura de autorización, con excepciones explícitas para endpoints públicos, customer guard, health y métricas.
- El inventario de consumidores externos no puede deducirse solo del repositorio y requiere confirmación operativa.

## Gate de actualización

Actualizar esta matriz cuando ocurra cualquiera de estos eventos:

- Se agrega, elimina o renombra una ruta.
- Cambia el permiso, guard, DTO, status code o header de una operación.
- Se agrega un consumidor frontend, bridge, job o integración externa.
- Se cambia el formato de error, paginación, versionado o idempotencia.
- Se publica una migración que cambia una invariante de datos.
