# Fase 7: rendimiento y bundle

Estado: slices 7.1, 7.2 y 7.3 implementados. Se agregó protección contra regresiones de bundle, se difirió la carga de funcionalidades opcionales de Asistencia, se separó el shell autenticado del arranque público, se aisló el estado derivado del dashboard, se separaron los estilos críticos comunes de los estilos específicos de módulos y se compactaron las respuestas operativas del dashboard.

## Baseline y primer resultado

La medición se realizó con `npm run build` usando Vite 8.2.1.

| Artefacto | Antes del slice | Después del slice | Cambio |
| --- | ---: | ---: | ---: |
| JS inicial `index-*.js` | 529.94 kB | 260.61 kB | -269.33 kB |
| Shell autenticado `AuthenticatedHotelShell-*.js` | 240.39 kB | 226.22 kB | -14.17 kB |
| CSS inicial `index-*.css` | 364.14 kB | 70.73 kB | -293.41 kB |
| CSS inicial tras separar componentes comunes | 70.73 kB | 50.43 kB | -20.30 kB |
| CSS inicial tras diferir tablas y overlays | 50.43 kB | 32.77 kB | -17.66 kB |
| Entry point `StaffAttendanceView` | 429.92 kB | 11.67 kB | -418.25 kB |
| Mayor chunk opcional | 429.92 kB | 384.62 kB | -45.30 kB |
| CSS de módulos diferido | incluido en el entry | 297.85 kB | deja de bloquear el primer render |
| CSS de componentes diferido | incluido en el entry | 31.91 kB | deja de bloquear las rutas públicas y dashboard |
| CSS operativo diferido | incluido en el entry | 17.65 kB | tablas y overlays se cargan al usar rutas o búsqueda |

## Cambio implementado

- `StaffAttendanceView` mantiene en el chunk de ruta sólo la vista y sus dependencias inmediatas.
- `BiometricAttendanceAdapter` se carga cuando se selecciona personal.
- `AttendanceKioskModal` se carga al abrir el kiosco QR.
- `StaffQrScannerModal`, junto con `html5-qrcode` y confetti, se carga al abrir el lector QR.
- Cada import dinámico tiene un fallback accesible mediante `role="status"`.
- `HotelProvider` y `HotelShell` se cargan mediante `AuthenticatedHotelShell` sólo después de resolver la sesión autenticada.
- El documento de fuentes externas deja de bloquear el primer render y conserva fallback para navegadores sin JavaScript.
- `DashboardView` consume `HotelDashboardStateContext`, que sólo cambia cuando cambian datos usados por el dashboard; los estados de carga de otros módulos ya no fuerzan su render.
- `critical.css` conserva los estilos de login, estados de carga, badges y la franja operativa necesarios para el primer render.
- `components-critical.css` conserva la jerarquía de páginas, superficies, KPIs, dashboard, botones y responsive mínimo necesarios para el primer render autenticado.
- `components.css` y `modules.css` se cargan mediante imports dinámicos sólo al navegar a una ruta operativa distinta de `dashboard`; sus estilos siguen disponibles para las vistas de módulos sin entrar en el recorrido inicial.
- `tables-forms.css` y `overlays.css` también se cargan dinámicamente para rutas operativas; la búsqueda global carga el overlay justo antes de abrirse.
- `GlobalSearch` se carga como chunk dinámico sólo al abrir la búsqueda; `Topbar` ya no se suscribe al estado de búsqueda mientras el overlay está cerrado.
- El arranque autenticado solicita sólo `orders` e `inventory` para el dashboard; `menu` se carga al montar `OrdersView` e `inventoryLedger` al montar `InventoryView`.
- Los recursos de `parking` y `pets` se resetean al autenticar, pero se cargan sólo al montar sus rutas operativas; el dashboard no los consume.
- `useRestaurantResources` sólo emite cancelación cuando existe un request activo y libera el controlador al resolverlo; el bootstrap ya no genera cancelaciones ficticias para recursos idle.
- Los listados de incidencias y mantenimiento ya no transportan los cuerpos base64 de `evidence`; conservan `evidenceCount` para las vistas y mantienen las respuestas completas de las mutaciones.
- Se eliminaron las container queries sin consumidor efectivo del CSS crítico; el dashboard no depende de `.kpi-card` dentro de un `.card`.

La optimización no cambia permisos ni contratos de negocio. Los listados operativos conservan el conteo de evidencias y las mutaciones siguen devolviendo el contenido completo; el objetivo es evitar descargar imágenes base64 durante el dashboard.

## Guard de bundle

`npm run bundle:check` inspecciona `dist/assets` después del build y aplica estos techos temporales de regresión:

| Métrica | Budget |
| --- | ---: |
| JS inicial | 540 KiB |
| CSS inicial | 100 KiB |
| Mayor JS asíncrono | 440 KiB |

Estos valores son límites de no-regresión, no objetivos finales de rendimiento. Deben recalibrarse con datos de staging y Web Vitals reales.

El workflow `.github/workflows/verification.yml` ejecuta el guard después del build del frontend administrativo.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/app/performanceInfrastructure.test.js --maxWorkers=1` | PASS, 1 archivo y 5 tests |
| `npm test` | PASS, 74 archivos y 338 tests; worker único para evitar timeouts por promesas pendientes en tests de interacción |
| `npm run build` | PASS, 2041 módulos transformados |
| `npm run bundle:check` | PASS, JS inicial 254.57 KiB, CSS inicial 31.77 KiB y mayor JS asíncrono 375.64 KiB |
| `npm run lint` | PASS |
| `npm run test:e2e` | PASS, 35 pruebas públicas y autenticadas |

## Lighthouse Performance

La medición se ejecutó contra Docker con la configuración móvil/throttling predeterminada de Lighthouse 12.8.2. Estos valores son baseline local, no SLA de producción.

| Flujo | Score | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Login público | 92/100 | 2.5 s | 2.9 s | 0 ms | 0.026 |
| Dashboard autenticado | 67/100 | 3.4 s | 10.4 s | 130 ms | 0 |
| Dashboard autenticado tras diferir menú y ledger | 68/100 | 3.35 s | 9.16 s | 74 ms | 0 |
| Dashboard autenticado tras diferir CSS operativo | 69/100 | 3.19 s | 9.14 s | 56 ms | 0 |
| Dashboard autenticado, build final tras experimento descartado | 68/100 | 3.22 s | 8.82 s | 97 ms | 0 |
| Dashboard autenticado tras diferir parking y pets | 68/100 | 3.20 s | 9.06 s | 128 ms | 0 |
| Dashboard autenticado tras separar GlobalSearch | 67/100 | 3.39 s | 9.15 s | 110 ms | 0 |
| Dashboard autenticado tras compactar evidencias | 66/100 | 3.29 s | 7.29 s | 226 ms | 0 |

El split redujo el JS público inicial y mejoró el flujo de login. El contexto derivado del dashboard redujo el TBT autenticado desde `1,080–1,100 ms` hasta `130 ms` en la corrida anterior. El CSS inicial bajó de `70.73 kB` a `50.43 kB` al separar componentes y ahora a `32.77 kB` al diferir tablas y overlays; Lighthouse redujo las reglas CSS no usadas de aproximadamente `28.9 kB` a `11.3 kB` y `Style & Layout` representativo de `1.42 s` a `1.12 s`. La corrida posterior a diferir menú y ledger mantiene `26` requests y aproximadamente `1.22 MB` de transferencia. Lighthouse sigue identificando como LCP el texto descriptivo del encabezado del dashboard; el siguiente foco es el coste del shell autenticado y del provider, no otra extracción ciega de CSS.

Se probó `content-visibility: auto` sobre tarjetas y secciones del dashboard fuera del viewport. El resultado no fue estable: el score quedó entre `65–68` y el TBT llegó a `214–218 ms` en dos de tres corridas, sin una mejora consistente del LCP. El experimento fue revertido.

Diferir `parking` y `pets` elimina dos requests del dashboard y conserva la carga al abrir `Cochera` o `Mascotas`. La medición Lighthouse local no muestra una mejora estable adicional del score o TBT, por lo que el próximo cambio debe atacar el trabajo compartido de `HotelProvider` y `AuthenticatedHotelShell`.

Separar `GlobalSearch` sí reduce el shell autenticado en `14.17 kB` raw (`4.49 KiB` gzip) y evita descargar el chunk hasta la interacción, pero no modifica de forma medible el LCP del dashboard. Es una mejora de bundle conservada por su beneficio directo; el trabajo de bootstrap sigue siendo el siguiente objetivo.

El guard de cancelación del controlador reduce dispatches y copias de estado innecesarias durante el ciclo de vida de recursos de restaurante. Las tres corridas posteriores quedaron entre `67–68` de score, por lo que no se presenta como una mejora directa de Lighthouse.

Compactar las respuestas de incidencias y mantenimiento redujo la transferencia observada del dashboard de `366,705` a `1,510` bytes para esos dos endpoints, conservando sus conteos de evidencia. En tres corridas Lighthouse el LCP quedó entre `7.28–7.55 s`, frente a aproximadamente `9.09 s` en la medición anterior; el TBT varió entre `194–242 ms` y no se presenta como mejora estable.

## Siguiente slice

- Perfilar por separado `HotelProvider`, `HotelShell` y `DashboardView` para identificar el trabajo de estilo/layout y las tareas largas del bootstrap.
- Repetir Lighthouse con tres corridas después de cada cambio de bootstrap para separar mejoras reales de variabilidad del entorno.
- Perfilar la evaluación de `AuthenticatedHotelShell` y `HotelProvider`, que todavía cargan comandos de módulos no visibles en el dashboard.
- Evaluar si los recursos globales no visibles en el dashboard pueden diferirse sin romper comandos, permisos ni realtime.
- Revisar el coste de `Style & Layout` del dashboard y la composición del shell inicial.
- Comparar la carga de fuentes externas y dependencias eager del shell contra una corrida sin red externa.
- Medir LCP, INP y CLS en Docker/staging con una corrida reproducible.
- Revisar el chunk inicial compartido del shell antes de decidir nuevas divisiones.
- Recalibrar budgets sólo después de comparar mediciones reales, no por intuición.
