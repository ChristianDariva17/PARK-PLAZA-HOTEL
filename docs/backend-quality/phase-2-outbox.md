# Fase 2: outbox confiable y recuperación operable

Fecha de implementación: 2026-09-17  
Estado: slice implementado y validado  
Dependencia: Fase 0; compatible con la Fase 1

## Alcance

El outbox mantiene la transacción de negocio como fuente de verdad y publica eventos con semántica **at-least-once**. La entrega a Socket.IO no se considera confirmación transaccional: un proceso que se interrumpa después del `emit` puede producir una repetición cuando el evento sea recuperado.

## Estados

| Estado | Significado | Acción automática |
| --- | --- | --- |
| `pending` | Esperando disponibilidad o reintento | Se reclama cuando `available_at` vence |
| `processing` | Reclamo activo por un worker | Se recupera cuando el lock supera `OUTBOX_LOCK_TIMEOUT_MS` |
| `sent` | Publicación completada | No se vuelve a procesar |
| `dead_letter` | Fallo permanente, desconocido o agotamiento de intentos | Requiere inspección y reencolado explícito |

Cada reclamo genera un `lock_token`. Las actualizaciones de éxito o fallo incluyen ese token para que un worker antiguo no pueda finalizar un evento que ya fue recuperado por otro worker.

## Clasificación

- Transitorios: errores de red conocidos, timeout, gateway realtime no disponible y respuestas HTTP 408, 425, 429 o 5xx. Se reintentan con backoff exponencial y jitter.
- Permanentes: respuestas HTTP 4xx distintas de 408, 425 y 429. Se envían directamente a `dead_letter`.
- Desconocidos: cualquier error que no coincida con una señal segura. Se envían a `dead_letter` para evitar ciclos infinitos.

Solo se persisten códigos seguros como `error_code` y `last_error`; nunca el mensaje crudo ni el payload del evento en las respuestas operativas.

## Configuración

| Variable | Default | Propósito |
| --- | ---: | --- |
| `OUTBOX_MAX_ATTEMPTS` | `8` | Máximo de intentos antes de DLQ |
| `OUTBOX_RETRY_BASE_MS` | `1000` | Base del backoff |
| `OUTBOX_RETRY_MAX_MS` | `300000` | Tope del backoff |
| `OUTBOX_LOCK_TIMEOUT_MS` | `60000` | Tiempo para recuperar un lock abandonado |
| `OUTBOX_DISPATCH_LIMIT` | `50` | Eventos reclamados por ciclo |

## Operación

1. Consultar `GET /api/audit/outbox?status=dead_letter` con una cuenta que tenga `audit.read`.
2. Inspeccionar un evento con `GET /api/audit/outbox/:id`. La respuesta omite `payload`, `lock_token` y `last_error` crudo.
3. Confirmar la causa en logs y métricas antes de reencolar.
4. Ejecutar `POST /api/audit/outbox/:id/requeue` con una cuenta que tenga `audit.manage`.
5. Verificar que el evento vuelva a `pending`, que el evento de auditoría quede persistido y que el backlog descienda.

El reencolado reinicia `attempts`, limpia el estado terminal y se ejecuta en la misma transacción que la auditoría. Solo se permite para eventos `dead_letter` de la propiedad autenticada.

## Métricas y alertas

- `park_plaza_outbox_pending`: backlog pendiente.
- `park_plaza_outbox_processing`: eventos con reclamo activo.
- `park_plaza_outbox_dead_letter`: eventos que requieren intervención.
- `park_plaza_outbox_oldest_age_seconds`: edad del evento pendiente más antiguo.
- `park_plaza_outbox_events_total{status="sent|retry|dead_letter|requeued"}`: resultados de despacho y recuperación.

Alertar cuando el evento pendiente más antiguo supere 60 segundos, cuando exista cualquier evento `dead_letter` no esperado o cuando `processing` crezca sostenidamente sin que aumenten los eventos `sent`.

## Límites conocidos

La entrega realtime es at-least-once porque Socket.IO no ofrece una confirmación durable coordinada con PostgreSQL. Los consumidores deben tratar eventos repetidos de forma idempotente usando el identificador del agregado y el estado recibido. La deduplicación end-to-end queda como trabajo posterior si se necesita una garantía más fuerte.
