# Fase 4.4: consumidores de filtros especializados

Este corte completa la adopción de `FilterBar` en los consumidores que mantenían barras de filtro con clases propias.

## Cambios

- Migrados a `FilterBar`:
  - `MaintenanceView` con `custom-filter-bar`.
  - `IncidentsView` con `custom-filter-bar`.
  - `EventCalendarView` con `events-filter-bar`.
  - `NotificationsView` con `notifications-filter-bar`.
- Se conservaron clases, controles, filtros locales, tabs y handlers existentes.
- Cada barra expone ahora un landmark `search` con nombre accesible.

## Pruebas

- El contrato source-level cubre estos cuatro consumidores junto con los once migrados en cortes anteriores.
- La prueba DOM existente continúa validando el comportamiento de `FilterBar` como región accesible.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run --exclude e2e src/components/ui/formInfrastructure.test.js src/components/ui/uiAdvancedInteractions.test.jsx --maxWorkers=1` | PASS, 27 tests |
| `npm test` | PASS, 60 archivos y 295 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2033 módulos transformados |
| `git diff --check` | PASS |

## Estado del roadmap

La adopción de `FilterBar` queda cubierta en los consumidores identificados. El cierre formal está documentado en `phase-4-closure.md`; el siguiente frente funcional es Fase 5: UX, formularios y estados de interfaz para los journeys críticos.
