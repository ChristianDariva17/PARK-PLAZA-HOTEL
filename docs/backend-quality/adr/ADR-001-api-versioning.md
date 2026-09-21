# ADR-001: versionado URI de la API

Estado: propuesta técnica para Fase 3  
Fecha: 2026-09-17

## Contexto

La API utiliza el prefijo `/api` y el documento OpenAPI declara versión `1.0.0`, pero no existe versionado nativo de rutas. Los dos frontends y el bridge consumen rutas internas del backend. No hay evidencia suficiente para asumir que no existan consumidores externos.

## Decisión

Adoptar versionado por URI con `/api/v1` para el contrato estable. Mantener `/api` solo durante una ventana de migración si el inventario confirma consumidores actuales; no crear una compatibilidad permanente.

La versión del documento OpenAPI debe coincidir con la versión pública del contrato, pero no sustituye el versionado de rutas.

## Plan de migración

1. Confirmar consumidores externos y capturar el contrato `/api` actual.
2. Añadir `/api/v1` mediante una estrategia compatible, sin romper el prefijo actual en el primer despliegue.
3. Migrar `Fronted/`, `Fronted-Cliente/`, bridge y verificadores.
4. Publicar métricas separadas por versión.
5. Anunciar deprecación y retirar `/api` solo después de observar tráfico cero o contar con excepción aprobada.

## Alternativas descartadas

- Header de versión: menos visible en logs, proxies y documentación; más difícil de probar manualmente.
- Subdominio por versión: agrega complejidad DNS e ingress sin beneficio para este monolito.
- No versionar: conserva simplicidad inmediata, pero convierte cualquier cambio incompatible en una migración urgente.

## Consecuencias

- Los clientes deben centralizar el prefijo base y no concatenar `/api` en cada módulo.
- OpenAPI, E2E, rate limits, métricas y logs deben distinguir la versión.
- La compatibilidad temporal duplica superficie de prueba; tendrá fecha de retiro explícita.

## Criterio de aceptación

Existe una matriz de consumidores aprobada, `v1` documentada, diff OpenAPI en CI, migración de clientes completa y plan de retiro del prefijo legado.
