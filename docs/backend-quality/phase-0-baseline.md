# Fase 0: baseline y alcance del backend

Fecha de referencia: 2026-09-17  
Alcance: `Backend/`, integraciones de `Fronted/`, `Fronted-Cliente/`, `compose.yaml`, `ops/` y `.github/workflows/`  
Estado: baseline técnico completado; aprobación de objetivos operativos pendiente  
Cambios de comportamiento: ninguno

## Propósito

Establecer una referencia reproducible antes de modificar contratos, consultas, seguridad, arquitectura o operación del backend. Esta referencia permite distinguir regresiones nuevas de limitaciones ya existentes y evita versionar o refactorizar sin conocer a los consumidores actuales.

## Quick path

1. Revisar la matriz de rutas en [`phase-0-api-inventory.md`](phase-0-api-inventory.md).
2. Revisar las decisiones propuestas en [`adr/`](adr/).
3. Obtener aprobación de los puntos marcados como `PENDIENTE DE APROBACIÓN`.
4. Usar este documento como gate antes de iniciar la Fase 1.

## Condición del worktree

El worktree ya contenía cambios modificados y archivos no trackeados en backend, frontend, operaciones, configuración y workflows antes de iniciar esta fase. Esos cambios fueron preservados y no se usaron como base para inferir autoría.

Los únicos archivos agregados por esta fase son los documentos bajo `docs/backend-quality/` y sus ADRs.

No se leyeron ni copiaron valores de archivos `.env`, credenciales, tokens o secretos.

## Entorno observado

| Componente | Versión o configuración observada |
| --- | --- |
| Node.js | `v22.16.0` local; el backend declara `>=22` |
| npm | `11.6.2` local |
| NestJS | `11.2.3` |
| Fastify | `5.12.4` |
| TypeScript | `5.9.2` |
| Drizzle ORM | `0.45.2` |
| PostgreSQL | `17-bookworm` en Compose y CI |
| Redis | `7-alpine` en Compose |
| Vitest | `3.2.4` |
| Oxlint | `1.75.0` |
| OpenAPI | `@nestjs/swagger` `11.4.7`, documento OpenAPI 3 generado en runtime no productivo |
| Métricas | `@prometheus-io/client` `0.16.1` |
| CI | GitHub Actions en `.github/workflows/verification.yml` |

## Validaciones reproducidas

Los comandos se ejecutaron desde `Backend/`, excepto los comandos de conteo de inventario que se ejecutaron desde la raíz.

| Comando | Resultado | Evidencia |
| --- | --- | --- |
| `npm run lint` | PASS con advertencias | Oxlint termina correctamente, pero informa advertencias de imports/variables sin uso y objetos thenable en tests |
| `npm run typecheck` | PASS | TypeScript termina sin errores con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` |
| `npm run build` | PASS | `nest build` termina correctamente |
| `npm test` | PASS | 72 archivos de test y 337 tests |
| `npm run test:coverage` | PASS | 72 archivos y 337 tests; cobertura global reportada: 49.4% statements/lines, 55.61% branches, 56.71% functions |
| `npm run test:integration` | NO EJECUTADO EN ESTA FASE | Requiere PostgreSQL disponible y una base preparada |
| `npm run verify:contract` | NO EJECUTADO EN ESTA FASE | Requiere API iniciada y accesible en `/api/docs-json` |

La cobertura actual cumple los thresholds declarados para la selección de archivos críticos, pero no representa cobertura global del backend. No debe usarse como único indicador de calidad.

## Reproducción del conteo estático

Desde la raíz del repositorio, los conteos se pueden repetir con estos comandos de PowerShell:

```powershell
$controllers = @(rg -l '@Controller\(' 'Backend/src' -g '*.controller.ts')
$routes = @(rg -n '^\s*@(Get|Post|Put|Patch|Delete|Options|Head)\(' 'Backend/src' -g '*.controller.ts')
$permissions = @(rg -n '@RequirePermissions\(' 'Backend/src' -g '*.controller.ts')
$idempotency = @(rg -n 'idempotency-key|Idempotency-Key' 'Backend/src' -g '*.controller.ts')
```

El resultado debe registrarse junto con la fecha si se usa como evidencia de una revisión.

## Conteo estático de superficie

El conteo fue realizado sobre el estado actual del código, usando decoradores NestJS:

| Elemento | Conteo | Interpretación |
| --- | ---: | --- |
| Controladores | 33 | Monolito modular con dominios de hotel, cliente, auth y plataforma |
| Declaraciones de rutas HTTP | 204 | Incluye rutas públicas, staff, customer, health y métricas |
| Decoraciones `@RequirePermissions` | 171 | La diferencia no implica automáticamente una falla: incluye rutas públicas, auth, customer guards y endpoints que requieren revisión explícita |
| Referencias de header de idempotencia en controladores | 36 | La política existe, pero no está aplicada de forma uniforme en todas las mutaciones |
| Decoradores de operación `@ApiOperation/@ApiResponse/@ApiParam/@ApiQuery/@ApiHeader` en controllers | 0 | OpenAPI depende principalmente de inferencia de NestJS; existe una extensión custom `x-required-permissions` |
| Versionado nativo NestJS encontrado | 0 | No existe `enableVersioning` ni `Version()` |

Los conteos son un baseline y deben repetirse después de cambios de contrato. No son un objetivo de reducción por sí mismos.

## Controles existentes

| Control | Estado actual | Evidencia | Brecha para fases siguientes |
| --- | --- | --- | --- |
| OpenAPI | Parcialmente implementado | `Backend/src/openapi.ts`, `/api/docs-json` fuera de producción | Faltan descripciones completas, respuestas por operación, versionado y diff breaking-change |
| Validación | Mixta y razonable | `ValidationPipe` global, Zod parsers y DTOs | Hay controladores con `unknown`/`any`; falta una convención única y validación completa de parámetros/headers |
| Errores | Envelope global existente | `HttpExceptionFilter` devuelve `statusCode`, `error`, `message`, `requestId` | Falta código de error de dominio y formato Problem Details estable |
| Autenticación | Separada por tipo de usuario | `SessionGuard`, `CustomerSessionGuard`, cookies opacas y sesiones PostgreSQL | Falta matriz completa de rutas públicas y pruebas automatizadas de exposición accidental |
| Autorización | RBAC global y permisos por ruta | `PermissionsGuard`, `RequirePermissions` | Faltan reglas automáticas que exijan autorización en cada endpoint no público |
| Idempotencia | Implementada en varios comandos | `Idempotency-Key`, `command_receipts`, fingerprints SHA-256 | Falta una política transversal, expiración documentada y cobertura de todas las mutaciones |
| Versionado | No implementado | OpenAPI tiene versión de documento `1.0.0` | Definir `/api/v1` y ventana de migración de consumidores |
| Paginación | Parcial | DTOs de eventos, folios, comunicaciones y otros listados | Auditar todos los listados y fijar límite máximo común |
| Migraciones | Implementadas | Drizzle migrations hasta sentinel `0057_property_scoped_outbox_relationships` | Separar rol migrador de rol de aplicación y documentar rollback expand-contract |
| Integridad multi-property | Fuerte en dominios críticos | FKs compuestas, índices únicos, checks y tests PostgreSQL | Mantener la invariante en cada migración nueva |
| Transacciones | Usadas en operaciones críticas | Drizzle transactions y locks advisory por property/account | El flujo de inventario tiene N+1 dentro de transacciones |
| Pool y timeouts | Parcialmente implementados | `connectionTimeoutMillis`, `idleTimeoutMillis`, `statement_timeout` | Agregar timeout HTTP, cancelación de dependencias y métricas de espera por pool |
| Rate limiting | Implementado | Throttler local y storage Redis en `shared` | Definir límites por familia y alertar por abuso real |
| TLS | Configurable para PostgreSQL | `DATABASE_SSL` y proxy Nginx disponible | TLS del borde, HSTS y Redis seguro quedan para operación productiva |
| Auditoría | Persistente y append-only | `audit_events`, triggers y `AuditService` | Definir retención, acceso, alertas y redacción de metadata |
| Outbox | Implementado | `OutboxService`, estados pending/processing/sent | Falta clasificación de errores, máximo de intentos y DLQ |
| Health/readiness | Implementados | `/api/health/live` y `/api/health/ready` | Readiness debe considerar drain y dependencias necesarias |
| Logs | Parcialmente estructurados | HTTP/Redis/DB emiten JSON en algunos puntos | `RealtimeGateway` y outbox todavía mezclan texto, PII y errores crudos |
| Métricas | Implementadas | Prometheus para HTTP, pool, outbox y realtime | Faltan tracing, alertas, SLO y métricas de edad de outbox |
| Backups | Runbook y scripts existentes | `ops/README.md`, dump cifrado con `age`, restore aislado | RPO/RTO, retención, storage externo y restore drill no están definidos por un owner |
| CI | Fuerte para validación | lint, tipos, build, tests, coverage, integración, audit, contrato y E2E | Faltan SAST/DAST, carga, SBOM, CD y rollback probado |

## Mapa de arquitectura actual

| Zona | Ubicación | Responsabilidad actual | Evaluación |
| --- | --- | --- | --- |
| Transporte | `src/**/*.controller.ts`, `src/main.ts` | Rutas, extracción de request, parsers, cookies, headers y respuesta | Los controladores suelen ser delgados, pero algunos contienen transformación y validación inline |
| Aplicación | `src/*/*.service.ts` | Casos de uso, autorización contextual, transacciones y composición de persistencia | Existe como servicios Nest, sin una frontera explícita de casos de uso independiente del framework |
| Dominio | Reglas dentro de services y parsers | Estados de reservas, estadías, caja, folios, inventario y operaciones | No existe una zona `domain`; varias reglas no pueden probarse sin mocks de ORM |
| Infraestructura | `src/database`, `src/infrastructure`, `src/observability` | Drizzle/PostgreSQL, Redis, métricas y lifecycle | Está parcialmente separada; los services importan schema y ORM directamente |
| Integraciones | Google/Firebase, Socket.IO, Nginx, Compose | Auth externa, realtime, proxy y dependencias de runtime | Requieren contratos, timeouts y circuit breakers explícitos en fases futuras |

La arquitectura actual debe considerarse un **monolito modular**, no una arquitectura Clean/Hexagonal completa. La Fase 5 hará un piloto acotado en restaurante/outbox y no una reescritura global.

## Consumidores conocidos

| Consumidor | Ubicación | Superficie | Estado del inventario |
| --- | --- | --- | --- |
| Frontend administrativo | `Fronted/src/` | Clientes de auth, accounts, rooms, reservations, stays, restaurant, cash, cleaning, documents, events, suppliers y demás módulos | Consumidor interno conocido; requiere migración coordinada si se agrega `/api/v1` |
| Portal de cliente | `Fronted-Cliente/src/` | `customer/auth`, `customer/reservations`, `customer/restaurant`, `customer/amenities`, `customer/events` y Socket.IO | Consumidor interno conocido; contract admission documenta rutas principales |
| Bridge biométrico | `Fronted/bridge/` y attendance | Capacidad biométrica y reporte de asistencia | Requiere contrato operativo y pruebas de abuso |
| Google/Firebase | `auth` y `customer-auth` | Google OAuth y Firebase token exchange | Dependencia externa; timeout presente solo para consulta de contraseña comprometida, no como política general |
| Realtime | `Fronted/src/realtime`, `Fronted-Cliente/src/realtime` | `/api/socket.io` | Compartido entre clientes; requiere versionado y compatibilidad de eventos |
| Verificador de contrato | `ops/verify-api-contract.mjs` | `/api/docs-json` | Gate interno; valida una muestra de paths, schemas y permisos |
| Consumidores externos no identificados | Repositorio actual | No hay evidencia de SDK público o cliente externo | PENDIENTE DE APROBACIÓN: confirmar con operación si existe alguno antes de versionar |

## Baseline de riesgos técnicos

| Prioridad | Riesgo | Evidencia actual | Fase objetivo |
| --- | --- | --- | --- |
| P0 | N+1 en reserva/consumo de inventario | `RestaurantService` consulta cada ítem dentro de loops de ingredientes | Fase 1 |
| P0 | Outbox reintenta errores permanentes sin límite terminal | `OutboxService` convierte cualquier excepción en `pending` con backoff | Fase 2 |
| P0 | Rol de aplicación comparte configuración de migraciones | `setup` y `api` reciben el mismo `Backend/.env` en Compose | Fase 4 |
| P1 | Contrato no versionado | Solo existe versión del documento OpenAPI | Fase 3 |
| P1 | Contrato OpenAPI incompleto | No hay decoradores `@Api*` explícitos y el verificador cubre una muestra | Fase 3 |
| P1 | Logs con PII y formato mixto | Gateway registra email y usa strings interpolados | Fase 4 y Fase 6 |
| P1 | Tracing ausente | No se encontró OpenTelemetry | Fase 6 |
| P1 | Pruebas de carga y seguridad ausentes | CI no ejecuta k6, ZAP, CodeQL ni Trivy | Fase 7 |
| P1 | CD y rollback no demostrados | Existe CI y Compose, pero no promoción/rollback automatizado | Fase 8 |
| P2 | Arquitectura no enforceada | Servicios importan directamente Drizzle/schema | Fase 5 |
| P2 | Lint con deuda | El comando pasa con advertencias | Fase 7 |

## SLO y budgets iniciales

Los valores siguientes son una propuesta técnica para iniciar medición. No son todavía un compromiso de negocio ni un SLA.

| Indicador | Objetivo inicial propuesto | Fuente | Alerta inicial propuesta | Owner pendiente |
| --- | --- | --- | --- | --- |
| Disponibilidad API | >= 99.5% mensual, excluyendo mantenimiento anunciado | Health checks y métricas HTTP | Burn rate sobre error budget | Operaciones |
| Lecturas HTTP | p95 <= 500 ms; p99 <= 1.5 s | Histograma Prometheus | Dos ventanas consecutivas fuera de objetivo | Backend |
| Comandos HTTP | p95 <= 1 s; p99 <= 3 s | Histograma Prometheus | Dos ventanas consecutivas fuera de objetivo | Backend |
| Respuestas 5xx | < 1% de requests, separado por dependencia | Métricas HTTP | Ventana de 5 minutos y burn rate | Operaciones |
| Pool PostgreSQL | `waitingCount` cercano a 0 sostenido | Métricas de pool | Espera sostenida o utilización > 80% | DBA/infra |
| Outbox | Evento más antiguo < 60 s en operación normal | Tabla y métricas outbox | Warning a 60 s, critical a 5 min | Backend/operaciones |
| DLQ | 0 eventos no investigados | Métricas y tabla outbox | Critical ante cualquier evento no esperado | Backend |
| Rate limit | Sin crecimiento sostenido de 429 legítimos | Métricas HTTP | Correlacionar con abuso antes de escalar capacidad | Seguridad |
| RPO | 24 h como punto de partida | Runbook de backup | Fallo si el backup válido más reciente supera RPO | Operaciones |
| RTO | 2 h como punto de partida | Restore drill | Fallo si servicio no vuelve a readiness | Operaciones |

PENDIENTE DE APROBACIÓN: producto y operaciones deben confirmar disponibilidad, latencias, capacidad, RPO, RTO, retención, ventana de mantenimiento y owners antes de convertir estos valores en gates.

## Herramientas previstas

La lista completa está en el anexo persistido en Engram `#6690`. Para esta fase se clasifican así:

| Prioridad | Herramientas |
| --- | --- |
| Próximo gate | Spectral, oasdiff, dependency-cruiser, pg_stat_statements, Pino/nestjs-pino, OpenTelemetry, CodeQL, Gitleaks, Trivy, OWASP ZAP, Testcontainers y Grafana k6 |
| Mantener | Nest Swagger, Zod, class-validator, Drizzle, pg, Helmet, Throttler, Prometheus, Vitest, Playwright y outbox propio |
| Condicionales | Cockatiel, BullMQ, Pact, Sentry, pganalyze, autocannon, madge, Syft, Grype, ADR tools y GitOps |

No se instalarán herramientas solo por aparecer en la lista. Cada adopción deberá vincularse a una brecha, un owner y un criterio de salida.

## Gate de salida de la Fase 0

- [x] Baseline de lint, tipos, build, tests y coverage registrado.
- [x] Conteo estático de controladores, rutas, permisos e idempotencia registrado.
- [x] Consumidores internos conocidos identificados.
- [x] Mapa de arquitectura actual documentado como monolito modular.
- [x] Riesgos priorizados y asignados a fases posteriores.
- [x] SLO/RPO/RTO iniciales propuestos.
- [x] ADRs de las decisiones técnicas creados.
- [x] Cambios ajenos preservados.
- [x] Sin cambios de comportamiento en código de aplicación.
- [ ] Owners y objetivos operativos aprobados por producto/operaciones.
- [ ] Confirmación de consumidores externos no identificados.

## Estado de habilitación

La Fase 1 puede comenzar técnicamente porque el baseline y los riesgos están documentados. El versionado público y los gates operativos definitivos permanecen bloqueados hasta resolver los dos puntos de aprobación pendientes.

## Siguiente acción

Iniciar la Fase 1 con el flujo de inventario de restaurante, usando los tests actuales de propiedad/concurrencia como red de seguridad y agregando una prueba que demuestre la reducción de consultas.
