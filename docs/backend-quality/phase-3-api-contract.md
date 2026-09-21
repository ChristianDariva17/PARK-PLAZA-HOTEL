# Fase 3: contrato API, errores e idempotencia

Fecha del corte inicial: 2026-09-17  
Estado: corte inicial implementado y validado

## Compatibilidad y versionado

La API canónica se publica bajo `/api/v1`. Durante la ventana de compatibilidad, las mismas rutas siguen disponibles bajo `/api` para evitar un corte coordinado de consumidores externos no comprobados. Los dos frontends ya solicitan la versión `/api/v1`; la ruta legacy queda para clientes existentes y se retirará después de verificar el inventario de consumidores.

## Errores

Los errores HTTP usan `application/problem+json` con:

- `type`, `title`, `status`, `detail` e `instance`.
- `code` estable para errores de negocio o de transporte.
- `requestId` y `X-Request-Id` para correlación.
- `errors` como extensión para errores de validación por campo.

`statusCode`, `error` y `message` se mantienen como aliases de compatibilidad durante la transición. Los errores inesperados no exponen mensajes internos, SQL, credenciales ni payloads.

## Idempotencia

Las operaciones de comandos de Documentos y Eventos reciben `Idempotency-Key` UUID en el header. La clave ya no forma parte del body ni del fingerprint; el fingerprint cubre únicamente la operación y los datos mutables. Las respuestas repetidas y los conflictos por reutilización de clave conservan la semántica transaccional existente.

Los clientes generan la clave una vez por comando y la conservan durante un retry. El cliente administrativo mantiene rutas internas legacy en sus módulos, pero las transforma a `/api/v1` en el transporte; el portal de clientes usa `/api/v1` directamente.

## Gates ejecutados

- `npm test`: 74 archivos, 348 tests PASS.
- `npm run test:integration`: 29 tests PASS con migración `0058` aplicada.
- `npm run build` y `npm run typecheck`: PASS.
- `npm run lint`: PASS con warnings preexistentes fuera de este corte.
- `npm run verify:contract`: PASS contra una instancia `development`; OpenAPI 3.0.0 expone rutas versionadas y legacy.

## Pendiente

- Completar la migración del resto de endpoints mutantes que todavía no persisten idempotencia o usan DTOs legacy.
- Definir con evidencia el retiro de `/api` legacy.
- Añadir Spectral y oasdiff cuando el contrato OpenAPI sea el artefacto de CI aprobado.
