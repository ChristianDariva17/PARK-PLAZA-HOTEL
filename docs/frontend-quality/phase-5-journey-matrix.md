# Fase 5: matriz de journeys críticos

Este documento define el contrato UX común para los journeys operativos. Reservas, check-in, pedidos, caja, folio, check-out, limpieza y mantenimiento están implementados.

## Contrato de estados

| Estado | Comportamiento obligatorio |
| --- | --- |
| Precondiciones | Explicar qué falta antes de habilitar la acción principal. |
| Validación | Mostrar error junto al campo, marcar `aria-invalid` y conservar los datos. |
| Confirmación | Presentar resumen de la operación antes de la mutación irreversible. |
| Progreso | Deshabilitar sólo las acciones afectadas, mostrar progreso y `aria-busy`. |
| Éxito | Mostrar feedback accionable y actualizar la vista sin recarga global. |
| Error | Usar mensaje seguro, indicar la acción siguiente y mantener los datos. |
| Conflicto | Recargar el límite afectado, bloquear reintento ciego y permitir actualizar. |
| Cancelación | Permitir cancelar sin perder datos no enviados cuando sea seguro. |
| Recuperación | Reintentar el módulo o la operación después de reconciliar el estado. |

## Journeys

| Journey | Precondiciones | Mutación | Conflictos | Recuperación | Estado |
| --- | --- | --- | --- | --- | --- |
| Reserva | Fechas válidas, huésped activo, disponibilidad consultada y habitación seleccionada | Crear reserva pendiente | Habitación ocupada, intervalo inválido, respuesta ambigua | Actualizar reservas y disponibilidad antes de reintentar | Implementado en este corte |
| Check-in | Reserva elegible, identidad y condiciones requeridas | Guardar documento firmado, abrir estadía y folio | Reserva no elegible, habitación no disponible, firma inválida | Mantener formulario y revalidar la reserva | Implementado en este corte |
| Pedido | Mesa/estadía válida, ítems con cantidad positiva | Crear pedido y reservar inventario | Stock insuficiente, orden duplicada, menú desactualizado | Recargar inventario y conservar carrito | Implementado en este corte |
| Caja | Caja abierta, folio válido, monto y método válidos | Registrar cargo/pago/reverso | Saldo concurrente, monto inválido, cierre en curso | Reconciliar folio antes de repetir | Implementado en este corte |
| Check-out | Estadía activa, folio conciliado, pendientes resueltos | Cerrar estadía y liberar habitación | Saldo pendiente, operación concurrente | Volver al folio con datos actualizados | Implementado en este corte |
| Limpieza | Habitación/estadía válida, estado operativo compatible | Cambiar tarea y estado de habitación | Tarea ya tomada, transición inválida | Recargar tarea y mostrar responsable actual | Implementado en este corte |
| Mantenimiento | Incidencia abierta, permiso y prioridad válidos | Crear/actualizar incidencia | Incidencia resuelta por otra persona | Reconciliar detalle y conservar descripción | Implementado en este corte |

## Corte implementado: reservas

- Validación de fechas, cantidad de huéspedes, huésped principal y habitación seleccionada.
- Errores de campo conectados a `FormField`, con foco en el mensaje global y `aria-invalid`/`aria-describedby`.
- Lock síncrono contra doble submit, además del estado async existente.
- Estados de disponibilidad y creación conservan datos y ofrecen actualización explícita ante conflicto o reconciliación.
- Tarjetas de habitación activables con Enter y Space.
- Los servicios adicionales permanecen visuales hasta que el backend tenga un contrato explícito para persistirlos; no se presentan como parte de la mutación de reserva.

## Corte implementado: check-in

- El documento de condiciones firmado debe guardarse antes de abrir la estadía.
- Un fallo de persistencia detiene el check-in, conserva el flujo y muestra una instrucción de recuperación segura.
- El submit tiene lock síncrono y comunica progreso con `aria-busy`.
- La prueba DOM cubre persistencia única del documento, comando único de check-in y bloqueo ante fallo documental.

## Corte implementado: pedidos

- El carrito exige al menos un producto válido y valida cantidades enteras positivas.
- Cuando las unidades de receta e inventario son compatibles, el formulario calcula un máximo advisory con el stock disponible y evita incrementos imposibles.
- El origen `Habitación` exige una estadía asociada.
- Las mutaciones generan una clave de idempotencia estable durante el intento y el comando genera una clave si otro consumidor no la envía.
- Los errores de validación y stock se muestran dentro del modal, conservando el carrito para corregir o reintentar.
- El KDS y el editor usan `ResourceState` para loading, vacío, error, forbidden y retry; los datos existentes se conservan durante un error de refresh.
- El selector de productos permite Enter/Space y expone roles ARIA de combobox/listbox/option.

## Corte implementado: caja (base operacional)

- La vista de caja expone loading inicial, error recuperable y retry, conservando sesiones y movimientos ya cargados durante un fallo de refresh.
- Apertura de turno valida responsable y fondo inicial, bloquea doble submit y comunica progreso con `aria-busy`.
- Registro de movimientos bloquea doble submit y exige beneficiario y concepto para egresos mayores a S/ 150.00.
- Arqueo y cierre validan monto contado, bloquean doble submit y mantienen la justificación obligatoria ante descuadres significativos.
- La base de caja se mantiene separada del folio: los movimientos de gaveta y las operaciones de cuenta usan sus contratos autoritativos correspondientes.

## Corte implementado: folio + check-out

- `FolioPanel` carga el folio con estados de loading, refresh, error y retry; un fallo conserva el folio ya cargado y ofrece actualización explícita.
- Los pagos, cargos y reversiones validan montos y motivos en la UI, muestran errores junto al campo y conservan los datos del operador.
- Cada intención de pago, cargo o reversión conserva su clave de idempotencia mientras el operador reintenta sin modificar los datos.
- El check-out queda bloqueado hasta que el folio haya cargado; un saldo pendiente exige pago o autorización explícita de cuenta por cobrar.
- Si el folio cargado queda stale o falla una actualización, el check-out se bloquea hasta una reconciliación exitosa.
- El check-out usa lock síncrono, foco en errores y `aria-busy`; el comando existente mantiene la idempotencia y reconciliación autoritativa del backend.

## Secuencia de cortes

- Mantenimiento siguió a limpieza porque ambos journeys comparten asignación, progresión, evidencia y recuperación de conflictos sobre límites operativos autoritativos.

## Corte implementado: limpieza

- Las respuestas de mutación adaptan estados API de tarea y habitación antes de entrar al estado global.
- La carga inicial muestra estados de loading, vacío, error y retry; si falla una actualización conserva las tareas conocidas.
- Asignación, evidencia, progreso, aprobación y reporte de incidencia tienen lock síncrono para evitar doble submit.
- Las mutaciones usan idempotencia y cancelación por generación; una respuesta ambigua reconcilia la lista autoritativa antes de permitir otro intento.
- La aprobación bloquea la habitación durante la transacción y la libera sólo si la tarea asociada a una estadía checked-out es válida; los tickets manuales también liberan la habitación cuando corresponde.
- El backend impide editar o avanzar una tarea ya aprobada y mantiene la transición de habitación dentro de la misma operación autoritativa.

## Validación de este corte

- `npm test`: 70 archivos y 329 tests PASS con pool de threads limitado a 1 worker en este entorno.
- Backend: 72 archivos y 337 tests PASS, excluyendo la suite de integración PostgreSQL.
- `npm run lint`: PASS.
- `npm run build`: PASS, 2034 módulos transformados.
- `git diff --check`: PASS.

## Corte implementado: mantenimiento

- La vista carga tickets desde el backend y expone loading, vacío, error recuperable y retry sin descartar el último estado conocido.
- Crear, actualizar, asignar, iniciar, resolver, cerrar y reabrir usan comandos autoritativos; el reducer confirma el ticket, la incidencia relacionada y el estado de habitación cuando la respuesta lo informa.
- Los formularios bloquean doble submit, conservan los datos ante errores y validan responsable y solución antes de las transiciones que los requieren.
- Las mutaciones usan cancelación por generación y `AbortController`; las respuestas ambiguas reconcilian el listado antes de permitir otro intento.
- El backend mantiene las transiciones esperadas, bloquea conflictos de estado y libera una habitación sólo al cerrar con autorización explícita y sin otro ticket bloqueante.
- Las pruebas cubren adaptación de contrato, estados del reducer y validación estricta de los DTO de mantenimiento.
