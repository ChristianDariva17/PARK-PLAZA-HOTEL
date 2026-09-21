# Fase 1: contrato de API, errores y recursos

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para los slices piloto Events y Restaurant

## Objetivo

Unificar la semántica de errores y estados de recursos sin reemplazar todavía el transporte existente, migrar todos los clientes de dominio o rehacer `HotelContext`.

## Decisiones implementadas

### Error común

Se creó `Fronted/src/api/requestError.js` con:

- `RequestError` como clase base.
- `isRequestError` para reconocer errores de transporte y errores de dominio compatibles.
- `getRequestErrorType` para clasificar 401, 403, 404, 409, 422, 429, 5xx, red y respuestas inválidas.
- `normalizeRequestError` como contrato seguro para UI y recursos.

El contrato normalizado contiene:

```text
message
status
code
type
retryable
ambiguous
reloadRecommended
requestId
fieldErrors
```

La causa original nunca se expone desde la normalización. Los errores desconocidos reciben un mensaje genérico para evitar filtrar detalles internos.

### Compatibilidad con authClient

`AuthRequestError` ahora extiende `RequestError`, conservando:

- El nombre de clase existente.
- El constructor legacy con `status` numérico.
- Los campos usados por los clientes existentes.
- El comportamiento de retry, unauthorized listeners, request ID e idempotencia.

`normalizeResourceError` delega en el contrato común. Los clientes que todavía importan `AuthRequestError` no necesitan migrarse en esta fase.

### Estados comunes de recurso

Se creó `Fronted/src/api/resourceState.js` con:

- `idle`
- `loading`
- `refreshing`
- `success`
- `empty`
- `stale`
- `error`
- `forbidden`
- `offline`
- `reconciling`

`createResourceSnapshot` expone una forma consistente para los consumidores:

```text
status
data
error
errorDetails
updatedAt
permission
loading
isLoading
isRefreshing
isError
isForbidden
isUnavailable
isSuccess
isEmpty
isIdle
```

Un recurso en `refreshing` con datos existentes mantiene `isSuccess: true`, pero también `isRefreshing: true`. Esto evita ocultar datos válidos mientras se actualizan.

## Slice Events

`Fronted/src/events/useEventsResource.js` ahora:

- Distingue `loading` inicial de `refreshing`.
- Expone `errorDetails` además del mensaje legacy `error`.
- Clasifica errores como `forbidden`, `offline` o `error`.
- Usa `empty` cuando la colección se carga correctamente sin registros.
- Protege espacios y eventos contra respuestas obsoletas mediante generaciones.
- Conserva la cancelación con `AbortController`.
- Mantiene el debounce de 100 ms para eventos realtime.
- Expone `reload` como alias explícito de `refresh`.
- Deja de escribir errores de espacios solamente en consola y los devuelve al consumidor como `spacesError` y `spacesErrorDetails`.

Los consumidores existentes siguen recibiendo `events`, `spaces`, `total`, `loading`, `error`, `filters`, `updateFilters` y `refresh`.

## Slice Restaurant

`Fronted/src/restaurant/restaurantClient.js` ahora:

- Conserva `RestaurantRequestError` por compatibilidad.
- Lo hace extender `RequestError`.
- Copia metadata común de status, código, tipo, retry, ambigüedad, reconciliación y request ID.
- No convierte cancelaciones `AbortError` en errores visibles de servidor.
- Sanitiza fallos desconocidos de transporte.

`Fronted/src/restaurant/useRestaurantResource.js` ahora devuelve el snapshot común y conserva `reload`.

`HotelContext.jsx` y `hotelReducer.js` propagan `errorDetails` y almacenan estados `refreshing`, `empty` y `offline` para los recursos de menú, pedidos, inventario y libro.

La actualización de `OperationalViews.jsx` evita ocultar datos stale durante refresh y utiliza flags comunes en vez de comparar únicamente `status === 'loading'` o `status === 'error'`.

Las suscripciones realtime de pedidos ya no generan logs directos ni promesas rechazadas sin manejar.

## Pruebas agregadas o actualizadas

- `Fronted/src/api/requestError.test.js`: matriz de status, metadata de correlación y sanitización.
- `Fronted/src/api/resourceState.test.js`: loading, refreshing con datos stale, empty y errores.
- `Fronted/src/restaurant/restaurantClient.test.js`: conflictos, cancelación y fallos de red.
- `Fronted/src/auth/authClient.resource.test.js`: contrato normalizado enriquecido.
- `Fronted/src/events/useEventsResource.lifecycle.test.js`: estado común y lifecycle realtime.
- `Fronted/src/state/hotelReducer.test.js`: refresh, empty, offline y forbidden en recursos Restaurant.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run test` | PASS, 42 archivos y 216 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2006 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial pasó de `463.65 kB` a `464.67 kB` sin comprimir. El aumento aproximado de `1.02 kB` corresponde al contrato común compartido y no se agregó ninguna dependencia externa.

## Fuera de alcance

- No se migraron todavía todos los clientes de dominio.
- No se dividió `HotelContext.jsx`.
- No se introdujo Redux, Zustand, SWR ni otra librería de estado.
- No se cambió el contrato backend.
- No se agregaron schemas de formularios.
- No se implementaron retry de mutaciones ni reconciliación automática nueva.

## Criterio de salida

- Events y Restaurant consumen el contrato común.
- Los consumidores legacy siguen funcionando con `error` textual y `loading`.
- Los errores tienen metadata segura y correlacionable.
- Las respuestas obsoletas y cancelaciones no sobrescriben el estado vigente.
- Los datos stale permanecen visibles durante refresh.
- Empty, offline, forbidden y error son distinguibles.
- Tests, lint, build y E2E público pasan.

## Siguiente paso

La fase 2 puede extraer responsabilidades de `HotelContext.jsx`, comenzando por Events y Restaurant como referencias de migración. La migración deberá conservar este contrato y agregar tests de comportamiento antes de mover cada dominio.
