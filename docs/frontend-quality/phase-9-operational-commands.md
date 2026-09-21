# Fase 9: extracción de comandos operativos

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para Cleaning, Incidents y Maintenance

Esta numeración continúa las fases verticales de extracción de dominios. En el plan maestro de Engram corresponde a la continuación de la Fase 2.

## Objetivo

Extraer del provider la coordinación de limpieza, incidencias y mantenimiento sin romper sus comandos públicos, sus transiciones del reducer ni los refreshes cruzados.

## Nuevo controlador

`Fronted/src/operations/useOperationalCommands.js` concentra:

- Carga generacional y cancelación de Cleaning, Incidents y Maintenance.
- Reset al cambiar identidad autenticada o cerrar sesión.
- Validación de permisos de lectura para cada recurso.
- Permisos de escritura para crear, actualizar y avanzar incidencias y tickets.
- Idempotencia y cancelación de comandos de Cleaning.
- Adaptación de respuestas antes de enviarlas al reducer.
- Refresh cruzado de Cleaning hacia Rooms e Incidents.
- Sincronización de la incidencia creada junto con un ticket de Maintenance.

El provider conserva las mismas superficies:

```text
cleaningCommands.reload/create/update/progress/reportIncident
incidentCommands.reload/create/update/progress
maintenanceCommands.reload/create/update/progress
```

## Decisión de composición

Los tres dominios se mantienen en un único controlador porque Cleaning necesita refrescar Incidents y Rooms, mientras que Stays consume `reloadCleaning`. Separarlos en hooks independientes obligaría a introducir referencias circulares o a duplicar la coordinación entre bounded contexts.

## Robustez de refresh

Los refreshes posteriores a una mutación se ejecutan como promesas protegidas. Si el usuario puede mutar un dominio pero no leer otro dominio relacionado, un `403` del refresh no convierte una mutación ya confirmada en un falso fallo.

## Pruebas

Se agregó `Fronted/src/operations/useOperationalCommands.test.js`, con cobertura de:

- Commit de una mutación de Cleaning aunque fallen refreshes relacionados.
- Validación de permisos de escritura en Incidents y Maintenance.

`Fronted/src/state/HotelContext.lifecycle.test.js` verifica que el provider delega el grupo operativo y ya no declara su lógica inline.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 52 archivos y 254 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2016 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `471.14 kB` sin comprimir.

## Estado del provider

`HotelContext.jsx` ya no contiene lógica específica de Restaurant, Guests, Rooms, Reservations, Stays, Cash, Cleaning, Incidents ni Maintenance. Conserva la composición global y los dominios pendientes, incluyendo Parking y Pets.
