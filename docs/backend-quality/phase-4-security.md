# Fase 4: seguridad y privilegios mínimos

Fecha del primer corte: 2026-09-17  
Estado: en progreso; controles de runtime y DAST implementados, operación productiva pendiente

## Configuración segura de runtime

El API valida antes de inicializar NestJS que:

- una ejecución `production` tenga `METRICS_TOKEN` configurado;
- una ejecución `shared` tenga `REDIS_URL` configurado;
- una ejecución `production` use TLS PostgreSQL por defecto mediante `DATABASE_SSL_REQUIRED=true`.

Esto evita arrancar una instancia con métricas públicas o con infraestructura compartida incompleta. Las reglas complementan las validaciones específicas de `MetricsController` y `RedisService`.

La configuración TLS de PostgreSQL usa `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED` y `DATABASE_SSL_CA`. En producción, `DATABASE_SSL_REQUIRED=true` bloquea el arranque sin TLS verificado. Compose local declara `DATABASE_SSL_REQUIRED=false` porque su PostgreSQL no está provisionado con certificados; esa excepción no debe copiarse a producción.

Redis valida que `REDIS_TLS` coincida con el esquema de `REDIS_URL`: `redis://` para plaintext local y `rediss://` con `REDIS_TLS=true` para transporte TLS. En producción compartida, `REDIS_TLS_REQUIRED=true` por defecto bloquea el arranque sin TLS; Compose local lo desactiva explícitamente porque su Redis no tiene certificados. `REDIS_TLS_CA` permite inyectar una CA confiable cuando el proveedor no usa la trust store del sistema. El cliente aplica estas opciones a cada conexión Redis.

## Redacción de errores

Los logs de errores de pool PostgreSQL, Redis, disponibilidad de reservas y scripts de provisioning ya no copian mensajes de excepción arbitrarios. Solo registran:

- tipo de error;
- código de error cuando cumple un formato acotado y no contiene datos sensibles.

Los logs HTTP y de errores inesperados ya mantenían esta política al no incluir mensajes internos ni payloads.

## Gates de supply-chain

`.github/workflows/security.yml` incorpora:

- Gitleaks con `.gitleaks.toml` y salida redacted;
- CodeQL para JavaScript/TypeScript;
- Trivy sobre la imagen runtime del backend, bloqueando vulnerabilidades `HIGH` y `CRITICAL` detectables;
- Dependabot semanal para npm y GitHub Actions.

Estos gates no reemplazan revisión de permisos, rotación de credenciales ni escaneo DAST.

## DAST baseline

`.github/workflows/verification.yml` levanta el API contra PostgreSQL efímero y ejecuta `zap-api-scan.py` en modo seguro (`-S`) sobre `/api/docs-json`. El escaneo importa las rutas OpenAPI sin ejecutar mutaciones activas y conserva los reportes HTML/JSON como artefactos de CI. Los warnings no bloquean el gate (`-I`); los fallos de ZAP sí. La validación local actual terminó con `0 FAIL` y sin respuestas `500`.

El baseline no autentica usuarios ni sustituye una prueba DAST autenticada contra los journeys críticos. Esa cobertura requiere credenciales efímeras y un contexto ZAP separado.

## Decisión de roles PostgreSQL

El proyecto mantiene una única identidad PostgreSQL para `setup`, el API y las herramientas operativas. La separación entre roles migrador, runtime y readonly queda descartada para esta fase.

Esto evita una migración coordinada de credenciales y ownership sobre el volumen actual. Como riesgo aceptado, el API conserva privilegios administrativos de PostgreSQL; la autorización de negocio, el aislamiento por propiedad y las validaciones de integridad siguen siendo responsabilidades separadas.

## Gestión de secretos

Los secretos de runtime deben vivir en el gestor de secretos del ambiente y nunca en el repositorio, imágenes Docker, artefactos CI o archivos `.env` compartidos. Los owners son roles operativos, no personas codificadas en la aplicación:

- Plataforma/infraestructura: PostgreSQL, Redis, TLS del borde y certificados.
- Backend: `METRICS_TOKEN`, secretos de sesión e integraciones de aplicación.
- Seguridad: aprobación de rotaciones, respuesta ante exposición y revisión de accesos.

La rotación debe ejecutarse como mínimo cada 90 días y de inmediato ante sospecha de exposición. Cada cambio requiere actualizar el gestor de secretos, reiniciar de forma controlada las instancias consumidoras y verificar health, métricas y autenticación. La rotación productiva debe hacerse fuera de este repositorio; este documento define el control, no almacena valores.

## Pendiente

- Provisionar y probar TLS interno de PostgreSQL/Redis en el ambiente productivo.
- Provisionar TLS del borde y habilitar HSTS únicamente detrás de HTTPS terminado correctamente.
- Ejecutar la primera rotación controlada de secretos con los owners definidos.

## Gates locales

- `npx vitest run test/runtime-security.spec.ts test/http-exception.filter.spec.ts test/observability.spec.ts`: 13 tests PASS.
- `npm test`: 76 archivos, 357 tests PASS.
- `npm run test:integration`: 29/29 tests PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run lint`: PASS con warnings existentes/no bloqueantes.
- Gitleaks: sin leaks en `Backend/src`, `Fronted/src`, `Fronted-Cliente/src` y `.github`.

El escaneo del árbol completo local también detecta archivos ignorados que no forman parte del repositorio (`Backend/.env`, `Fronted/.env.local` y `Fronted-Cliente/dist`). No se agregaron allowlists para ocultarlos; el workflow escanea el checkout limpio de CI.
