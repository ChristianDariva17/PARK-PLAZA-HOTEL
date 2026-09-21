# Fase 10: métricas, rollout y mantenimiento

Estado: slice 10.1 implementado; budgets y telemetría listos para validar en staging.

Esta es la Fase 10 del plan maestro definido en Engram `#6496/#6497`. No debe confundirse con las fases verticales de dominios.

## Métricas implementadas

- `GET /api/metrics` expone métricas Prometheus del backend, protegido por `METRICS_TOKEN` en producción.
- `park_plaza_http_requests_total` y `park_plaza_http_request_duration_seconds` miden volumen y duración por método, ruta normalizada y status.
- `park_plaza_client_events_total` mide fallos de requests, estado WebSocket y errores de chunks.
- `park_plaza_client_retries_total` mide requests de lectura completados después de un retry.
- `park_plaza_client_web_vitals` recibe `LCP`, `INP` y `CLS` desde el frontend con rutas de baja cardinalidad y sin PII.
- `npm run metrics:bundle --prefix Fronted` produce un reporte JSON de JS inicial, CSS inicial y mayor chunk asíncrono.
- `ops/observability/grafana/frontend-quality-dashboard.json` define el tablero versionable de API, Web Vitals, retries, WebSocket, outbox y conexiones realtime.

## Budgets de no regresión

| Métrica | Budget raw | Fuente |
| --- | ---: | --- |
| JS inicial | 540 KiB | `Fronted/scripts/bundle-metrics.mjs` |
| CSS inicial | 100 KiB | `Fronted/scripts/bundle-metrics.mjs` |
| Mayor JS asíncrono | 440 KiB | `Fronted/scripts/bundle-metrics.mjs` |

Estos límites son gates de no regresión, no SLA. Deben recalibrarse después de tres corridas reproducibles en staging.

## Baseline local actual

Generado por `npm run build --prefix Fronted` y `npm run metrics:bundle --prefix Fronted`:

| Métrica | Resultado raw | Resultado gzip |
| --- | ---: | ---: |
| JS inicial | 257.94 KiB | 80.92 KiB |
| CSS inicial | 31.77 KiB | 6.89 KiB |
| Mayor JS asíncrono | 375.64 KiB | 110.68 KiB |

Este baseline es local y sirve para detectar regresiones del build. No sustituye la medición de Web Vitals en staging.

## Validación del slice

- Frontend: 83 suites y 353 tests con `--pool=threads --no-file-parallelism`.
- Backend: 75 suites y 355 tests.
- Frontend format check, Oxlint, backend typecheck y builds: PASS.
- E2E público y autenticado: 35 tests PASS.
- Bundle budgets: PASS para las tres métricas.
- `git diff --check`: PASS.

## Rollout y rollback

1. Ejecutar `npm run build --prefix Fronted`.
2. Ejecutar `npm run metrics:bundle --prefix Fronted` y conservar el JSON en el reporte de CI.
3. Ejecutar `npm run bundle:check --prefix Fronted`; cualquier exceso bloquea el rollout.
4. Comparar en staging tres corridas de LCP, INP y CLS antes de modificar budgets.
5. Si la telemetría del navegador genera ruido o volumen inesperado, reconstruir temporalmente con `VITE_CLIENT_TELEMETRY=false`.
6. Si un cambio de métricas afecta el backend, revertir el slice de observabilidad sin revertir cambios de negocio.

## Pendientes de la Fase 10

- Provisionar el dashboard versionable en Grafana del entorno de staging.
- Registrar baselines de LCP, INP y CLS por ruta a partir de tres corridas reproducibles.
- Definir objetivos de producción con datos reales, no con valores arbitrarios.
- Añadir el checklist de aprobación y rollback al proceso de release.
