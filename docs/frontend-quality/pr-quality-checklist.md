# Checklist de calidad para PRs del frontend

Aplicar esta checklist a cualquier PR que modifique `Fronted/`.

## Alcance

- [ ] El PR tiene un único objetivo funcional o técnico claramente descrito.
- [ ] Los archivos modificados pertenecen al slice declarado.
- [ ] No se incluyeron cambios ajenos del worktree.
- [ ] Se documentaron dependencias con backend, bridge, configuración o variables de entorno.
- [ ] Se indicó una estrategia de rollback si el cambio afecta un flujo operativo.

## Estado y arquitectura

- [ ] La fuente de verdad del dato está identificada.
- [ ] El estado remoto no se mezcló innecesariamente con estado de UI o formulario.
- [ ] No se agregó lógica de dominio a un componente puramente visual.
- [ ] No se amplió `HotelContext` sin justificar por qué el estado cruza dominios.
- [ ] Las operaciones cancelables protegen contra respuestas obsoletas.
- [ ] Las mutaciones conservan idempotencia, request ID o reconciliación cuando corresponde.

## API y errores

- [ ] Las llamadas usan el transporte y contrato de errores existentes.
- [ ] Los errores distinguen autorización, validación, conflicto, red y servidor.
- [ ] Los mensajes no exponen payloads internos ni datos sensibles.
- [ ] Los errores de campo se conectan con `aria-invalid` y `aria-describedby`.
- [ ] Un retry no duplica una mutación ni oculta un conflicto.
- [ ] Se actualizaron tests para status codes o códigos de error nuevos.

## UI y accesibilidad

- [ ] La vista tiene loading, empty, success, error y forbidden cuando aplican.
- [ ] Los botones async evitan doble submit y comunican progreso.
- [ ] Los dialogs y drawers tienen foco inicial, foco de retorno y Escape.
- [ ] Los icon buttons tienen nombre accesible.
- [ ] Los formularios tienen labels y mensajes asociados.
- [ ] La navegación por teclado funciona sin depender del mouse.
- [ ] Se verificaron anchos de 320 px, 768 px y desktop.
- [ ] No se agregó `overflow: hidden` global sin una razón documentada.

## Tests y validación

- [ ] `npm run test` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npm run build` pasa.
- [ ] Se ejecutó `npm run test:e2e` si el cambio afecta shell, login o routing.
- [ ] Se ejecutó el proyecto autenticado si hay credenciales QA disponibles.
- [ ] Los tests cubren la regresión principal, no sólo la implementación interna.
- [ ] Se agregaron tests de permiso, cancelación, conflicto o retry cuando el cambio los afecta.
- [ ] Se ejecutó revisión Axe o equivalente cuando cambia una superficie interactiva.

## Seguridad y datos

- [ ] No hay secretos, credenciales, tokens ni archivos de sesión en el diff.
- [ ] No se escriben PII o payloads completos en logs.
- [ ] Las variables `VITE_` usadas son públicas por diseño.
- [ ] Las acciones destructivas mantienen autorización y confirmación.
- [ ] Los cambios del bridge o biometría no transportan datos sensibles fuera del contrato.

## Rendimiento

- [ ] Se revisó si un import debe ser lazy.
- [ ] No se aumentó el chunk inicial sin justificación.
- [ ] No se agregó una dependencia pesada para un problema local sin medir el coste.
- [ ] Las listas grandes mantienen paginación o estrategia de render adecuada.
- [ ] Se registró el impacto de bundle cuando corresponde.

## Reporte del PR

- [ ] Se incluyeron comandos ejecutados y resultados.
- [ ] Se describieron limitaciones del entorno, especialmente E2E autenticado.
- [ ] Se incluyeron capturas responsive cuando el cambio es visual.
- [ ] Se indicaron riesgos conocidos y próximos pasos, si los hay.
