# ADR-004: retries y DLQ del outbox

Estado: propuesta técnica para Fase 2  
Fecha: 2026-09-17

## Contexto

`OutboxService` toma filas con lock, publica por realtime y ante cualquier excepción vuelve a `pending` usando backoff exponencial limitado por tiempo. No existe estado terminal, máximo de intentos ni clasificación entre errores transitorios y permanentes.

## Decisión

Mantener el outbox transaccional y agregar una política explícita:

- Errores transitorios: retry con backoff exponencial, jitter y máximo configurable.
- Errores permanentes: estado `dead_letter` sin retry automático.
- Errores desconocidos: retry acotado y luego `dead_letter` con razón segura.
- Reclamación de filas `processing` vencidas mediante lease/lock.
- Replay manual protegido, auditado e idempotente.

La DLQ será una capacidad del outbox existente, no una cola paralela para eventos que deben conservar atomicidad con PostgreSQL.

## Métricas obligatorias

- Cantidad de eventos pending, processing, sent y dead-letter.
- Edad del evento más antiguo.
- Retries y fallos por tipo de dependencia.
- Replays manuales y eventos reencolados.

## Alternativas descartadas

- Reintentar indefinidamente: oculta errores de contrato y consume recursos.
- Publicar antes de commit: puede notificar estados que luego hacen rollback.
- Introducir BullMQ inmediatamente: agrega otra fuente de verdad antes de demostrar necesidad de workers.

## Criterio de aceptación

Un error permanente no vuelve a pending, un evento transitorio se reintenta dentro de límites, la DLQ alerta y un operador puede investigar/replayar sin duplicar efectos.
