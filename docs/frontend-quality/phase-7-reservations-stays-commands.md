# Fase 7: extracción de comandos Reservations y Stays

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para los bounded contexts Reservations y Stays

Esta numeración continúa las fases verticales de extracción de dominios. En el plan maestro de Engram corresponde a la continuación de la Fase 2, no a la Fase 7 maestra de rendimiento y bundle.

## Objetivo

Separar de `HotelContext.jsx` las operaciones de reservas y recepción manteniendo contratos estrictos, control generacional, cancelación, idempotencia y reconciliación autoritativa.

## Reservations

Se movió a `Fronted/src/reservations/useReservationCommands.js`:

- Carga y reset de reservas persistentes.
- Consulta de disponibilidad.
- Creación de reservas.
- Detalle de reserva.
- Lifecycle de confirmación, cancelación y disposición.
- Validación de permisos de lectura, creación y lifecycle.
- Reconciliación de reservas y disponibilidad ante errores ambiguos o stale.
- Control separado para carga, disponibilidad, creación y lifecycle.

La API pública preservada es:

```text
reservationCommands.reload
reservationCommands.availability
reservationCommands.create
reservationCommands.detail
reservationCommands.lifecycle
reservationCommands.clearAvailability
reservationCommands.refreshForRetry
```

## Stays

Se movió a `Fronted/src/stays/useStayCommands.js`:

- Carga y reset de estadías persistentes.
- Check-in y check-out con claves de idempotencia.
- Validación de permisos de recepción.
- Control generacional y cancelación de comandos.
- Reconciliación posterior con Reservations, Stays, Rooms y Cleaning.
- Estados `saving`, `reconciling`, `success`, `error` y cancelación mediante el reducer existente.

La API pública preservada es:

```text
stayCommands.reload
stayCommands.checkIn
stayCommands.checkOut
```

## Corrección incluida

El flujo de reconciliación de recepción recarga cuatro recursos:

```text
reservations, stays, rooms, cleaning
```

`stayReconciliationSucceeded` sólo aceptaba tres resultados, por lo que cualquier error ambiguo de check-in/check-out terminaba bloqueando el retry aunque las cuatro recargas fueran exitosas. La política ahora valida los cuatro resultados.

## Pruebas

Se agregaron:

- `Fronted/src/reservations/useReservationCommands.test.js`.
- `Fronted/src/stays/useStayCommands.test.js`.
- Ownership de Reservations/Stays en `Fronted/src/state/HotelContext.lifecycle.test.js`.
- Cobertura actualizada de `stayReconciliationSucceeded`.

Las pruebas cubren creación y lifecycle de reservas, claves de idempotencia, permisos de recepción, commits adaptados y refresh coordinado de los cuatro recursos.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 50 archivos y 247 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2014 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `469.26 kB` sin comprimir.

## Estado del provider

`HotelContext.jsx` ya no contiene lógica específica de:

- Restaurant.
- Guests.
- Rooms.
- Reservations.
- Stays.

El siguiente corte es Cash, mientras que la Fase 3 maestra de división de `App.jsx` y vistas agregadas debe esperar a completar más bounded contexts.
