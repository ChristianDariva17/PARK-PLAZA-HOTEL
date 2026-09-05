# Propuesta: Integración administrativa de Eventos y Clientes

## Intención

Conectar Clientes y Eventos al backend persistente para sustituir estado/demo y recargas completas por flujos auditables, autorizados y aislados por propiedad, sin alterar reservas, estadías ni contabilidad.

## Alcance

### Incluido
- Archivo y reactivación persistentes de clientes/huéspedes, con permisos, auditoría y bloqueo de nuevas operaciones cuando estén archivados; sus referencias históricas se preservan.
- Recurso único de Eventos para lista, calendario, editor y detalle; adaptadores DTO, refresco localizado, calendario determinista, permisos, versionado, idempotencia y conflictos de disponibilidad/lifecycle visibles.
- Catálogo de espacios de eventos de solo lectura: carga de espacios activos y validación contra disponibilidad. No habrá CRUD administrativo de espacios en esta entrega.
- Regla explícita de identidad para seleccionar huésped o cuenta de cliente sin crear duplicados, manteniendo aislamiento por propiedad.

### Excluido
- CRUD de espacios, servicios, recurrencia, excepciones, búsqueda/historial enriquecido de clientes y migración a una librería de caché.
- Cargos, pagos, impuestos, reversas o asientos de folio: el importe estimado del evento es informativo y no contable hasta aprobación formal del negocio.

## Capacidades

### Nuevas capacidades
- `client-lifecycle-management`: archivo/reactivación persistente y segura de clientes/huéspedes.
- `event-administration-integration`: administración de eventos integrada, determinista y compatible con el backend existente.

### Capacidades modificadas
- Ninguna.

## Enfoque

Primero definir contratos, permisos y errores `403/404/409`; luego implementar lifecycle de Clientes y adaptar sus DTOs. Consolidar Eventos bajo `EventsModuleRoot`, invalidar localmente tras comandos y alinear creación/edición/confirmación/cancelación/archivo con versión, idempotencia y disponibilidad. Mantener espacios como catálogo y aislar cualquier futura frontera contable detrás de un contrato aprobado.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `Fronted/src/guests/*`, `state/HotelContext.jsx` | Modificado | Cliente API, adaptadores y lifecycle persistente. |
| `Fronted/src/events/*` | Modificado | Recurso compartido, calendario y UI por contrato. |
| `Backend/src/guests/*`, `Backend/src/events/*` | Modificado | Endpoints, permisos, auditoría y reglas. |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Archivo rompe operaciones vigentes | Media | Conservar historial y rechazar actividad incompatible. |
| Identidad o fechas inconsistentes | Media | DTOs explícitos, validación y conflictos `409`. |
| Cobro prematuro | Baja | Prohibir integración con folios en este alcance. |

## Plan de reversión

Revertir endpoints y UI de lifecycle/eventos como unidad; no eliminar datos ni referencias históricas. Cualquier migración o cambio destructivo requiere confirmación bajo `ask-on-risk`.

## Dependencias

- Matriz de permisos, auditoría y contratos actuales de huéspedes/eventos.
- Aprobación de negocio independiente antes de cualquier integración contable.

## Criterios de éxito

- [ ] Clientes se archivan/reactivan de forma persistente, auditada y aislada por propiedad.
- [ ] Lista, calendario, editor y detalle muestran el mismo conjunto de eventos sin recargar la página.
- [ ] Conflictos, permisos y reintentos no producen mutaciones cruzadas ni duplicadas.
- [ ] El importe estimado no genera ningún cargo ni movimiento de folio.
