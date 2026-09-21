# Fase 17: pruebas DOM reales para la infraestructura UI

Este corte incorpora un entorno DOM mínimo para validar interacciones reales de las primitivas compartidas, sin depender únicamente de contratos source-level.

## Cambios

- Agregados `@testing-library/react`, `@testing-library/user-event` y `jsdom` como dependencias de desarrollo.
- Creado `Fronted/src/components/ui/uiInteractions.test.jsx` con entorno `jsdom` por archivo.
- `FormField` se verifica con label asociado, helper, error y `aria-invalid`.
- `FormWizard` se verifica con validación por submit y foco en el error.
- `Dialog` y `Drawer` se verifican con foco inicial, cierre por Escape y restauración del foco al trigger.
- `Tabs` se verifica con navegación por flechas y enlace correcto entre tab y panel.

## Seguridad y alcance

- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades de producción.
- `npm audit --audit-level=moderate` reporta 2 vulnerabilidades moderadas en `@vitest/mocker`, dentro de la cadena de Vitest; no se ejecutó `npm audit fix` automáticamente.
- No se modificaron contratos públicos de los componentes ni lógica de negocio.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run --exclude e2e src/components/ui/uiInteractions.test.jsx --maxWorkers=1` | PASS, 1 archivo y 5 tests |
| `npm test` | PASS, 59 archivos y 276 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2033 módulos transformados |
| `git diff --check` | PASS, sólo avisos existentes de LF/CRLF |
| `npm run test:e2e` | BLOQUEADO por `RealtimeGateway.afterInit`: `TypeError: server.adapter is not a function` en el contenedor API |

## Siguiente paso

Corregir el bloqueo backend del gateway realtime y repetir E2E; después ampliar las pruebas DOM a consumidores críticos de `Dialog`, `Drawer` y `FormWizard`.
