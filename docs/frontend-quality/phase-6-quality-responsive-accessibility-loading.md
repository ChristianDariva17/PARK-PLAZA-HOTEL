# Fase 6: responsive, accesibilidad y loading inteligente

Estado: validación automatizada completada; pendiente certificación manual con NVDA, zoom 200% y contraste alto. Este documento pertenece al plan maestro de calidad frontend y no a la extracción de bounded contexts `Guests/Rooms`.

## Primer slice implementado

- `ResourceState` anuncia carga inicial, refresh y reconciliación mediante estados accesibles, y marca la carga inicial con `aria-busy`.
- `ResourceState` muestra un indicador visual de refresh/reconciliación sin reemplazar el último contenido conocido.
- `DataTable` expone la tabla desplazable como una región con nombre y foco de teclado para permitir navegación horizontal en pantallas estrechas.
- El foco visible conserva margen de desplazamiento para evitar quedar oculto por superficies fijas.
- La aplicación respeta `prefers-reduced-motion` para animaciones, transiciones y scroll suave.
- Los overlays reducen padding y reorganizan especificaciones a una columna en anchos de 360 px o menores.
- Se agregó una matriz E2E pública a 320, 480, 640, 768, 1024 y 1280 px que verifica login visible y ausencia de overflow horizontal.

## Segundo slice: refresh no destructivo

- `ResourceState` muestra un banner visual durante `refreshing` y `reconciling` sin desmontar el contenido ya cargado.
- El mismo estado se anuncia con `role="status"` y `aria-live="polite"`, manteniendo la señal disponible para lectores de pantalla.
- La cobertura de interacción verifica simultáneamente el mensaje de actualización y la permanencia de los datos existentes.

## Tercer slice: skeleton inicial de Caja

- `ResourceState` acepta un fallback opcional para representar la estructura de una vista durante su primera carga sin afectar el contrato genérico existente.
- Caja reemplaza el spinner genérico por un skeleton que anticipa encabezado, panel de turno y tabla de movimientos.
- El skeleton conserva `role="status"`, `aria-live="polite"` y un texto accesible; el refresh sigue usando el banner no destructivo cuando ya existen datos.
- El layout del skeleton colapsa a una columna en 768 px y reduce densidad en 480 px para evitar overflow en pantallas estrechas.

## Cuarto slice: skeleton inicial de Folios

- Folios usa un skeleton estructural para saldo, tabs de acciones y formulario inicial.
- La etiqueta accesible comunica `Cargando folio...`; el estado de refresh continúa dependiendo del contenido cargado y no del skeleton.
- En 640 px el saldo y el formulario se apilan, y los campos ocupan una sola columna sin overflow horizontal.

## Quinto slice: skeleton inicial de Pedidos y Limpieza

- Pedidos representa las cuatro estaciones del kanban durante la primera carga, con una señal accesible de `Cargando comandas...`.
- Limpieza representa tarjetas de tareas antes de disponer de datos, y conserva el estado de refresh como banner cuando ya existen tareas.
- Ambos skeletons usan columnas fluidas y conservan overflow controlado para los anchos estrechos del kanban.
- El shell autenticado muestra el control `Abrir navegación` cuando el sidebar pasa a modo móvil hasta 1024 px, y conserva el cierre de sesión visible en escritorio.
- El color mutado base usa `#475569` para conservar contraste AA sobre superficies claras, y los mensajes vacíos usan una variante verde legible como texto.
- La navegación autenticada conserva foco en skip link, menú móvil y diálogo de búsqueda, incluyendo retorno de foco al cerrar con Escape.
- Login conserva estructura, ausencia de overflow y controles nombrados bajo `prefers-reduced-motion: reduce` y `forced-colors: active`.
- Las vistas operativas principales mantienen objetivos interactivos de al menos 24 px en ancho móvil.
- Las vistas operativas principales conservan contenido y `#main-content` visible sin overflow a un ancho equivalente a 200% de zoom sobre una ventana de 1280 px.
- El árbol de accesibilidad de Chromium no reporta controles interactivos sin nombre en login ni dashboard; el CTA reducido `Nueva reserva` conserva `aria-label` cuando su texto visual se oculta.

## Sexto slice: auditoría automatizada

- Axe 4.13 no reporta violaciones en login ni dashboard autenticado.
- Axe deja `color-contrast` como resultado `incomplete` en dashboard para gradientes, pseudo-elementos y caracteres decorativos cuyo fondo no puede determinar automáticamente; no son violaciones confirmadas.
- `.sidebar-stars` expone el nombre accesible mediante `role="img"` y `aria-label`, manteniendo las estrellas visuales ocultas al lector de pantalla.
- Lighthouse 12.8.2 obtiene puntuación de accesibilidad 100/100 en login y dashboard autenticado, sin auditorías fallidas.
- NVDA 2026.1.1 quedó instalado en Windows; la revisión con lector de pantalla todavía requiere una sesión manual interactiva.

## Validación

| Comando | Resultado |
| --- | --- |
| `npx vitest run src/components/views/orders/OrdersLoading.test.js src/cleaning/CleaningLoading.test.js src/folios/FolioPanel.test.jsx src/cash/CashPhase2.test.js src/components/ui/uiAdvancedInteractions.test.jsx --maxWorkers=1` | PASS, 5 archivos y 31 tests |
| `npm test` | PASS, 72 archivos y 331 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS, 2034 módulos transformados |
| `npm run test:e2e:auth` | PASS, 21 pruebas autenticadas contra Docker |
| `npm run test:e2e` | PASS, 31 pruebas públicas y autenticadas incluyendo la matriz de seis anchos |
| Axe 4.13, login y dashboard autenticado | PASS, 0 violaciones; dashboard con `color-contrast` incompleto por gradientes/pseudo-elementos |
| Lighthouse 12.8.2, login y dashboard autenticado | PASS, accesibilidad 100/100 y 0 auditorías fallidas |

## Pendiente

- Completar la validación manual con zoom 200%, contraste alto y lector de pantalla NVDA.
- Axe y Lighthouse ya fueron ejecutados localmente; no se agregaron como dependencias persistentes del producto.
- NVDA 2026.1.1 está instalado; la validación con lector de pantalla requiere una sesión manual interactiva.
- La matriz pública y la matriz del shell autenticado cubren 320, 480, 640, 768, 1024 y 1280 px cuando el stack Docker está disponible.
- Se creó una cuenta QA mediante `Backend` bootstrap y se configuró `Fronted/.env.e2e.local` (ignorado por Git); Playwright lo carga automáticamente cuando existe. Si el puerto 3000 pertenece a otra instancia, ejecutar con `E2E_API_PORT=3001` para aislar el backend local.
- La cuenta QA también fue provisionada en PostgreSQL Docker mediante `docker compose run --rm setup` con overrides temporales; el password local evita `#` y `$` porque `.env` los interpreta durante el parseo.
- `auth.setup.js` normaliza `Secure` a `false` sólo para cookies HTTP locales antes de guardar `playwright/.auth/admin.json`; producción mantiene cookies `Secure`.
- `playwright.config.js` prioriza las credenciales de `.env.e2e.local` cuando existe, evitando que variables `E2E_*` heredadas del proceso oculten el fixture local.
- La auditoría automatizada cubre labels, el orden de foco del login y el salto de navegación al contenido principal autenticado.
