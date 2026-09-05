# Tareas: Integración administrativa de Eventos y Clientes

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas modificadas estimadas | 650–800 |
| Riesgo de presupuesto de 400 líneas | High |
| PR encadenadas recomendadas | Yes |
| División sugerida | PR 1 permisos/clientes → PR 2 persistencia/migración → PR 3 eventos backend → PR 4 frontend |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unidad | Objetivo | PR | Verificación enfocada | Runtime harness | Rollback |
|---|---|---|---|---|---|
| 1 | Gate de permisos y lifecycle de clientes | PR 1 | Tests de autorización guests | N/A: no hay runner E2E detectado | Revertir guests y UI de lifecycle |
| 2 | Esquema, cuarentena y migración revisada | PR 2 | Tests de inventario/clasificación | N/A: migración verificada por integración | Revertir migración sin borrar datos/auditoría |
| 3 | Contrato y comandos de Eventos | PR 3 | Tests backend de 403/404/409, estados, versión, replay y disponibilidad | Escenario manual con dos propiedades | Desactivar endpoints/indicador |
| 4 | Recurso único y vistas | PR 4 | Vitest de proveedor, calendario y refresco | Recorrido manual lista-calendario-editor-detalle | Revertir wiring frontend |

## Phase 1: Gate y contratos de Clientes

- [ ] 1.1 **RED:** en `Backend/test/guests-*.spec.ts` probar `guests.archive/reactivate`: autorizado persiste y audita; sin permiso responde 403 sin revelar/mutar; otra propiedad responde 404.
- [ ] 1.2 Verificar la matriz efectiva en autorización, `Backend/src/guests/{guests.dto.ts,guests.controller.ts,guests.service.ts}` y frontend; documentar el permiso antes de cambiar lifecycle.
- [ ] 1.3 **GREEN:** implementar archivo/reactivación persistentes, bloqueo 409 de operaciones incompatibles y lectura intacta de referencias históricas; adaptar `Fronted/src/guests/{guestsClient,guestModel}.js` y `CoreViews.jsx`.

## Phase 2: Persistencia y migración segura

- [ ] 2.1 **RED:** probar en `Backend/test/events-*.spec.ts` inventario de legado en categorías `guest`, `customerAccount`, `both`, `neither`; exigir cuarentena y rechazar identidad por defecto.
- [ ] 2.2 Crear/modificar `Backend/src/database/schema/{events.schema.ts,guests.schema.ts}` y `Backend/drizzle/0024_events_clients_integration.sql` para recibos, cuarentena, clasificación auditada, índices y restricción posterior.
- [ ] 2.3 **GREEN:** implementar clasificación explícita autorizada; activar FK canónica solo sin pendientes, preservando casos `both/neither` no resueltos.

## Phase 3: Eventos backend

- [ ] 3.1 **RED:** probar aislamiento, permisos y errores 403/404; fechas/rangos inválidos, espacio ocupado/inactivo y transacciones sin cambios parciales.
- [ ] 3.2 **RED:** probar en `Backend/test/events-*.spec.ts` máquina `DRAFT→CONFIRMED→CANCELLED→ARCHIVED`, bloqueo terminal y `VERSION_CONFLICT` con estado vigente.
- [ ] 3.3 **RED:** probar replay transaccional: misma clave/huella devuelve respuesta original; huella distinta devuelve `IDEMPOTENCY_KEY_REUSED`, sin duplicado.
- [ ] 3.4 **GREEN:** modificar `Backend/src/events/{events.dto.ts,events.controller.ts,events.service.ts}` con DTO/part discriminada, autorización por sesión, disponibilidad, auditoría, telemetría sin PII e importe solo estimado.

## Phase 4: Integración frontend y verificación

- [ ] 4.1 **RED:** en `Fronted/src/events/*.test.jsx` probar un único `EventsResourceProvider`, representación idéntica, calendario determinista, refresco localizado y errores 403/404/409.
- [ ] 4.2 **GREEN:** modificar `Fronted/src/events/{EventsModuleRoot,useEventsResource,eventsClient,EventCalendarView,EventEditor,EventDetailDrawer,EventsListView}.jsx/js` sin recarga; cargar espacios activos solo lectura y marcar estimación no contable.
- [ ] 4.3 Verificar manualmente con dos propiedades: permisos, histórico, conflictos, reintentos y flujo completo de vistas; confirmar que no se toca `FolioService` ni se agrega CRUD de espacios.
