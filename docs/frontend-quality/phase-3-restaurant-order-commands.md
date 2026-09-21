# Fase 3: extracción de comandos de pedidos Restaurant

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para el slice de pedidos

## Objetivo

Reducir el acoplamiento de `HotelContext.jsx` extrayendo las mutaciones de pedidos sin cambiar la reconciliación, el reducer ni los consumidores existentes.

## Qué salió de HotelContext

Se movió a `Fronted/src/restaurant/useRestaurantOrderCommands.js`:

- `createOrder` y `updateOrder`.
- `advanceOrder` y `advanceOrderItem`.
- `cancelOrder`.
- Adaptación de respuestas con `adaptOrdersList`.
- Commit de `RESTAURANT_ORDER_CREATED` y `RESTAURANT_ORDER_UPDATED`.
- Refresh posterior de `orders` y, cuando corresponde, `inventory`.

La fábrica `createRestaurantOrderCommands` permite probar el comportamiento sin incorporar una librería de testing de hooks. `useRestaurantOrderCommands` estabiliza el objeto mediante `useMemo` antes de publicarlo en el provider.

## API pública preservada

`restaurantCommands` conserva los comandos cortos usados por las vistas de Restaurant:

```text
restaurantCommands.createOrder
restaurantCommands.updateOrder
restaurantCommands.advanceOrder
restaurantCommands.advanceOrderItem
restaurantCommands.cancelOrder
```

También se mantienen aliases temporales `createOrderCommand`, `updateOrderCommand`, `advanceOrderCommand`, `advanceOrderItemCommand` y `cancelOrderCommand`, porque `OperationalViews.jsx` ya los consume.

## Semántica preservada

- Las respuestas exitosas se adaptan antes de entrar al reducer.
- Las mutaciones actualizan el estado local con la respuesta canónica del servidor.
- `orders` se recarga siempre en `finally` para creación y edición.
- `orders` e `inventory` se recargan siempre en `finally` para avance de pedido, avance de ítem y cancelación.
- Los errores siguen propagándose al consumidor; el refresh posterior no reemplaza el resultado de la mutación.
- No se agregaron permisos frontend nuevos ni dependencias externas.

## Pruebas

`Fronted/src/restaurant/useRestaurantOrderCommands.test.js` cubre:

- Adaptación y commit de creación.
- Refresh de inventario durante el lifecycle del pedido.
- Refresh en caso de error.
- Aliases legacy.
- Cancelación mediante el cliente correcto.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 44 archivos y 225 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2008 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `465.00 kB` sin comprimir.

## Siguiente paso

Extraer las mutaciones de inventario y luego las de menú/importación, manteniendo el mismo patrón de controlador de feature y la API pública durante la migración.
