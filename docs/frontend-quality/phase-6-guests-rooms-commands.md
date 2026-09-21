# Fase 6: extracción de comandos Guests y Rooms

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para los bounded contexts Guests y Rooms

Esta numeración continúa las fases verticales del slice de dominios. En el plan maestro de Engram corresponde a la continuación de la Fase 2, no a la Fase 6 maestra de responsive, accesibilidad y loading.

## Objetivo

Reducir el acoplamiento de `HotelContext.jsx` extrayendo las lecturas, cancelación, generaciones y comandos de huéspedes y habitaciones sin cambiar la API pública consumida por las vistas ni el reducer autoritativo.

## Qué salió de HotelContext

### Guests

Se movió a `Fronted/src/guests/useGuestCommands.js`:

- Carga generacional y abortable de huéspedes.
- Reset por cambio de identidad o logout.
- `reload`, `create`, `update`, `archive` y `reactivate`.
- Preservación de datos locales derivados al adaptar respuestas remotas.
- Cancelación y reconciliación cuando el backend recomienda recargar.
- Validación de autenticación y permisos.

### Rooms

Se movió a `Fronted/src/rooms/useRoomCommands.js`:

- Carga generacional y abortable del inventario de habitaciones y categorías.
- Reset por cambio de identidad o logout.
- `reload`, `update`, `updateCategory` y `setBlocked`.
- Validación estricta de respuestas mediante los adaptadores existentes.
- Cancelación de mutaciones obsoletas y reconciliación después de conflictos.
- Validación de permisos de lectura, edición y bloqueo.

Las fábricas `createGuestCommands` y `createRoomCommands` permiten probar la lógica sin incorporar una librería de testing de hooks.

## API pública preservada

Las vistas siguen recibiendo la misma forma desde `useHotelCommands()`:

```text
guestCommands.reload
guestCommands.create
guestCommands.update
guestCommands.archive
guestCommands.reactivate

roomCommands.reload
roomCommands.update
roomCommands.updateCategory
roomCommands.setBlocked
```

También se preservan los callbacks `reloadRooms` usados internamente por los flujos de estadías y limpieza.

## Corrección incluida

`archiveGuestCommand` y `reactivateGuestCommand` utilizaban `GUESTS_ARCHIVE`, una acción que no existe en `permissionForAction`. Eso hacía que ambas operaciones fueran rechazadas aunque la cuenta tuviera `guests.archive`.

Ahora usan `CLIENT_ARCHIVE` y `CLIENT_REACTIVATE`, que sí resuelven a `PERMISSIONS.guestsArchive`.

## Pruebas

Se agregaron:

- `Fronted/src/guests/useGuestCommands.test.js`.
- `Fronted/src/rooms/useRoomCommands.test.js`.
- Ownership de Guests y Rooms en `Fronted/src/state/HotelContext.lifecycle.test.js`.

Los tests cubren commits adaptados, permisos, CRUD de huéspedes, bloqueo de habitaciones, actualización de categorías y preservación de la superficie pública del provider.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 48 archivos y 243 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2012 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `467.57 kB` sin comprimir.

## Estado del provider

`HotelContext.jsx` sigue siendo el compositor global, pero ya no contiene la lógica específica de:

- Recursos y comandos Restaurant.
- Recursos y comandos Guests.
- Recursos y comandos Rooms.

El siguiente corte de mayor riesgo es Reservations/Stays, porque cruza reservas, estadías, habitaciones, limpieza y folios.
