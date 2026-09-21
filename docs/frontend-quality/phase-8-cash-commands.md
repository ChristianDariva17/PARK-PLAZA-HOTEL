# Fase 8: extracción de comandos Cash

Fecha de implementación: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada para el bounded context Cash

Esta numeración continúa las fases verticales de extracción de dominios. En el plan maestro de Engram corresponde a la continuación de la Fase 2, no a la Fase 8 maestra de seguridad y observabilidad.

## Objetivo

Separar de `HotelContext.jsx` la carga y operación de caja manteniendo el contrato financiero actual, los permisos, los refreshes autoritativos, los arqueos históricos y la idempotencia generada por el cliente.

## Qué salió de HotelContext

Se movió a `Fronted/src/cash/useCashCommands.js`:

- Carga generacional de sesión abierta, historial, movimientos y arqueos.
- Reset por cambio de identidad o logout.
- `reload` y carga de detalles históricos de una sesión.
- Apertura de caja.
- Arqueo de caja.
- Cierre de caja.
- Registro de movimientos de efectivo.
- Validación de permisos y adaptación de respuestas.
- Refresh autoritativo después de operaciones mutantes.

La API pública preservada es:

```text
cashCommands.reload
cashCommands.loadDetails
cashCommands.open
cashCommands.count
cashCommands.close
cashCommands.move
```

## Contrato financiero preservado

- Los movimientos siguen restringidos a `Efectivo` mediante `CASH_PAYMENT_METHODS`.
- Los DTOs continúan usando `countedAmount`, `note`, `referenceId` y `method`.
- La clave `idempotency-key` sigue generándose dentro de `cashClient.js` por comando.
- Las respuestas se adaptan antes de entrar al reducer.
- Las operaciones exitosas recargan la fuente autoritativa de caja.

La carga histórica de movimientos y arqueos ahora valida también autenticación y `cash.read` antes de consultar la sesión solicitada.

## Pruebas

Se agregó `Fronted/src/cash/useCashCommands.test.js`, con cobertura de:

- Apertura y commit de sesión.
- Registro y commit de movimiento de efectivo.
- Refresh posterior a operaciones.
- Rechazo por permiso insuficiente.

`Fronted/src/state/HotelContext.lifecycle.test.js` verifica el ownership del nuevo controlador y que el provider ya no declare la lógica Cash inline.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 51 archivos y 251 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2015 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

El JS inicial quedó en `469.66 kB` sin comprimir.

## Estado del provider

`HotelContext.jsx` ya no contiene lógica específica de Restaurant, Guests, Rooms, Reservations, Stays ni Cash. El provider conserva la composición global y los dominios operativos pendientes.

El siguiente corte recomendado es la extracción de operaciones restantes: Cleaning, Incidents y Maintenance como grupo operativo coordinado.
