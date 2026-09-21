# Fase 12: entrypoints de features P1

Fecha de implementación: 2026-09-15  
Fase del plan maestro: 3.2, descomposición de vistas por feature  
Estado: completada; el agregado P1 fue retirado

## Objetivo

Eliminar el agregado legado `P1Views.jsx` después de confirmar que cada ruta administrativa usa un entrypoint por feature.

## Cambios

- `Fronted/src/communications/AdminNotificationsView.jsx` — entrypoint administrativo de Notificaciones.
- `Fronted/src/parking/ParkingView.jsx` — vista de cochera, editor, mapa, salida, ticket y archivado.
- `Fronted/src/pets/PetsView.jsx` — vista de mascotas, editor, pase y archivado/reactivación.
- `Fronted/src/cleaning/CleaningView.jsx` — gestión de tareas, evidencias fotográficas, progresión, incidencias y tickets.
- `Fronted/src/amenities/RecreationView.jsx` — reservas, aforo, pases, identidad, liquidación y tickets QR.
- `Fronted/src/components/views/ReasonDialog.jsx` — diálogo compartido para operaciones con motivo.
- `Fronted/src/app/adminViewComponents.jsx` — las rutas `notificaciones`, `cochera`, `mascotas`, `limpieza` y `recreacion` apuntan a sus entrypoints propios.
- `Fronted/src/components/views/P1Views.jsx` — retirado; no quedan consumidores del agregado P1.

Los cuerpos de las cinco features extraídas se trasladaron sin cambiar sus contratos de props (`notify`), permisos, comandos confirmados, modales ni textos operativos. Las otras rutas ya tenían entrypoints especializados, por lo que no se duplicaron. Cleaning conserva la carga de evidencias mediante `evidenceClient`; Recreation conserva sus helpers de identidad/liquidación junto al entrypoint. `ReasonDialog` conserva la validación mediante `PermissionGate` y la confirmación asíncrona.

## Impacto de bundle

Las rutas extraídas generan chunks independientes:

- `ParkingView`: `28.49 kB` sin comprimir.
- `PetsView`: `22.28 kB` sin comprimir.
- `AdminNotificationsView`: `8.15 kB` sin comprimir.
- `CleaningView`: `16.49 kB` sin comprimir.
- `RecreationView`: `37.85 kB` sin comprimir.

El chunk inicial quedó en `481.11 kB`; la separación mantiene las vistas extraídas fuera del registro eager.

## Pruebas

Se agregaron:

- `Fronted/src/app/phase3P1Split.test.js`

Se actualizaron:

- `Fronted/src/parking/parkingEnhancements.test.js`
- `Fronted/src/pets/petEnhancements.test.js`

Las pruebas verifican que el registro lazy no dependa de `P1Views`, que las capacidades específicas permanezcan en los módulos propietarios y que el agregado legado ya no exista.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 56 archivos y 264 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2029 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |
| `git diff --check` | PASS |

## Próximo corte

Fase 3.3 sobre `OperationalViews.jsx` completada en `phase-13-operational-feature-entrypoints.md`.
