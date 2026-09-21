# Fase 10: extracción de comandos Parking y Pets

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para Parking y Pets

Esta numeración continúa las fases verticales de extracción de dominios. En el plan maestro de Engram corresponde a la continuación de la Fase 2.

## Objetivo

Extraer las operaciones confirmadas de cochera y mascotas de `HotelContext.jsx` manteniendo la validación local, la construcción de DTOs, la reconciliación después de conflictos y las superficies públicas consumidas por las vistas.

## Nuevos controladores

- `Fronted/src/parking/useParkingCommands.js`
- `Fronted/src/pets/usePetCommands.js`

Cada controlador concentra:

- Carga generacional y reset por identidad.
- Cancelación de solicitudes anteriores.
- Validación de permisos de lectura y mutación.
- Validación previa con `validateHotelAction`.
- Construcción de DTOs con el estado proyectado.
- Adaptación de respuestas del servidor.
- Reconciliación mediante `loadOperationalRecords` cuando el cliente informa un conflicto recuperable.

Las superficies preservadas son:

```text
parkingCommands.execute/reload
petCommands.execute/reload
```

## Seguridad de operaciones

`HotelContext.jsx` continúa interceptando `PARKING_*` y `PET_*` en `execute`, evitando mutaciones optimistas. Las mutaciones pasan exclusivamente por los nuevos controladores y `runConfirmedOperationalRequest`, por lo que el reducer sólo recibe registros confirmados por el servidor.

## Pruebas

Se agregaron:

- `Fronted/src/parking/useParkingCommands.test.js`
- `Fronted/src/pets/usePetCommands.test.js`

Cubren creación de registros de visitante, adaptación de respuestas, validación previa y rechazo por permisos insuficientes. `HotelContext.lifecycle.test.js` verifica el ownership de ambos dominios.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 54 archivos y 259 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2018 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `472.15 kB` sin comprimir.

## Estado del provider

`HotelContext.jsx` conserva la composición global, el reducer y los comandos aún no extraídos. Restaurant, Guests, Rooms, Reservations, Stays, Cash, Cleaning, Incidents, Maintenance, Parking y Pets ya no mantienen lógica de dominio inline en el provider.
