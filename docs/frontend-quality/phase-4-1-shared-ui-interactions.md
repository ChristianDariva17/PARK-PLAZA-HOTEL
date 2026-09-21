# Fase 4.1: cobertura de interacción UI compartida

Este corte completa la cobertura DOM y lifecycle de las primitivas compartidas que faltaban en la primera parte de la Fase 4.

## Cobertura añadida

- `PermissionButton` y `PermissionGate`: renderizado autorizado y ocultamiento sin permiso.
- `GlobalSearch`: búsqueda por texto, resultados filtrados por ruta autorizada, navegación con flechas y selección con Enter.
- `FilterBar`: región de búsqueda y nombre accesible.
- `SortableHeader` y `Pagination`: ordenamiento, `aria-sort`, límites y cambio de página.
- `RowActions`: filtrado por permiso, foco en el primer menú, Escape y restauración del foco al trigger.
- `Dialog`: overlays anidados, aislamiento de Escape, bloqueo de scroll y estado `aria-hidden` del root.
- `useWebSocketEvents`: conexión, estado publicado, múltiples suscripciones, callback actualizado y cleanup.

## Cambios de código

- Añadido `Fronted/src/components/ui/uiAdvancedInteractions.test.jsx`.
- No se modificaron componentes productivos; el único ajuste posterior a la primera ejecución fue corregir un locator de prueba para el nombre accesible compuesto de `SortableHeader`.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run --exclude e2e src/components/ui/uiAdvancedInteractions.test.jsx --maxWorkers=1` | PASS, 8 tests |
| `npm test` | PASS, 60 archivos y 284 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2033 módulos transformados |

## Pendiente de la Fase 4

La cobertura de interacción compartida queda cerrada para estas primitivas. Aún debe revisarse la migración completa de consumidores a las APIs comunes y la matriz visual de variantes antes de pasar formalmente a la Fase 5 de UX, formularios y estados async.
