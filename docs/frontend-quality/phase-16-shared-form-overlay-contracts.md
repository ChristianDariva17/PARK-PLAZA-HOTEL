# Fase 16: contratos compartidos de formularios y overlays

Este corte consolida responsabilidades en las primitivas UI compartidas y corrige dos puntos de accesibilidad: foco en errores de wizard y cancelación controlada de Escape en overlays.

## Cambios

- `FormField` queda como única fuente de verdad para generar IDs y conectar `aria-describedby`/`aria-invalid`.
- `P1Input`, `P1Select` y `P1Textarea` pasan a ser wrappers delgados sin duplicar la construcción de IDs y atributos ARIA.
- `FormWizard` mueve el foco al mensaje de error cuando falla la validación o llega un error de submit.
- `Overlay` evita el comportamiento nativo de Escape antes de ejecutar `onClose`.
- Se reforzaron los contratos de infraestructura UI para verificar deduplicación, foco y navegación por teclado.

## Alcance deliberado

- No se añadieron dependencias de `jsdom` o Testing Library: el repositorio no tenía entorno DOM para Vitest y se mantuvo su estrategia de contratos source-level.
- No se cambiaron las APIs públicas de los átomos ni el comportamiento de permisos.
- La consolidación de consumidores y pruebas DOM reales queda para un corte posterior con setup explícito.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test -- --run src/components/ui/formInfrastructure.test.js src/components/ui/uiInfrastructure.test.js` | PASS, 2 archivos y 17 tests |
| `npm test` | PASS, 58 archivos y 271 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2033 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |

## Siguiente paso

Configurar cobertura DOM real para `Dialog`, `Drawer`, `Tabs`, `FormField` y `FormWizard`, y migrar consumidores sólo después de validar foco, Escape, errores y navegación por teclado.
