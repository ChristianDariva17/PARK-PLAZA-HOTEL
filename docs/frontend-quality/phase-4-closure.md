# Cierre de Fase 4: sistema UI compartido

La Fase 4 queda cerrada con primitives compartidas, consumidores migrados, confirmaciones consistentes y pruebas de interacción verificables. El siguiente trabajo pasa a Fase 5: UX, formularios y estados de interfaz.

## Ruta de revisión

1. Revisar la matriz de contratos compartidos.
2. Confirmar los criterios de aceptación.
3. Repetir los comandos de validación indicados.
4. Continuar con los journeys prioritarios de Fase 5.

## Matriz de contratos

| Área | Contrato | Evidencia |
| --- | --- | --- |
| Formularios | `FormField`, `P1Input`, `P1Select`, `P1Textarea` | `formInfrastructure.test.js` |
| Acciones async | `P1Button`, `AsyncButton`, `PermissionButton`, `PermissionGate` | `uiInfrastructure.test.js`, `uiAdvancedInteractions.test.jsx` |
| Layout | `PageShell`, `PageHeader`, `SectionHeader`, `MetricStrip` | `SharedViewParts.jsx`, consumidor piloto en `EventCalendarView.jsx` |
| Estados | `ResourceState`, `EmptyState`, `ErrorState` | `uiAdvancedInteractions.test.jsx`, `uiInfrastructure.test.js` |
| Datos | `DataTable`, `StatusBadge`, `DetailGrid` | `uiAdvancedInteractions.test.jsx`, consumidores reales |
| Colecciones | `FilterBar`, `CollectionTable`, `SortableHeader`, `Pagination`, `RowActions` | `formInfrastructure.test.js`, `uiAdvancedInteractions.test.jsx` |
| Overlays | `Dialog`, `Drawer`, `Tabs`, `ConfirmAction` | `uiInteractions.test.jsx`, `uiAdvancedInteractions.test.jsx` |
| Autorización | `PermissionButton`, `PermissionGate`, acciones de `PageHeader` | `uiAdvancedInteractions.test.jsx`, `uiInfrastructure.test.js` |
| Feedback y realtime | feedback compartido y lifecycle de `useWebSocketEvents` | `uiInfrastructure.test.js`, `uiAdvancedInteractions.test.jsx` |

## Criterios de aceptación

- [x] Los filtros identificados usan `FilterBar`, conservando sus clases y handlers específicos.
- [x] Las confirmaciones destructivas usan `ConfirmAction`; no quedan usos de `window.confirm` en `Fronted/src`.
- [x] Los dialogs y drawers mantienen foco inicial, retorno de foco, Escape y aislamiento de overlays.
- [x] Las acciones async pueden comunicar progreso, bloquear doble submit y exponer `aria-busy`.
- [x] Existen estados compartidos para loading, empty, error, forbidden, offline y reconciling.
- [x] Los contratos incluyen pruebas DOM y pruebas source-level de consumidores.
- [x] Las rutas recuperan errores localmente sin `window.location.reload()`.
- [x] La suite, lint, build y revisión de diff pasan.

## Validación final

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 60 archivos y 297 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2033 módulos transformados |
| `git diff --check` | PASS |

## Fuera de alcance

- Validación manual WCAG/Axe completa en todos los módulos.
- Journeys UX completos de reservas, check-in/out, caja, cocina, limpieza y mantenimiento.
- E2E de mutaciones y permisos con fixtures aislados.
- Optimización de bundle y budgets de rendimiento.

## Transición

La Fase 5 debe comenzar por una matriz de journeys para reservas, check-in/out, caja, pedidos, limpieza y mantenimiento. Cada journey debe definir precondiciones, validación, progreso, éxito, error, conflicto, cancelación y recuperación antes de migrar código.
