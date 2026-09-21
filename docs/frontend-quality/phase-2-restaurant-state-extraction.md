# Fase 2: extracción del estado Restaurant

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para el slice Restaurant

## Objetivo

Reducir el acoplamiento de `HotelContext.jsx` extrayendo la lectura y el lifecycle de recursos Restaurant sin cambiar el reducer, los comandos de mutación ni la API pública consumida por las vistas.

## Qué salió de HotelContext

Se movió a `Fronted/src/restaurant/useRestaurantResources.js`:

- `RESTAURANT_RESOURCE_DEFINITIONS`.
- Las claves de recursos `menu`, `orders`, `inventory` e `inventoryLedger`.
- Los adaptadores y clientes de lectura Restaurant.
- Los refs de generación y `AbortController`.
- `cancelResourceLoad`.
- `runResourceLoad`.
- `reloadResource`.
- El efecto de bootstrap, reset, permisos, identidad y cleanup.
- La normalización de errores de lectura.

El nuevo hook conserva:

- Aislamiento por `accountId`/email y `propertyId`.
- Guardas de permisos por recurso.
- Cancelación de requests anteriores.
- Supresión de respuestas obsoletas.
- Estados `loading`, `refreshing`, `empty`, `offline`, `forbidden` y `error` mediante el reducer existente.
- Reconciliación de identidad al cambiar de sesión o propiedad.

## Qué permanece en HotelContext

La extracción fue deliberadamente parcial. `HotelContext.jsx` todavía conserva:

- `hotelReducer` y `projectedState`.
- Invariantes y validación multi-dominio.
- Comandos de mutación Restaurant.
- Comandos de menú administrado e importación.
- Comandos de inventario.
- La API pública `restaurantCommands` e `inventoryCommands`.

Esto permite que las vistas no cambien sus dependencias mientras el lifecycle de lectura deja de pertenecer al provider general.

## API pública preservada

Las vistas siguen recibiendo desde `useHotel()`:

```text
restaurantCommands.reload
restaurantCommands.reloadResource
restaurantCommands.createOrder
restaurantCommands.updateOrder
restaurantCommands.advanceOrder
restaurantCommands.advanceOrderItem
restaurantCommands.cancelOrder
inventoryCommands.reloadInventory
inventoryCommands.reloadLedger
```

`useRestaurantResource` continúa consumiendo `commands.reloadResource`, pero ahora esa función proviene del controlador de feature en lugar de estar definida dentro de `HotelContext`.

## Pruebas

- `Fronted/src/restaurant/useRestaurantResources.lifecycle.test.js`: claves, definiciones, permisos, identidad, generaciones y cancelación.
- `Fronted/src/state/HotelContext.lifecycle.test.js`: ownership del lifecycle y preservación del reload público.
- `Fronted/src/state/hotelReducer.test.js`: refresh, empty, offline y forbidden.
- `Fronted/src/restaurant/restaurantClient.test.js`: conflicto, cancelación y fallo de red.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run test` | PASS, 43 archivos y 219 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2007 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `464.82 kB` sin comprimir. No se agregaron dependencias externas.

## Criterio de salida

- `HotelContext` ya no declara ni ejecuta el lifecycle de lecturas Restaurant.
- El controlador de feature posee definiciones, permisos, identidad, generaciones y aborts.
- Las mutaciones siguen usando la API existente.
- Las vistas no requieren cambios de integración.
- Las pruebas globales, lint, build y E2E público pasan.

## Fuera de alcance

- No se extrajeron todavía las mutaciones Restaurant.
- No se creó un `RestaurantProvider` separado.
- No se dividió el reducer general.
- No se migraron Guests, Rooms, Reservations o Stays.
- No se modificó el contrato backend.

## Siguiente paso

La continuación natural es extraer las mutaciones Restaurant por grupos: primero pedidos, luego inventario y finalmente menú/importación. Cada grupo debe conservar la API pública temporal hasta que sus consumidores migren a comandos de feature propios.
