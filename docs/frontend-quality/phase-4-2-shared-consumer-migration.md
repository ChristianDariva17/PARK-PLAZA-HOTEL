# Fase 4.2: migración incremental de consumidores UI

Este corte extiende el uso de las primitivas compartidas sin hacer una migración global ciega.

## Cambios

- `ParkingView` usa `FilterBar` con la región `Filtros de cochera`.
- `PetsView` usa `FilterBar` con la región `Filtros de mascotas`.
- `CustomersView` usa `FilterBar` con la región `Filtros de clientes`.
- `ReservationsView` usa `FilterBar` con la región `Filtros de reservas`.
- `RecreationView` usa `FilterBar` con la región `Filtros de recreación`.
- Se conservaron los controles, clases internas y comportamiento de filtrado existentes.
- Se amplió la matriz de variantes de `StatusBadge`, `PageHeader` y `DataTable`.

## Pruebas

- La suite DOM avanzada valida tonos green/blue/yellow/purple/red/gray, autorización de acciones, estados de tabla y filtros compartidos.
- `formInfrastructure.test.js` verifica que los cinco consumidores usan el contrato `FilterBar`.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run --exclude e2e src/components/ui/formInfrastructure.test.js src/components/ui/uiAdvancedInteractions.test.jsx --maxWorkers=1` | PASS, 25 tests |
| `npm test` | PASS, 60 archivos y 293 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2033 módulos transformados |

## Alcance restante

Persisten filtros especializados en otras vistas, confirmaciones nativas y algunos estados locales que requieren decisiones propias del flujo. Se migrarán por slices separados para evitar alterar contratos de negocio o acciones destructivas.
