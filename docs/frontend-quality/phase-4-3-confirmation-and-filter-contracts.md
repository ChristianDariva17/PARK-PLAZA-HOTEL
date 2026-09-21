# Fase 4.3: confirmaciones y filtros compartidos

Este corte cierra otra parte de la adopción de UI compartida sin modificar las operaciones de dominio.

## Cambios

- Migrados a `FilterBar` los consumidores restantes de este corte:
  - Habitaciones.
  - Proveedores.
  - Cuentas por cobrar.
  - Menú.
  - Evidencias.
  - Contratos.
- Se conservaron las clases visuales, estados controlados y handlers existentes.
- Añadido `ConfirmAction` sobre `Dialog` para centralizar confirmaciones de mutaciones.
- Eliminados los seis usos de `window.confirm` de los flujos seleccionados:
  - Cancelación de comandas.
  - Cancelación desde cocina.
  - Limpieza de notificaciones leídas.
  - Archivo/reactivación de huéspedes.
  - Continuación ante conflicto de disponibilidad de eventos.
- Las confirmaciones soportan cancelación con Escape, retorno de foco, bloqueo durante la mutación y `aria-busy`.

## Pruebas

- Se validó la interacción DOM del diálogo compartido.
- Se verificó por contrato que los once consumidores migrados en este corte usan `FilterBar`; junto con Inventory y Audit, la cobertura contractual alcanza trece consumidores.
- Se verificó que no quedan usos de `window.confirm` en `Fronted/src`.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run --exclude e2e src/components/ui/formInfrastructure.test.js src/components/ui/uiAdvancedInteractions.test.jsx --maxWorkers=1` | PASS, 27 tests |
| `npm test` | PASS, 60 archivos y 295 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2033 módulos transformados |
| `git diff --check` | PASS |

## Alcance restante

Persisten filtros especializados que no usan la clase `filter-bar` y requieren decisión propia del flujo. El siguiente paso de roadmap, una vez cerrados los criterios restantes de Fase 4, es Fase 5: UX, formularios y estados de interfaz para los journeys críticos.
