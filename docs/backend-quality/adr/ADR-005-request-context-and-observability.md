# ADR-005: contexto de request y observabilidad

Estado: propuesta técnica para Fase 6  
Fecha: 2026-09-17

## Contexto

El servidor usa `request.id`, devuelve `X-Request-Id` y registra métricas HTTP. Algunos logs están serializados como JSON, pero otros son strings interpolados y el gateway incluye información personal. No existe tracing distribuido.

## Decisión

Adoptar logging estructurado con Pino/nestjs-pino y contexto por request. El servidor aceptará un request ID solo si cumple una validación segura; de lo contrario generará uno nuevo. El ID se devolverá en `X-Request-Id`, se incluirá en auditoría y se propagará a dependencias.

Adoptar OpenTelemetry con exportación OTLP para HTTP, PostgreSQL, Redis, Socket.IO relevante y outbox. Los atributos sensibles serán redacted antes de exportar.

## Reglas de privacidad

- No registrar cookies, tokens, passwords, emails ni payloads completos.
- Preferir `accountId`, `propertyId` y `socketId` cuando sean necesarios y estén autorizados.
- No incluir SQL completo ni parámetros sensibles en spans.
- Los errores para logs internos deben conservar tipo y código, no secretos ni mensajes externos sin sanitizar.

## Alternativas descartadas

- Solo `console.log`: no permite consultas, correlación ni retención operable.
- Tracing propietario desde el inicio: crea lock-in antes de medir la necesidad.
- Generar un ID nuevo en cada capa: rompe la correlación extremo a extremo.

## Criterio de aceptación

Una request puede seguirse desde ingress/API hasta PostgreSQL/Redis/outbox; dashboards y alertas usan métricas de síntomas; los tests verifican redacción de PII.
