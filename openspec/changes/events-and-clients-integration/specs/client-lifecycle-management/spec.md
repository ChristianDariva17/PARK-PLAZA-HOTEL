# Especificación de Gestión del Ciclo de Vida de Clientes

## Propósito

Gestionar clientes/huéspedes persistentes, autorizados y aislados por propiedad sin destruir referencias históricas.

## Requisitos

### Requisito: Archivo y reactivación seguros

El sistema DEBE permitir archivar y reactivar clientes de forma persistente, auditable y autorizada. Un cliente archivado DEBE impedir nuevas operaciones incompatibles, pero sus referencias históricas DEBEN seguir siendo legibles.

#### Escenario: Archivar y reactivar
- DADO un cliente activo y un usuario autorizado de la propiedad
- CUANDO se archiva y luego se reactiva el cliente
- ENTONCES ambos cambios persisten, quedan auditados y el cliente vuelve a admitir operaciones.

#### Escenario: Referencia histórica protegida
- DADO un cliente archivado referenciado por una reserva o estadía histórica
- CUANDO se consulta esa referencia
- ENTONCES se conserva y se muestra sin reactivar ni eliminar al cliente.

#### Escenario: Operación cruzada o incompatible
- DADO un cliente de otra propiedad o un cliente archivado
- CUANDO se intenta modificarlo o iniciar una operación nueva
- ENTONCES el sistema rechaza la solicitud con 404 por aislamiento o 409 por estado incompatible, sin mutación.

### Requisito: Identidad explícita y autorización

El sistema DEBE seleccionar una identidad existente de huésped o cuenta de cliente mediante una regla explícita y DEBE impedir duplicados dentro de la propiedad. Toda lectura y mutación DEBE autorizarse según usuario, propiedad y acción.

#### Escenario: Identidad existente
- DADO un huésped y una cuenta coincidentes en la misma propiedad
- CUANDO se crea o edita un evento
- ENTONCES se vincula la identidad seleccionada explícitamente y no se crea un duplicado.

#### Escenario: Falta de autorización
- DADO un usuario sin permiso para la acción
- CUANDO solicita leer o mutar un cliente
- ENTONCES responde 403 y no revela ni modifica datos.
