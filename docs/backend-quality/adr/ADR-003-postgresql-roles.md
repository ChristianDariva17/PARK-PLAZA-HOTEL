# ADR-003: separación de roles PostgreSQL

Estado: descartada por decisión del proyecto  
Fecha: 2026-09-17

## Contexto

El servicio `setup` ejecuta migraciones, bootstrap y provisioning, mientras que `api` atiende tráfico. En Compose ambos reciben el mismo archivo de entorno, por lo que no existe evidencia de separación entre permisos DDL y permisos de runtime.

## Decisión

Mantener una única identidad PostgreSQL para `setup`, el API y las herramientas operativas. No se implementará la separación entre roles migrador, runtime y readonly en esta fase.

La decisión prioriza la simplicidad operativa y evita una migración de credenciales y ownership sobre el volumen actual. El costo aceptado es que el API conserva privilegios administrativos de PostgreSQL; este riesgo queda documentado y no debe confundirse con el aislamiento de propiedades ni con la autorización de negocio.

## Alternativa descartada

- Separar roles: mejora el mínimo privilegio, pero requiere provisionamiento de credenciales, transferencia de ownership y una migración coordinada del volumen existente.
- ORM con migraciones al arrancar el API: acopla disponibilidad a DDL y dificulta rollback.
- RLS como sustituto de roles: RLS puede complementar aislamiento, pero no reemplaza separación DDL/DML.

## Criterio de aceptación

La decisión queda explícita para evitar que una futura tarea implemente la separación accidentalmente. Cualquier cambio posterior deberá aprobarse como una migración de infraestructura independiente.
