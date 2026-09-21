# Fase 14: entrypoints Core y Extended por feature

La fase retira los agregados `CoreViews.jsx` y `ExtendedViews.jsx`. Los consumidores reales pasan a cargar entrypoints lazy propios, sin duplicar módulos que ya existían.

## Resultado

| Ruta | Entrypoint |
| --- | --- |
| `dashboard` | `Fronted/src/dashboard/DashboardView.jsx` |
| `reports` | `Fronted/src/reports/ReportsView.jsx` |
| `roles` | `Fronted/src/components/views/roles/RolesManagementView.jsx` |
| `settings` | `Fronted/src/settings/SettingsView.jsx` |

## Decisiones

- `Dashboard`, `Reports` y `Settings` se extrajeron de los agregados a módulos feature independientes.
- `Roles` conserva `RolesManagementView.jsx` como propietario existente; no se creó un duplicado.
- Las demás vistas de `CoreViews` y `ExtendedViews` ya tenían entrypoints especializados o no tenían consumidores productivos.
- `adminViewComponents.jsx` ahora registra directamente los cuatro entrypoints y los agregados fueron eliminados.
- `phase3CoreExtendedSplit.test.js` verifica que los archivos agregados no existan y que el registro no vuelva a importarlos.
- `formInfrastructure.test.js` verifica los controles reales de `InventoryView.jsx`, que es el propietario actual del filtro de inventario.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm test -- --run src/app/phase3CoreExtendedSplit.test.js src/components/ui/formInfrastructure.test.js` | PASS, 2 archivos y 9 tests |
| `npm test` | PASS, 58 archivos y 268 tests |
| `npm run lint` | PASS, sin diagnósticos |
| `npm run build` | PASS, 2033 módulos transformados |
| `npm run test:e2e` | PASS, 2 pruebas públicas |
| `git diff --check` | PASS, sólo avisos existentes de LF/CRLF |

## Siguiente paso

La extracción Core/Extended queda validada. El siguiente paso es revisar el diff completo y decidir si se prepara un commit, sin incluir cambios ajenos del worktree.
