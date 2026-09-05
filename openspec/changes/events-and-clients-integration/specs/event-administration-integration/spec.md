# Especificación de Integración Administrativa de Eventos

## Propósito

Ofrecer un contrato único y determinista para lista, calendario, editor y detalle, integrado con backend y aislado por propiedad.

## Requisitos

### Requisito: Recurso compartido y espacios activos

El sistema DEBE exponer el mismo recurso DTO de evento para lista, calendario, editor y detalle, con refresco localizado tras comandos. El calendario DEBE ser determinista. Los espacios DEBEN cargarse solo como catálogo de activos y ser de solo lectura; no se admite CRUD de espacios.

#### Escenario: Representación consistente
- DADO un evento visible para la propiedad
- CUANDO se consulta desde lista, calendario, editor y detalle
- ENTONCES todas las vistas muestran el mismo evento y datos normalizados sin recarga completa.

#### Escenario: Espacio inactivo
- DADO un evento que referencia un espacio inactivo históricamente
- CUANDO se consulta el evento o se intenta asignarlo a una nueva operación
- ENTONCES la referencia histórica se conserva y la nueva asignación se rechaza.

### Requisito: Comandos autorizados, versionados e idempotentes

Crear, editar, confirmar, cancelar y archivar eventos DEBE exigir autorización, identidad de propiedad, fechas válidas y versión esperada. Una versión obsoleta DEBE responder 409 sin sobrescribir cambios. Un reintento con la misma clave idempotente DEBE devolver el mismo resultado sin duplicar la mutación.

#### Escenario: Conflicto y recuperación
- DADO un evento cuya versión cambió desde la lectura
- CUANDO se envía un comando con versión obsoleta
- ENTONCES responde 409 con estado vigente y permite reintentar tras actualizar.

#### Escenario: Reintento idempotente
- DADO un comando válido con clave idempotente repetida
- CUANDO se procesa por segunda vez
- ENTONCES devuelve el resultado original y mantiene una sola mutación.

### Requisito: Disponibilidad, fechas y errores

El sistema DEBE validar intervalos con inicio anterior a fin, rangos solicitados y disponibilidad del espacio. Debe responder 403, 404 o 409 según autorización, aislamiento/ausencia o conflicto de estado/disponibilidad, con mensaje accionable y sin cambios parciales.

#### Escenario: Rango válido y disponible
- DADO un rango válido y un espacio activo disponible
- CUANDO se consulta o guarda el evento
- ENTONCES devuelve el conjunto determinista del rango y persiste el comando autorizado.

#### Escenario: Rango inválido o ocupado
- DADO un inicio igual/posterior al fin o una superposición existente
- CUANDO se consulta disponibilidad o se guarda
- ENTONCES responde 409, explica la corrección requerida y no modifica datos.

### Requisito: Importe estimado no contable

El importe estimado DEBE ser informativo y DEBE quedar fuera de cargos, pagos, impuestos, reversas y asientos de folio.

#### Escenario: Mostrar estimación
- DADO un evento con importe estimado
- CUANDO se crea, edita o consulta
- ENTONCES se muestra como estimación y no genera ningún movimiento contable.
