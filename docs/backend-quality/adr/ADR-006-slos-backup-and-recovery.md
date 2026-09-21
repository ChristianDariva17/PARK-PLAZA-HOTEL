# ADR-006: SLO, backup y recuperación

Estado: propuesta operativa para Fase 8  
Fecha: 2026-09-17

## Contexto

Existe un runbook de backup cifrado con `age` y restore aislado. El runbook indica que RPO, RTO, schedule, retención, storage externo y restore drill deben ser definidos por operación. Compose provee volumen persistente, pero ese volumen no es un backup.

## Decisión

Usar como propuesta inicial disponibilidad mensual de 99.5%, RPO de 24 horas y RTO de 2 horas. Estos valores serán confirmados por producto/operaciones antes de convertirse en alertas o compromisos.

Los backups de producción deberán:

- Salir del host de aplicación hacia storage externo cifrado.
- Mantener checksum y metadatos de fecha/versión.
- Tener retención documentada.
- Probarse mediante restore aislado con evidencia.
- Escalar a WAL archiving o snapshots gestionados si el RPO requerido es menor que el intervalo de dump.

## Recuperación de aplicación

- Desplegar imágenes inmutables.
- Ejecutar migraciones compatibles antes de enviar tráfico.
- Usar readiness como gate.
- Hacer rollback de aplicación sin intentar rollback destructivo de esquema.
- Resolver incompatibilidades de schema mediante forward-fix o restauración ensayada.

## Criterio de aceptación

Los owners aprueban RPO/RTO y retención, un restore drill cumple el objetivo, las alertas tienen runbook y un release puede promocionarse o revertirse con evidencia.
