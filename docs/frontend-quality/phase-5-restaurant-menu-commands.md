# Fase 5: extracción de comandos de menú Restaurant

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para el slice de menú e importación

## Objetivo

Extraer de `HotelContext.jsx` la carga del menú administrado, las mutaciones manuales y la importación Markdown, preservando permisos, cancelación, generaciones, validación de preview y refresh coordinado.

## Qué salió de HotelContext

Se movió a `Fronted/src/restaurant/useRestaurantMenuCommands.js`:

- Carga generacional y abortable de `GET /internal/menu`.
- `createManual`, `updateManual`, `archiveManual` y `reactivateManual`.
- `previewImport`, `applyImport` y `clearImport`.
- Validación de acceso con `hasKitchenManagementAccess`.
- Adaptación de respuestas con `adaptManagedMenuList` y `adaptImportPreviewResult`.
- Refresh de menú administrado, menú operativo y pedidos.
- Exposición de `isMutating`.

La fábrica `createRestaurantMenuCommands` permite probar los comandos sin incorporar una librería de testing de hooks. `useRestaurantMenuCommands` mantiene refs de autenticación, generaciones y cancelación.

## API pública preservada

`menuManagementCommands` conserva la superficie consumida por `MenuManagementView.jsx`:

```text
menuManagementCommands.reload
menuManagementCommands.createManual
menuManagementCommands.updateManual
menuManagementCommands.archiveManual
menuManagementCommands.reactivateManual
menuManagementCommands.previewImport
menuManagementCommands.applyImport
menuManagementCommands.clearImport
menuManagementCommands.isMutating
```

## Corrección necesaria del reducer

El estado inicial ya declaraba `menuPendingMutations` y `menuImportRequest`, pero el reducer no manejaba sus eventos. Se agregaron los eventos de commit, mutación e importación para que:

- `isMutating` refleje operaciones activas.
- El resultado del preview guarde su `contentHash`.
- `applyImport` pueda rechazar previews obsoletos.
- Los estados `previewing`, `previewed`, `applying`, `applied`, `error` e `idle` sean observables.
- Los cambios manuales actualicen `managedMenu` de forma inmutable.

## Semántica preservada

- Las mutaciones manuales requieren las tres autorizaciones de gestión de cocina.
- Update, archive y reactivate limpian la mutación pendiente en `finally`.
- Preview aborta la solicitud anterior y no convierte una cancelación en error visible.
- Apply exige el hash vigente y que no haya mutaciones manuales pendientes.
- Apply conserva el error para que el consumidor pueda informar el resultado al usuario.
- Las operaciones exitosas refrescan el catálogo administrado, el menú operativo y los pedidos.

## Pruebas

`Fronted/src/restaurant/useRestaurantMenuCommands.test.js` cubre:

- Commit y refresh de productos manuales.
- Limpieza de mutaciones ante errores.
- Preview, apply y validación de hash obsoleto.

`Fronted/src/state/hotelReducer.test.js` cubre el lifecycle de mutaciones e importación. `Fronted/src/state/HotelContext.lifecycle.test.js` verifica la ownership del controlador.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 46 archivos y 236 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2010 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `466.54 kB` sin comprimir.

## Estado del slice Restaurant

Quedaron extraídos los cuatro grupos principales:

- Lecturas y lifecycle de recursos en `useRestaurantResources.js`.
- Mutaciones de pedidos en `useRestaurantOrderCommands.js`.
- Mutaciones de inventario en `useRestaurantInventoryCommands.js`.
- Menú administrado e importación en `useRestaurantMenuCommands.js`.

`HotelContext.jsx` continúa siendo el compositor del estado global y de las APIs públicas, pero ya no contiene la lógica específica del slice Restaurant.
