# Fase 5: límites arquitectónicos incrementales

Estado: en progreso; piloto de inventario iniciado

## Alcance del piloto

La Fase 5 no reescribe el backend ni lo convierte en microservicios. El primer corte separa las reglas puras de inventario de la persistencia del restaurante:

- `Backend/src/restaurant/inventory-domain.ts` contiene conversiones de unidades y cálculo de requerimientos.
- `Backend/src/restaurant/inventory-domain.ts` también produce planes puros para reservar, consumir y devolver stock.
- `Backend/src/restaurant/order-domain.ts` contiene la estación de preparación y el cálculo puro de líneas y total de comandas.
- `Backend/src/restaurant/order-domain.ts` también valida la transición lineal y las condiciones terminales de las comandas.
- `Backend/src/audit/outbox-domain.ts` contiene clasificación de fallos y cálculo de backoff.
- `RestaurantService` conserva transacciones, locks, consultas Drizzle y escrituras del ledger.
- `OutboxService` conserva claims, transacciones, métricas y emisión realtime.

## Gate de dependencias

`Backend/.dependency-cruiser.cjs` bloquea imports de NestJS, Drizzle, PostgreSQL, Redis y módulos de infraestructura desde el dominio de inventario.

```powershell
cd Backend
npm run architecture:check
```

## Criterios de aceptación

- [x] Las conversiones y requerimientos de inventario se pueden probar sin ORM.
- [x] Las políticas de clasificación y backoff del outbox se pueden probar sin ORM ni realtime.
- [x] El servicio conserva la semántica transaccional existente.
- [x] CI/local tiene un gate reproducible para imports prohibidos.
- [x] Extender el mismo límite al cálculo de comandas, eliminando duplicación entre creación y edición sin mover persistencia.
- [x] Extraer la política de avance de estado sin mover locks, folio, inventario ni outbox.

## Fuera de alcance

- Migración global de todos los servicios.
- Creación de repositorios por adelantado.
- Separación de roles PostgreSQL.
- Microservicios.
