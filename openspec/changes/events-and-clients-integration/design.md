# Diseño: Integración administrativa de Eventos y Clientes

## Enfoque técnico

Se integran Eventos en NestJS/Drizzle y React mediante un DTO único y `EventsResourceProvider` en `EventsModuleRoot`; lista, calendario, editor y detalle no recargan la página. La identidad canónica es una parte discriminada existente de la misma propiedad (`guest` o `customerAccount`), sin crear perfiles. Espacios es catálogo activo y el importe estimado es informativo; no invoca `FolioService`.

## Decisiones de arquitectura

| Decisión | Alternativa y coste | Elección y razón |
|---|---|---|
| Identidad canónica y migración revisada | Elegir huésped o cuenta automáticamente puede alterar referencias sin respaldo. | Inventariar cada evento existente; poner en cuarentena los casos con huésped, cuenta, ambos o ninguno; un responsable autorizado debe clasificarlos explícitamente antes de imponer exactamente una FK. No hay valor predeterminado automático. |
| Autorización de huéspedes | Tratar la matriz `guests.archive/reactivate` como decisión de producto retrasa trabajo verificable. | Primera unidad/gate de implementación: verificar la matriz contra el código actual de autorización, backend y frontend; documentar el permiso efectivo y después implementar comandos/UI conforme a esa evidencia. |
| Concurrencia y reintentos | Confiar en cliente pierde actualizaciones o duplica mutaciones. | Transacción, versión esperada y recibo idempotente con huella y respuesta almacenada. |
| Lifecycle y estado web | Transiciones implícitas y recursos aislados producen incoherencia. | Máquina de estados cerrada; proveedor único que actualiza/invalida el ítem y rango visible. |

## Flujo de datos

```text
Vista -> EventsResourceProvider -> eventsClient -> EventsController
                                             -> autorización + EventsService/tx
                                             -> evento + recibo + auditoría
                                             <- DTO o replay almacenado

Eventos existentes -> inventario -> cuarentena -> clasificación autorizada
                                               -> migración verificable -> restricción canónica
```

El controlador deriva actor y `propertyId` de sesión, exige permiso y busca solo en esa propiedad (ausente/ajeno: 404). El servicio valida payload, estado, versión, espacio y disponibilidad en transacción; 403 no muta ni revela datos, y 409 no deja cambios parciales.

## Contratos de comandos y estados

Todos los comandos llevan `Idempotency-Key` no vacío y se autorizan en cada intento. El recibo se indexa por propiedad, acción, evento y clave; guarda huella, HTTP y cuerpo. Misma clave/huella reproduce el resultado; misma clave con otra huella responde 409 `IDEMPOTENCY_KEY_REUSED`. Recibo, mutación, auditoría y respuesta ocurren en una transacción.

| Comando | Autorización y versión | Transición válida |
|---|---|---|
| Crear | Permiso de crear; `expectedVersion: 0`; parte, fechas y espacio válidos. | `nuevo -> DRAFT` |
| Editar | Permiso de editar; versión vigente. | `DRAFT|CONFIRMED -> mismo estado` |
| Confirmar | Permiso de confirmar; versión vigente. | `DRAFT -> CONFIRMED` |
| Cancelar | Permiso de cancelar; versión vigente. | `DRAFT|CONFIRMED -> CANCELLED` |
| Archivar | Permiso de archivar; versión vigente. | `CANCELLED -> ARCHIVED` |

Versión distinta responde 409 `VERSION_CONFLICT` con `current`; transición no permitida, 409 `INVALID_STATE_TRANSITION`. `CANCELLED` y `ARCHIVED` no se editan.

```ts
type EventParty = { type: 'guest' | 'customerAccount'; id: string };
type EventCommand = { expectedVersion: number; idempotencyKey: string };
type LegacyIdentityClassification = 'guest' | 'customerAccount' | 'both' | 'neither';
```

La clasificación conserva categoría, responsable autorizado, decisión explícita, fecha y auditoría. Solo una decisión `guest` o `customerAccount` aprobada permite fijar `EventParty`; `both` y `neither` permanecen en cuarentena hasta resolución explícita.

## Archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `Backend/src/events/events.dto.ts`, `events.controller.ts`, `events.service.ts` | Modificar | DTO, autorización, estados, versión, replay, disponibilidad, auditoría y clasificación controlada. |
| `Backend/src/guests/guests.dto.ts`, `guests.controller.ts`, `guests.service.ts` | Modificar tras gate 1 | Archivo/reactivación conforme a la matriz de permisos verificada. |
| `Backend/src/database/schema/events.schema.ts`, `guests.schema.ts`, `Backend/drizzle/0024_events_clients_integration.sql` | Modificar/crear | Recibos, inventario/cuarentena/clasificación auditada, índices y restricción posterior a clasificación. |
| `Fronted/src/events/{EventsModuleRoot,useEventsResource,eventsClient,EventCalendarView,EventEditor,EventDetailDrawer,EventsListView}.jsx/js` | Modificar | Recurso compartido, rangos deterministas, contratos y errores. |
| `Fronted/src/guests/{guestsClient,guestModel}.js`, `Fronted/src/components/views/CoreViews.jsx` | Modificar tras gate 1 | Lifecycle autorizado y estado archivado. |
| `Backend/test/{events-*.spec.ts,guests-*.spec.ts}`, `Fronted/src/events/*.test.jsx` | Crear/modificar | Contratos, gate de autorización, cuarentena y refresco localizado. |

## Pruebas, observabilidad y amenazas

| Capa | Verificación |
|---|---|
| Backend unit/integración | RED para matriz `guests.archive/reactivate`, 403/404, versión, transiciones, replay, disponibilidad e inventario/cuarentena de las cuatro categorías. |
| Frontend Vitest | Permiso efectivo, proveedor único, refresco local, calendario determinista y 403/404/409. |
| E2E | No hay runner detectado; recorrido manual posterior con dos propiedades. |

Registrar 403/404/409, replay, bloqueos, rechazos de disponibilidad y conteos de cuarentena por `requestId`, sin PII. Matriz de amenazas: N/A — no hay routing, shell, subprocesos, automatización VCS/PR, clasificación ejecutable ni integración de procesos.

## Migración, despliegue y reversión

**Migración revisada:** inventariar eventos y registrar las categorías huésped, cuenta, ambos o ninguno; todos pasan por cuarentena de clasificación. Un responsable autorizado confirma la identidad canónica o conserva el caso como no resuelto. No se borran, reasignan, excluyen ni eligen identidades por defecto. La restricción canónica se activa únicamente tras clasificación autorizada, auditoría y verificación de que no quedan filas pendientes.

El gate 1 verifica y prueba la matriz existente de autorización de `guests.archive/reactivate`; no requiere otra decisión de producto. Desplegar contrato/telemetría, migración aprobada, backend y frontend bajo indicador. `ask-on-risk` detiene el avance si falla el gate o quedan casos sin clasificar. Revertir indicador/endpoints sin borrar datos ni auditoría.

No incluye CRUD de espacios, recurrencia, servicios, excepciones, historial o búsqueda enriquecidos de clientes, pagos ni movimientos de folio.

## Preguntas abiertas

Ninguna de producto. El gate 1 determina y prueba la aplicación efectiva de permisos existentes antes de modificar lifecycle o UI.
