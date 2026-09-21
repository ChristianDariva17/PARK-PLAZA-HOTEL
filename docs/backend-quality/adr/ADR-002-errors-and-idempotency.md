# ADR-002: errores HTTP e idempotencia de comandos

Estado: propuesta técnica para Fase 3  
Fecha: 2026-09-17

## Contexto

El filtro global devuelve un envelope propio con `statusCode`, `error`, `message` y `requestId`. Existen parsers Zod y receipts de idempotencia, pero la aplicación de `Idempotency-Key` no es uniforme entre módulos.

## Decisión

Adoptar un envelope compatible con RFC 9457 para errores de API:

- `type`: URI estable del tipo de problema.
- `title`: descripción corta y no sensible.
- `status`: código HTTP.
- `detail`: detalle seguro para el cliente.
- `code`: código de negocio estable.
- `requestId`: correlación operativa.
- `errors`: errores de campos cuando corresponda.

Usar `Idempotency-Key` como header HTTP canónico para comandos mutantes. El valor será un UUID, con longitud y formato validados. La operación, propiedad y key identifican el receipt; el fingerprint detecta reutilización con payload incompatible.

## Reglas

- Una respuesta exitosa se guarda con status y body suficientes para replay.
- Una key repetida con el mismo fingerprint devuelve el resultado original sin repetir efectos.
- Una key repetida con fingerprint distinto devuelve conflicto estable.
- Validaciones, permisos y errores permanentes no se reintentan automáticamente.
- Cada endpoint mutante debe declarar si la idempotencia es obligatoria, opcional o no aplica.

## Alternativas descartadas

- Mantener mensajes libres como contrato: dificulta clientes, métricas y soporte.
- Usar la key en body: no es interoperable con proxies/clientes y mezcla datos de negocio con control de transporte.
- Hacer idempotentes todos los GET mediante receipts: agrega costo sin proteger efectos.

## Consecuencias

- El filtro y los DTOs deben migrarse gradualmente.
- Se requieren decoradores OpenAPI para error, header y respuestas replayadas.
- La política existente de receipts debe preservarse durante la migración y cubrir expiración/retención.

## Criterio de aceptación

Todas las mutaciones de la matriz tienen política explícita, tests de replay/conflicto y documentación OpenAPI con status codes y header.
