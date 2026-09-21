# Checklist de calidad para cambios backend

Usar este checklist en cada PR que modifique `Backend/`, migraciones, contratos, Compose, workflows u operaciones.

## Alcance y contrato

- [ ] La matriz [`phase-0-api-inventory.md`](phase-0-api-inventory.md) fue actualizada si cambia una ruta, permiso, DTO, status code, header o consumidor.
- [ ] El cambio indica si afecta `/api`, `/api/v1`, Socket.IO o un contrato externo.
- [ ] OpenAPI refleja paths, parámetros, body, responses, errores y permisos.
- [ ] No se introduce un breaking change sin diff aprobado y plan de migración.
- [ ] Cada mutación declara la política de `Idempotency-Key`.
- [ ] Los errores nuevos usan códigos estables y no exponen detalles internos.

## Seguridad

- [ ] El endpoint tiene guard y permiso explícitos, o una excepción pública documentada.
- [ ] Se verifica aislamiento por `propertyId` en queries, relaciones y mutaciones.
- [ ] Los datos de entrada tienen validación de tipo, formato, tamaño y rango.
- [ ] No se incorporan secretos, credenciales, cookies, tokens ni PII a código, fixtures o logs.
- [ ] Se agregan tests para autenticación, autorización, abuso y cross-property cuando aplica.
- [ ] La migración no amplía privilegios del rol de runtime sin justificación.

## Datos y transacciones

- [ ] La operación usa la transacción correcta y documenta su frontera.
- [ ] Las consultas están parametrizadas mediante Drizzle o parámetros PostgreSQL.
- [ ] Se revisaron planes `EXPLAIN (ANALYZE, BUFFERS)` si cambia un listado o query de alto tráfico.
- [ ] Los índices nuevos responden a una consulta real y tienen nombre estable.
- [ ] No hay consultas dentro de loops sin una medición que lo justifique.
- [ ] Se prueban rollback, restricciones, FK compuestas y concurrencia cuando aplica.
- [ ] Las migraciones son expand-contract si existe más de una versión de aplicación activa.

## Resiliencia y rendimiento

- [ ] Las dependencias externas tienen timeout explícito y cancelación.
- [ ] Los retries solo cubren errores transitorios, tienen backoff/jitter y máximo.
- [ ] El cambio define comportamiento ante error parcial y caída de dependencia.
- [ ] Los listados tienen paginación, filtros y límite máximo.
- [ ] El cambio no aumenta el backlog del outbox sin métrica o capacidad operativa.
- [ ] Se actualizan métricas y alertas si cambia un SLO o un punto de saturación.

## Observabilidad y operación

- [ ] Los logs son estructurados y contienen `requestId` cuando existe contexto HTTP.
- [ ] Los logs y spans redacted no contienen datos sensibles.
- [ ] Se agregaron métricas de tráfico, latencia, errores o saturación si corresponde.
- [ ] El health check y readiness siguen representando la capacidad real de servir tráfico.
- [ ] Se actualizó el runbook si cambia backup, restore, outbox, migración o rollback.
- [ ] El cambio tiene estrategia de rollback o forward-fix documentada.

## Pruebas y gates

- [ ] `npm run lint` en `Backend/`.
- [ ] `npm run typecheck` en `Backend/`.
- [ ] `npm run architecture:check` en `Backend/`.
- [ ] `npm run build` en `Backend/`.
- [ ] `npm test` en `Backend/`.
- [ ] `npm run test:coverage` si cambia lógica crítica o sus tests.
- [ ] `npm run test:integration` si cambia schema, queries, transacciones o constraints.
- [ ] `npm run verify:contract` si cambia una ruta o DTO.
- [ ] E2E autenticado si cambia un flujo crítico.
- [ ] k6, ZAP, CodeQL, Gitleaks o Trivy si el cambio activa su gate correspondiente.
- [ ] Las advertencias nuevas del linter fueron corregidas o justificadas.

## Revisión

- [ ] El PR modifica un solo work unit o explica las dependencias inevitables.
- [ ] Se identificaron archivos generados y artefactos locales para no incluirlos.
- [ ] Se revisaron cambios de schema y compatibilidad hacia atrás.
- [ ] El autor reportó riesgos, métricas antes/después y pasos de verificación.
- [ ] Un segundo revisor verificó seguridad y datos cuando el cambio los afecta.
