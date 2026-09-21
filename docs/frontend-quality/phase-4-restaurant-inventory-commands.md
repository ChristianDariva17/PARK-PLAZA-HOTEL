# Fase 4: extracción de comandos de inventario Restaurant

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para el slice de inventario

## Objetivo

Reducir el acoplamiento de `HotelContext.jsx` extrayendo las mutaciones de inventario sin cambiar permisos, reducer, reconciliación ni consumidores existentes.

## Qué salió de HotelContext

Se movió a `Fronted/src/restaurant/useRestaurantInventoryCommands.js`:

- `createItem`, `updateItem`, `archiveItem`, `reactivateItem` y `adjustStock`.
- Validación frontend de permisos por operación.
- Adaptación de respuestas con `adaptInventoryList`.
- Commit de `RESTAURANT_INVENTORY_ITEM_CREATED` y `RESTAURANT_INVENTORY_ITEM_UPDATED`.
- Refresh de los recursos afectados después de una mutación exitosa.
- Comandos `reloadInventory` y `reloadLedger`.

La fábrica `createRestaurantInventoryCommands` permite probar el comportamiento sin incorporar una librería de testing de hooks. `useRestaurantInventoryCommands` estabiliza el objeto mediante `useMemo`.

## API pública preservada

`inventoryCommands` conserva exactamente la superficie consumida por `OperationalViews.jsx`:

```text
inventoryCommands.reloadInventory
inventoryCommands.reloadLedger
inventoryCommands.createItem
inventoryCommands.updateItem
inventoryCommands.archiveItem
inventoryCommands.reactivateItem
inventoryCommands.adjustStock
```

## Semántica preservada

- Crear y editar requieren sus permisos específicos y refrescan `inventory` y `menu`.
- Archivar y reactivar requieren `inventoryArchive` y refrescan `inventory`, `inventoryLedger` y `menu`.
- Ajustar requiere `inventoryAdjust` y refresca `inventory`, `inventoryLedger` y `menu`.
- Las respuestas exitosas se adaptan antes de entrar al reducer.
- Los errores de permisos se rechazan antes de llamar al cliente.
- No se agregaron dependencias externas.

## Pruebas

`Fronted/src/restaurant/useRestaurantInventoryCommands.test.js` cubre:

- Adaptación, commit y refresh de creación.
- Rechazo temprano por falta de permisos.
- Refresh del ledger en archivado y ajuste.
- Actualización mediante el cliente correcto.

`Fronted/src/state/HotelContext.lifecycle.test.js` verifica que el provider delega la ownership de los comandos.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 45 archivos y 230 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2009 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `464.98 kB` sin comprimir.

## Siguiente paso

Extraer los comandos de menú administrado e importación, que requieren conservar el lifecycle de importación, la validación de hash de preview y el refresh coordinado de menú y pedidos.
