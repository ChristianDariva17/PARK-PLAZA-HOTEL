# Fase 18: E2E autenticado y journeys críticos

Este corte habilita y valida la cobertura E2E autenticada con una cuenta administrativa efímera, y amplía la suite sobre los flujos críticos de operación.

## Cambios

- `authenticated` ahora limita el proyecto a `workers: 1` porque los escenarios comparten una sesión QA generada por `auth.setup.js`.
- `authenticated.spec.js` cubre:
  - Dashboard autenticado.
  - Inventario de habitaciones y catálogo de amenidades.
  - Configuración persistida de la propiedad.
  - Apertura del formulario de nueva reserva sin persistir datos.
  - Apertura del formulario de caja disponible sin persistir movimientos.
  - Cambio a la vista de lista del catálogo de Cocina y Bar.
  - Apertura de la matriz comparativa de Roles y Permisos.
  - Contrato de permisos de la sesión autenticada para los slices operativos.
  - Apertura y cierre de un turno de caja aislado mediante API, con cleanup en `finally`.
  - Creación y cancelación de una orden de restaurante aislada mediante API, con cleanup en `finally`.
- `authenticated-fixtures.js` crea un `APIRequestContext` con el `storageState` administrativo para que las mutaciones no dependan de selectores de UI ni reutilicen datos de negocio existentes.

## Cuenta temporal

- La cuenta QA se creó usando el flujo existente `bootstrap:admin`, con contraseña aleatoria sólo en memoria del proceso.
- Después de las pruebas se revocaron sus sesiones, se deshabilitó la cuenta y se eliminó su hash de contraseña.
- No se eliminó físicamente porque `audit_events` es append-only y conserva referencias para trazabilidad.
- El archivo local `Fronted/playwright/.auth/admin.json` se eliminó después de la ejecución.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run test:e2e:auth` | No ejecutado en este entorno: faltan `E2E_EMAIL` y `E2E_PASSWORD` |
| `npm run test:e2e` | PASS, 2 tests públicos |
| `npm run lint` | PASS |
| Consulta de limpieza | No aplica: las mutaciones autenticadas no se ejecutaron sin credenciales |

## Siguiente paso

Completar la ejecución autenticada con credenciales QA y agregar el fixture de reservas cuando el contrato administrativo de lifecycle quede alineado entre backend y frontend. Mantener cleanup controlado y sin usar datos productivos.
