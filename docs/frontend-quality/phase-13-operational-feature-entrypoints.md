# Fase 13: entrypoints operativos por feature

La Fase 3.3 retira `OperationalViews.jsx` y deja Mantenimiento, Inventario, Caja e Incidencias en entrypoints lazy independientes. Las rutas que ya tenían módulos propios no se duplicaron.

## Resultado

| Ruta | Entrypoint |
| --- | --- |
| `mantenimiento` | `Fronted/src/maintenance/MaintenanceView.jsx` |
| `inventario` | `Fronted/src/inventory/InventoryView.jsx` |
| `caja` | `Fronted/src/cash/CashView.jsx` |
| `incidencias` | `Fronted/src/incidents/IncidentsView.jsx` |

`StatusStepper` y `PriorityTag` quedaron en `Fronted/src/operations/OperationalViewParts.jsx` porque son compartidos por Mantenimiento e Incidencias.

## Decisiones

- `Reservations`, `Orders` y `Suppliers` conservaron sus entrypoints existentes: `ReservationsView`, `OrdersView`/`MenuManagementView` y `SuppliersModuleRoot`.
- `adminViewComponents.jsx` ya no define ni consume el loader `operational`.
- `CashPhase2.test.js` y `CashZReportModal.test.js` ahora verifican `CashView.jsx`, que es el propietario real del comportamiento.
- `OperationalViews.jsx` fue eliminado al no tener consumidores de producción.

## Impacto de bundle

La build genera chunks operativos independientes:

- `MaintenanceView`: `18.75 kB` sin comprimir.
- `InventoryView`: `33.44 kB` sin comprimir.
- `CashView`: `50.01 kB` sin comprimir.
- `IncidentsView`: `19.51 kB` sin comprimir.
- `OperationalViewParts`: `1.04 kB` sin comprimir.

El chunk inicial quedó en `481.45 kB`; las vistas operativas no se cargan eager desde el registro.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 57 archivos y 266 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2033 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |
| `git diff --check` | PASS, sólo avisos existentes de LF/CRLF |

## Siguiente paso

Revisar `ExtendedViews.jsx` y `CoreViews.jsx` para identificar agregados restantes, sin crear módulos duplicados donde ya existan entrypoints especializados.
