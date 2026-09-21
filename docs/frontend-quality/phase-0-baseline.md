# Fase 0: baseline y alcance del frontend administrativo

Fecha de referencia: 2026-09-15  
Alcance: `Fronted/`  
Estado: completada  
Cambios de comportamiento: ninguno

## Propósito

Establecer una referencia reproducible antes de modificar arquitectura, estado, UI o contratos del frontend administrativo. Esta referencia permite distinguir regresiones nuevas de problemas ya existentes.

## Condición del worktree

El worktree ya contenía cambios modificados y archivos no trackeados en backend, frontend, operaciones, configuración y workflows antes de ejecutar esta fase. Esos cambios no fueron revertidos ni editados.

Los únicos archivos agregados por la fase 0 son:

- `docs/frontend-quality/phase-0-baseline.md`
- `docs/frontend-quality/pr-quality-checklist.md`

El archivo `Fronted/bridge/bridge.config.json` está excluido por `Fronted/.gitignore`. No se leyó ni se copió ningún valor secreto.

## Entorno

El proyecto declara Node.js `^20.19.0` o `>=22.12.0` para Vite 8.

| Herramienta | Versión observada |
| --- | --- |
| Node.js | `v22.16.0` |
| npm | `11.6.2` |
| Vite | `8.2.1` durante build |
| React | `19.2.8` declarado en `package.json` |
| Vitest | `4.1.10` durante tests |
| Oxlint | `1.75.0` declarado en `package.json` |
| Playwright | `1.63.0` declarado en `package.json` |

## Validaciones reproducidas

Los comandos se ejecutaron desde `Fronted/`.

| Comando | Resultado | Evidencia |
| --- | --- | --- |
| `npm run test` | PASS | 39 archivos de test, 200 tests, 12.33 s |
| `npm run lint` | PASS | Oxlint terminó sin diagnósticos |
| `npm run build` | PASS | 2004 módulos transformados, 9.10 s |
| `npm run test:e2e` | PASS | 2 pruebas públicas de login, 11.1 s |
| `npm run test:e2e:auth -- --list` | NO DISPONIBLE | No había credenciales E2E; Playwright sólo registró el proyecto `chromium` |

La suite autenticada no se ejecutó porque `E2E_EMAIL` y `E2E_PASSWORD` no estaban configuradas. Esto es una condición del entorno, no un fallo funcional del login público. El archivo `Fronted/playwright.config.js` sólo agrega los proyectos `auth-setup` y `authenticated` cuando ambas variables existen.

No existe todavía un script `format`, `format:check` o una configuración `biome.json`. La accesibilidad automatizada, la validación responsive y los budgets de bundle tampoco forman parte del gate actual.

## Baseline de bundle

Los tamaños siguientes son los reportados por `vite build`; la columna gzip es la referencia comprimida generada por Vite.

| Artefacto | Tamaño | Gzip |
| --- | ---: | ---: |
| CSS inicial `index-*.css` | 358.68 kB | 57.01 kB |
| JS inicial `index-*.js` | 463.65 kB | 132.97 kB |
| `StaffAttendanceView` | 422.31 kB | 127.79 kB |
| `OperationalViews` | 144.33 kB | 35.54 kB |
| `P1Views` | 142.84 kB | 32.98 kB |
| `CoreViews` | 77.02 kB | 18.49 kB |
| `EventsModuleRoot` | 75.78 kB | 18.19 kB |
| `ExtendedViews` | 70.00 kB | 16.78 kB |

Estos valores son observaciones, no budgets aprobados todavía. Cualquier budget futuro debe definirse después de medir staging y separar el coste inicial del coste de cada ruta.

## Inventario de rutas

`VALID_ROUTES` contiene 29 rutas derivadas de `NAV_SECTIONS` en `Fronted/src/components/layout/navigation.js`.

| Sección | Rutas | Cantidad |
| --- | --- | ---: |
| Recepción | `dashboard`, `habitaciones`, `reservas`, `contratos`, `checkin-checkout`, `finanzas`, `clientes` | 7 |
| Operación | `limpieza`, `mantenimiento`, `incidencias`, `evidencias`, `notificaciones`, `pedidos-qr`, `inventario`, `cocina-bar`, `proveedores` | 9 |
| Servicios | `cochera`, `mascotas`, `recreacion`, `eventos`, `calendario-eventos` | 5 |
| Administración | `personal`, `personal-directorio`, `caja`, `reportes`, `cuentas-acceso`, `roles`, `auditoria`, `configuracion` | 8 |
| Total |  | 29 |

`Fronted/src/App.jsx` mantiene el mapa `VIEW_COMPONENTS`, la autorización de rutas, el router hash, el shell, los toasts, el bridge realtime y el boundary de errores. Las vistas principales se cargan con `lazy`, aunque varios grupos siguen concentrados en `CoreViews`, `P1Views`, `OperationalViews` y `ExtendedViews`.

## Matriz de módulos y responsabilidades

| Área | Ubicación principal | Responsabilidad actual | Riesgo o acoplamiento | Cobertura conocida |
| --- | --- | --- | --- | --- |
| Shell y rutas | `Fronted/src/App.jsx` | Bootstrap visual, estados de sesión, rutas, permisos, toasts y eventos WebSocket | Alta concentración; usa `window.location.reload()` para errores de módulo y logging directo en eventos realtime | No hay test directo de `HotelShell` |
| Navegación | `Fronted/src/components/layout/navigation.js` | Secciones, labels, iconos y conjunto de 29 rutas | La navegación y autorización dependen del mismo catálogo | `contracts/admission.test.js` cubre admisión, no todos los journeys de navegación |
| Autenticación | `Fronted/src/auth/AuthContext.jsx` | Bootstrap de sesión, login, Google, logout, cambio de contraseña y respuesta a 401 | Mantiene estado local y coordina socket, cache de sesión y autorización | Tests de `authClient`; E2E público de login |
| Transporte y errores | `Fronted/src/auth/authClient.js` | `authRequest`, cookies, retry GET, errores, request IDs, idempotencia y telemetría | Es el transporte principal pero su contrato se llama `AuthRequestError` aunque lo usan recursos generales | `authClient.request.test.js` y `authClient.resource.test.js` |
| Estado de hotel | `Fronted/src/state/HotelContext.jsx` | Cargas, comandos, aborts, generaciones, permisos y proyección de todos los dominios | Provider muy grande con múltiples refs, efectos y clientes de dominio | `HotelContext.lifecycle.test.js` |
| Invariantes | `Fronted/src/state/hotelReducer.js` | Validación de acciones y transiciones de huéspedes, habitaciones, reservas, estadías, caja, operaciones y biometría | Cambiar acciones puede afectar muchos dominios | `hotelReducer.test.js` |
| Eventos | `Fronted/src/events/useEventsResource.js` | Espacios, eventos, filtros, paginación, refresh y realtime | Contrato local de `loading/error` distinto al de recursos globales | `useEventsResource.lifecycle.test.js` |
| Restaurante | `Fronted/src/restaurant/useRestaurantResource.js` | Adaptador de estado global, permisos y refresh de pedidos por WebSocket | Mezcla selector, contrato de estado y suscripción realtime | `restaurantModel.test.js`; sin test directo del hook |
| Tablas | `Fronted/src/hooks/useCollectionTable.js` | Ordenamiento y paginación local | Actualiza estado durante render cuando cambia `resetKey` | Sin test directo encontrado |
| WebSocket | `Fronted/src/hooks/useWebSocket.js` | Conexión, estado de conexión y suscripciones | El hook depende de callbacks y del singleton realtime | `socketClient.test.js`; sin test directo del hook |
| UI compartida | `Fronted/src/components/ui/` | `FormField`, overlays, tablas, filtros, wizard, feedback y átomos P1 | APIs compartidas todavía no constituyen un contrato único para todos los módulos | `uiInfrastructure.test.js`, `formInfrastructure.test.js` |
| Clientes de dominio | `Fronted/src/{guests,rooms,reservations,stays,cleaning,incidents,maintenance,cash,restaurant,parking,pets,documents,...}` | DTOs, adaptadores y llamadas por dominio | Los errores y estados no son completamente uniformes | La mayoría cuenta con tests de cliente o modelo |
| E2E | `Fronted/e2e/` y `Fronted/playwright.config.js` | Login público y journeys autenticados condicionales | Los tests autenticados requieren cuenta QA y variables externas | 2 pruebas públicas PASS; 3 autenticadas declaradas pero no ejecutadas |
| Estilos | `Fronted/src/index.css`, `Fronted/src/styles/` | Reset, tokens, layout, módulos y componentes | CSS inicial de 358.68 kB y reglas globales requieren budget y revisión responsive | Sin gate automatizado de estilos/a11y |

## Clasificación del estado

| Tipo de estado | Implementación actual | Ejemplos | Decisión de fase 0 |
| --- | --- | --- | --- |
| Autenticación y sesión | Estado local en `AuthContext` más sesión HTTP | `auth.status`, `account`, `permissions`, `loggingOut` | Mantener como boundary de autenticación; no mezclarlo con estado de hotel |
| Estado remoto y proyección | `HotelContext` + `hotelReducer` + clientes de dominio | huéspedes, habitaciones, reservas, estadías, caja, operaciones y restaurante | Tratar API/backend como fuente de verdad y migrar por slices, no reemplazar el reducer de golpe |
| Estado de UI y navegación | Estado local de componentes y hash route | sidebar, toasts, tabs, filtros, selección, paginación y `navigationIntent` | Mantener local; promover a URL sólo lo que deba sobrevivir navegación |
| Formularios y acciones | Estado local distribuido en vistas/modales | `busy`, valores de inputs, errores, confirmaciones y dialogs | Crear contratos comunes durante la fase de formularios, no durante el baseline |
| Realtime | Singleton socket más `useWebSocket`/`useWebSocketEvents` | notificaciones, pedidos y cambios de habitaciones | Mantener suscripciones declarativas; medir refresh y errores antes de abstraer |
| Persistencia del prototipo | README declara estado operativo de demostración en memoria | recarga de página reinicia parte del estado operativo | No prometer persistencia desde el frontend; cualquier cambio debe explicitar dependencia backend |

## Contrato mínimo de calidad para cada PR

Un PR que modifique `Fronted/` debe cumplir lo siguiente:

- Ejecutar `npm run test` y reportar el resultado.
- Ejecutar `npm run lint` y no introducir diagnósticos nuevos.
- Ejecutar `npm run build` cuando cambie código de producción, imports o estilos.
- Ejecutar el E2E público cuando cambie login, routing, shell o configuración de ejecución.
- Ejecutar el E2E autenticado cuando estén disponibles `E2E_EMAIL`, `E2E_PASSWORD` y backend QA.
- Agregar o actualizar tests cuando cambie una transición, cliente, permiso, error o journey.
- Revisar teclado, foco, nombres accesibles y responsive cuando cambie UI.
- No incluir secretos, credenciales QA, PII ni artefactos locales.
- No mezclar cambios backend, frontend y operaciones salvo que exista una dependencia explícita.
- Reportar impacto de bundle cuando se agreguen dependencias, imports globales o módulos pesados.
- No usar `window.location.reload()` como recuperación de un flujo nuevo.
- Conservar la capacidad de rollback por módulo o slice vertical.

## Hallazgos priorizados

### P0

- Existe un reload global en `RouteErrorBoundary` de `Fronted/src/App.jsx:73`.
- La capa de transporte es reutilizable pero su error principal está acoplado nominalmente a auth.
- La suite autenticada no puede ejecutarse sin un entorno QA explícito.
- No existe un gate de formato ni una configuración Biome.

### P1

- `HotelContext.jsx` centraliza demasiados dominios, generaciones, abort controllers, cargas y comandos.
- `useEventsResource.js` y `useRestaurantResource.js` exponen contratos diferentes de loading/error/status.
- `useCollectionTable.js:8` actualiza estado durante el render al detectar un nuevo `resetKey`.
- `App.jsx` concentra routing, realtime, toasts, permisos y recuperación de errores.
- `OperationalViews`, `P1Views` y `StaffAttendanceView` generan chunks grandes.

### P2

- No hay budgets de bundle ni métricas LCP/INP/CLS integradas.
- No hay Axe integrado ni matriz automatizada de responsive.
- Los hooks de shell, WebSocket y tabla carecen de cobertura directa suficiente.
- El CSS inicial es grande para una aplicación con rutas lazy.

## Gate de salida de la fase 0

- Baseline ejecutado y registrado.
- Rutas y grupos de vistas inventariados.
- Responsabilidades y dependencias principales identificadas.
- Estado clasificado por ownership y fuente de verdad.
- Checklist de PR creada.
- Cambios ajenos preservados.
- Sin cambios de comportamiento en código de aplicación.

## Siguiente fase habilitada

La fase 1 puede comenzar con contratos de API, errores y recursos. El primer slice recomendado sigue siendo Events o Restaurant, porque sus contratos de estado ya muestran divergencias medibles y permiten validar la nueva convención sin migrar todo `HotelContext`.
