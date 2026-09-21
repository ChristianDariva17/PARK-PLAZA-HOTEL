# ADR-007: límites arquitectónicos incrementales

Estado: aceptada para piloto incremental de Fase 5  
Fecha: 2026-09-17

## Contexto

El backend tiene módulos NestJS por dominio, pero los servicios importan directamente Drizzle y los schemas. No existe una capa `domain` ni reglas de dependencias automatizadas. Una migración global a Clean Architecture tendría alto riesgo y poco valor si se hace antes de corregir contratos, observabilidad y datos.

## Decisión

Tratar el sistema como monolito modular y establecer límites progresivos:

- Transporte: controllers, guards y DTO HTTP.
- Aplicación: casos de uso y puertos.
- Dominio: reglas puras e invariantes de negocio.
- Infraestructura: Drizzle, PostgreSQL, Redis, proveedores y exporters.

El primer piloto será restaurante/outbox. Se agregarán reglas de `dependency-cruiser` para impedir imports no permitidos. Los repositorios/puertos se extraerán solo donde mejoren testabilidad o reduzcan acoplamiento real.

## Alternativas descartadas

- Reescritura de todos los módulos: gran superficie y riesgo de regresión.
- Microservicios: no hay límite de escala/ownership que lo justifique.
- Dejar límites como convención informal: la deuda reaparece sin un gate automatizado.

## Criterio de aceptación

El piloto separa reglas de inventario de persistencia, pasa tests unitarios sin ORM para reglas principales y CI bloquea nuevas dependencias prohibidas.
