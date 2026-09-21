# Fase 11: primer corte de descomposición del shell administrativo

Fecha de implementación: 2026-09-15  
Fase del plan maestro: 3.1, descomposición de arquitectura y vistas  
Estado: completada

Esta numeración continúa los cortes verticales documentados después de la Fase 2 maestra de migración del provider.

## Objetivo

Separar la entrada de autenticación, el shell administrativo, la navegación/autorización hash, el registro de vistas lazy y el contenido de rutas sin cambiar las rutas válidas ni la semántica de navegación.

## Cambios

- `Fronted/src/App.jsx` conserva sólo la selección de estado de autenticación y renderiza `HotelShell` para sesiones admitidas.
- `Fronted/src/components/layout/HotelShell.jsx` contiene el layout autenticado, sidebar, topbar, toasts y listeners realtime.
- `Fronted/src/hooks/useAdminNavigation.js` concentra autorización de rutas, fallback, navegación hash e intents de navegación.
- `Fronted/src/app/adminViewComponents.jsx` contiene el registro `VIEW_COMPONENTS` y todos los imports lazy existentes.
- `Fronted/src/components/routing/AdminRouteContent.jsx` contiene autorización visual, admisión de contratos, `Suspense` y resolución de la vista activa.
- `Fronted/src/components/routing/RouteErrorBoundary.jsx` contiene el boundary de errores de módulos.
- `Fronted/src/components/routing/ContractBlockedView.jsx` contiene el estado de contrato no verificado.

El mapa de rutas se preservó sin cambios funcionales. También se mantuvieron los props `navigate`, `notify`, `navigationIntent` y `consumeNavigationIntent` que reciben las vistas.

## Decisiones de compatibilidad

- `HotelContext.jsx` no fue ampliado; continúa siendo dueño del estado global y los comandos de dominio.
- `useHashRoute` continúa siendo la implementación de navegación hash y conserva su normalización de rutas inválidas.
- La resolución lazy conserva los mismos módulos agregados (`CoreViews`, `ExtendedViews`, `P1Views` y `OperationalViews`); su división por feature queda para el siguiente corte.
- `RouteErrorBoundary` conserva la recuperación actual mediante recarga de aplicación.
- No se agregó una dependencia ni una abstracción global de estado.

## Pruebas

Se agregaron:

- `Fronted/src/app/phase3Composition.test.js`

Se actualizó:

- `Fronted/src/state/HotelContext.lifecycle.test.js`

Las pruebas verifican que `App` sólo sea la entrada de autenticación, que la navegación/autorización viva en el hook, y que el registro lazy y los estados de ruta pertenezcan a la capa correspondiente.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 55 archivos y 262 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2024 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |
| `git diff --check` | PASS |

La build mantiene la carga inicial dentro del mismo orden de magnitud: `472.81 kB` de JavaScript sin comprimir y `358.68 kB` de CSS sin comprimir.

## Próximo corte

Dividir `OperationalViews.jsx` y `P1Views.jsx` por feature, empezando por módulos que todavía se cargan mediante esos agregados, manteniendo exports temporales sólo mientras existan consumidores pendientes.
