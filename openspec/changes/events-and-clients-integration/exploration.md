# Exploración: integración administrativa de eventos y clientes

## Resumen ejecutivo

La pantalla administrativa de Clientes ya consume parcialmente el módulo persistente de huéspedes mediante `HotelContext` y `/api/guests`, pero presenta una brecha funcional entre el modelo histórico del frontend y el contrato actual del backend: no existe operación administrativa de archivo/reactivación, búsqueda/paginación servidor, ni historial enriquecido. Eventos tiene un cliente HTTP y controladores backend reales, pero la composición de vistas todavía es de MVP: cada vista crea su propio recurso, el guardado fuerza `window.location.reload()`, el calendario renderiza eventos de forma aleatoria y el editor/detalle requieren alineamiento explícito con permisos, estados, cliente/huésped y versión.

El plan recomendado es integrar por contratos, sin conservar CRUD paralelo en `hotelReducer`: primero consolidar modelos y recursos server-state; después completar comandos y permisos de Clientes; finalmente endurecer Eventos, espacios, disponibilidad e integración con reservas/estadías y folios.

## Estado actual verificado

### Navegación y permisos

- `Fronted/src/App.jsx` expone `clientes`, `eventos` y `calendario-eventos`.
- `Fronted/src/components/layout/navigation.js` declara las tres entradas administrativas.
- `Fronted/src/auth/permissions.js` declara `guests.read/create/update/archive/biometric` y `events.read/create/update/confirm/cancel/archive`.
- `Backend/src/events/events.controller.ts` protege cada endpoint con `@RequirePermissions`; `PermissionsGuard` exige todas las capacidades declaradas y trabaja sobre permisos de la cuenta autenticada.

### Clientes / huéspedes

- `Fronted/src/components/views/customers/CustomersView.jsx` lista `state.clients`, filtra y pagina localmente, muestra fidelización/historial esperado por el prototipo y usa `guestCommands.create/update`.
- `Fronted/src/state/HotelContext.jsx` centraliza carga y comandos de huéspedes; `guestsClient.js` sólo implementa `GET /api/guests`, `POST /api/guests` y `PATCH /api/guests/:guestId`.
- `Backend/src/guests/guests.controller.ts` sólo ofrece esos tres endpoints. No hay endpoint de archivo/reactivación, aunque el frontend declara ambos permisos y el reductor valida ambas acciones.
- `GuestsService` devuelve datos persistentes de huésped y documento primario, con aislamiento por `propertyId`, auditoría, bloqueo transaccional y rechazo de edición de archivados. El listado no devuelve visitas, fidelización ni historial de reservas/estadías.
- El modelo de UI usa nombres derivados (`name`, `documentType`, `loyaltyTier`, `visits`) que deben seguir siendo adaptadores y no mezclarse con el DTO persistente.

### Eventos y espacios

- `Fronted/src/events/eventsClient.js` implementa listado paginado, espacios activos, detalle, creación, actualización optimista por `expectedVersion`, confirmación, cancelación y archivo, todos con `idempotencyKey`.
- `useEventsResource` carga espacios y eventos, pero `EventsListView`, `EventCalendarView` y `EventsModuleRoot` crean instancias independientes; filtros y refresh no son compartidos.
- `EventsModuleRoot` declara `refresh` sin usarlo y, al guardar o actuar sobre un evento, recarga toda la página.
- `EventCalendarView.jsx` contiene renderizado no determinista (`Math.random()`), por lo que no representa de forma fiable el conjunto devuelto por el backend.
- `EventsService` filtra por propiedad, rango solapado, espacio, estado y título; devuelve espacio y huésped. Los detalles no incluyen actualmente cliente externo, servicios, recurrencia, excepciones ni un conjunto de acciones permitidas.
- El esquema persistente ya contempla `events`, `event_spaces`, `event_services`, recurrencia, excepciones y comandos idempotentes. El controller, DTO y servicio sólo exponen CRUD/lifecycle básico; no hay endpoints administrativos para espacios, servicios, recurrencia o excepciones.
- `createEvent` siempre fuerza estado `draft`; `updateEvent` sólo verifica disponibilidad cuando el evento ya está confirmado. La inserción de comandos usa `onConflictDoNothing`, pero no recupera la respuesta previa ni valida fingerprint, por lo que la semántica idempotente debe revisarse.
- `EventsService` llama a auditoría sin `await` y no pasa contexto de request; debe verificarse contra la política de auditoría existente.

### Dependencias de reservas, estadías y folios

- Reservas y estadías ya tienen contratos persistentes, aislamiento por propiedad, estados y comandos idempotentes.
- Un evento puede enlazar un `guestId` o un `customerAccountId`, mientras que reservas/estadías usan huéspedes; la propuesta debe definir si el cliente externo es una cuenta de cliente o un huésped creado/seleccionado.
- `EventsModule` importa `FolioModule`, pero el servicio observado no materializa cargos en folio. El importe estimado no debe convertirse en cobro hasta definir contrato de confirmación, cancelación, reversa e identidad contable.

## Brechas concretas y dependencias

| Prioridad | Brecha | Dependencia / resultado esperado |
|---|---|---|
| P0 | Cliente no puede archivar/reactivar de forma persistente | Definir endpoints, reglas de reservas/estadías activas, auditoría y actualización del contexto |
| P0 | Eventos no comparten estado entre lista, calendario, editor y detalle | Un único recurso elevado al root, invalidación localizada y manejo de abort/concurrencia |
| P0 | Contratos de fecha, estado, cliente y espacio no están normalizados en UI | Adaptadores DTO explícitos y validación previa coherente con Zod/backend |
| P0 | Calendario es aleatorio y no representa rango/filtros | Render determinista, navegación temporal, solapamientos y estados reales |
| P1 | Eventos no validan siempre disponibilidad al editar y no exponen acciones permitidas | Reglas de lifecycle/transición y conflicto 409 visible |
| P1 | Listado de huéspedes sólo tiene paginación local y respuesta mínima | Decidir si el volumen permite carga completa; si no, endpoint de búsqueda/paginación |
| P1 | Espacios son sólo lectura y no hay administración | Definir si el alcance incluye alta/edición/inactivación de espacios |
| P1 | Servicios, recurrencia y excepciones existen en esquema pero no en API | Separar MVP de integración completa y diseñar contratos antes de UI |
| P2 | Historial/fidelización mostrado por el frontend no proviene del backend | Endpoint de resumen o eliminación explícita de datos demo |
| P2 | Folio/importes de eventos no tienen frontera contable | Decisión de negocio antes de conectar `FolioService` |

## Áreas afectadas

- `Fronted/src/App.jsx`, `Fronted/src/components/layout/navigation.js`, `Fronted/src/auth/permissions.js` — rutas, visibilidad y capacidades.
- `Fronted/src/components/views/customers/CustomersView.jsx`, `Fronted/src/guests/guestsClient.js`, `Fronted/src/guests/guestModel.js`, `Fronted/src/state/HotelContext.jsx`, `Fronted/src/state/hotelReducer.js` — integración y eliminación de estado demo.
- `Fronted/src/events/eventsClient.js`, `useEventsResource.js`, `EventsModuleRoot.jsx`, `EventsListView.jsx`, `EventCalendarView.jsx`, `EventEditor.jsx`, `EventDetailDrawer.jsx` — recurso, UX y contratos de eventos.
- `Backend/src/guests/*`, `Backend/src/events/*`, `Backend/src/database/schema/{guests,events,reservations,stays}.schema.ts`, módulos de auth/audit/folios — API, persistencia, seguridad y dependencias.

## Enfoques considerados

1. **Parche incremental sobre el estado actual** — añadir comandos faltantes manteniendo `hotelReducer` y recargas de página.
   - Ventajas: menor cambio inicial.
   - Desventajas: conserva dos fuentes de verdad, datos demo y carreras entre vistas.
   - Esfuerzo: Medio; no recomendado.

2. **Integración por recursos persistentes y contratos explícitos** — elevar el recurso de eventos, mantener huéspedes como fuente server-side, introducir adaptadores, comandos lifecycle y actualización/invalidation local.
   - Ventajas: una fuente de verdad, errores 409/403 visibles, mejor trazabilidad y base para reservas/estadías.
   - Desventajas: requiere revisar modelos y pruebas de contrato en ambos frontends/backend.
   - Esfuerzo: Alto; recomendado.

3. **Reemplazo por una capa genérica de data-fetching** — migrar ambos módulos a una librería de caché remota.
   - Ventajas: invalidación y deduplicación resueltas por infraestructura.
   - Desventajas: añade dependencia y migración transversal innecesaria para este cambio.
   - Esfuerzo: Alto; dejar como evolución posterior.

## Recomendación de implementación

Adoptar el enfoque 2 en fases verificables:

1. **Contrato y seguridad:** documentar DTOs de huésped/evento, estados, errores 403/404/409, idempotencia, aislamiento de propiedad y matriz de permisos.
2. **Clientes:** completar archive/reactivate con auditoría y reglas contra reservas/estadías activas; decidir búsqueda/paginación e historial; adaptar la respuesta persistente a la vista sin fabricar métricas.
3. **Eventos núcleo:** consolidar un único `useEventsResource` en `EventsModuleRoot`, reemplazar recargas por refresh/invalidation, hacer calendario determinista y alinear editor/detalle con DTOs y permisos.
4. **Disponibilidad y lifecycle:** verificar solapamientos en creación/edición según estado, transiciones válidas, control de versión y respuesta idempotente; incluir cliente huésped/cuenta de forma explícita.
5. **Extensiones:** administrar espacios, servicios, recurrencia y excepciones sólo después de cerrar sus contratos; conectar folios únicamente con decisión contable aprobada.
6. **Verificación:** pruebas de controller/service y clientes/adaptadores; escenarios Given/When/Then para propiedad, permisos, duplicados, conflictos, archivo, reactivación y solapamientos.

## Riesgos

- Cambiar `state.clients` sin migrar consumidores de reservas, búsqueda global y estadías puede romper referencias históricas.
- Permitir archivo de huéspedes con reservas/estadías históricas requiere conservar referencias y bloquear sólo actividad vigente.
- La combinación `guestId`/`customerAccountId` puede producir perfiles duplicados si no se define una regla de identidad.
- La idempotencia actual puede responder de forma distinta ante reintentos con la misma clave; corregirla exige preservar compatibilidad con comandos ya almacenados.
- Fechas con zona horaria, calendario y rango inclusivo/exclusivo pueden producir solapamientos inconsistentes entre navegador y PostgreSQL.
- El review budget de 800 líneas requiere dividir la implementación en unidades pequeñas: clientes, eventos núcleo y extensiones.

## Listo para propuesta

**Sí**, con tres decisiones de alcance explícitas en la propuesta: (1) archive/reactivate persistente de Clientes, (2) si espacios son sólo catálogo o CRUD administrativo, y (3) si confirmación de Evento crea cargos en folio o sólo conserva importe estimado. La propuesta debe mantener la estrategia `ask-on-risk` para cambios destructivos, migraciones y decisiones contables.
