# Hotel Park Plaza — Guía UI/UX de Mockups

> **Propósito:** documentar el diseño visual, la experiencia de usuario, los componentes y la organización de los mockups desarrollados para Hotel Park Plaza.
>
> Este archivo debe utilizarse como referencia durante la implementación del frontend para mantener todos los módulos visualmente consistentes.

---

# 1. Objetivo UI/UX

La interfaz debe transmitir:

- Profesionalismo.
- Confianza.
- Orden.
- Rapidez operativa.
- Claridad visual.
- Sensación premium propia de un hotel.
- Consistencia entre todos los módulos.

La prioridad visual será:

```text
RESUMEN
   ↓
DETALLE
   ↓
ACCIONES
```

El usuario primero debe comprender el estado general, después consultar el detalle y finalmente ejecutar acciones.

---

# 2. Principios generales

## 2.1 Dashboard visual, no saturado

Mostrar entre **6 y 8 KPI principales** por pantalla.

Ejemplos:

- Habitaciones disponibles.
- Habitaciones ocupadas.
- Reservas.
- Ingresos.
- Pagos pendientes.
- Pedidos activos.
- Incidencias.
- Alertas.

Evitar:

- Demasiados números pequeños.
- Información duplicada.
- Tablas excesivamente densas.
- Gráficos que no aportan valor.

## 2.2 Navegación por bloques

```text
Dashboard

Recepción
 ├── Mapa de habitaciones
 ├── Clientes
 ├── Reservas
 ├── Contratos
 ├── Check-in
 ├── Check-out
 ├── Cuenta acumulada
 ├── Pagos / Comprobantes
 └── Caja

Operaciones
 ├── Limpieza
 ├── Evidencias
 ├── Mantenimiento
 └── Incidencias

Servicios
 ├── Pedidos QR
 ├── Piscina y Mirador
 ├── Cochera
 └── Mascotas

Cocina / Bar
 ├── Dashboard Cocina y Bar
 ├── Inventario de alimentos
 ├── Recetas
 ├── Bebidas
 ├── Bar
 ├── Licores
 ├── Control de onzas
 ├── Cócteles
 ├── Mermas
 ├── Apertura / Cierre
 ├── Conteo físico
 ├── Movimientos
 ├── Proveedores
 └── Reportes

Eventos
 ├── Eventos privados
 └── Calendario de eventos

Personal
 ├── Administración de personal
 ├── Asistencia
 ├── Turnos
 └── Roles y permisos

Reportes

Administración
 ├── Notificaciones
 ├── Seguimiento post-estadía
 ├── Auditoría
 ├── Seguridad
 └── Copias de seguridad
```

---

# 3. Identidad visual

## Fondo

```css
#F8FAFC
```

## Sidebar / Navy

```css
#081C34
#0B2447
#0F172A
```

## Azul principal

```css
#2563EB
```

Uso:

- CTA.
- Elemento seleccionado.
- Enlaces.
- Gráficos principales.

## Verde

```css
#16A34A
```

Uso:

- Disponible.
- Pagado.
- Confirmado.
- Completado.
- Acceso permitido.

## Amarillo

```css
#F59E0B
```

Uso:

- Pendiente.
- Advertencia.
- Stock bajo.
- Próximo a vencer.

## Rojo

```css
#DC2626
```

Uso:

- Error.
- Rechazo.
- Cancelado.
- Urgente.
- Diferencias críticas.

## Morado

```css
#7C3AED
```

Uso:

- Procesos especiales.
- Eventos.
- Bar.
- Licores.

## Dorado premium

```css
#C59D5F
```

Uso limitado:

- Logo.
- Detalles premium.
- Identidad del hotel.

---

# 4. Tipografía

Recomendadas:

```text
Inter
Manrope
Plus Jakarta Sans
```

Jerarquía:

```text
Título de pantalla: 28–32 px / 700
Subtítulo:         16–18 px
Título tarjeta:    14–16 px / 600
Texto normal:      14–16 px
Tabla:             13–14 px
Metadata:          11–13 px
```

---

# 5. Layout general

```text
┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │ HEADER                                            │
│         ├───────────────────────────────────────────────────│
│         │ Título + descripción                              │
│         │                                                   │
│         │ KPI KPI KPI KPI KPI KPI                           │
│         │                                                   │
│         │ Buscar | Filtros                 Acción principal │
│         │                                                   │
│         │ Contenido principal            Drawer / Detalle  │
└─────────────────────────────────────────────────────────────┘
```

---

# 6. Sidebar

Características:

- Fijo.
- Azul marino.
- Logo dorado.
- Módulos agrupados.
- Iconos simples.
- Submenús desplegables.
- Módulo activo resaltado en azul.

Ejemplo:

```css
.sidebar-item-active {
  background: #2563EB;
  color: #FFFFFF;
  border-radius: 8px;
}
```

---

# 7. Header

Debe mostrar:

- Título.
- Descripción.
- Búsqueda global.
- Notificaciones.
- Avatar.
- Usuario.
- Rol.

---

# 8. Tarjetas KPI

Formato:

```text
┌──────────────────┐
│ 🏨 DISPONIBLES   │
│                  │
│ 12               │
│ ↑ 8% vs ayer     │
└──────────────────┘
```

Recomendación:

```text
6–8 KPI por pantalla
```

---

# 9. Botones

## Primario

```css
background: #2563EB;
color: #FFFFFF;
```

Ejemplos:

- + Nueva reserva
- Realizar check-in
- Registrar pago
- Nuevo pedido
- Nuevo producto

## Secundario

- Fondo blanco.
- Borde azul.
- Texto azul.

## Peligroso

- Rojo.
- Confirmación obligatoria.

---

# 10. Badges

Estados siempre mediante:

```text
Icono + texto + color
```

Ejemplos:

```text
✓ Disponible
● Ocupada
◷ Pendiente
✓ Pagado
⚠ Stock bajo
✕ Rechazado
```

---

# 11. Tablas

Toolbar estándar:

```text
[ Buscar... ] [ Estado ▼ ] [ Fecha ▼ ] [ Filtros ] [+ Nuevo]
```

Las tablas deben:

- Permitir búsqueda.
- Tener filtros.
- Tener paginación.
- Resaltar fila seleccionada.
- Mostrar acciones simples.
- Abrir detalles en drawer.
- Evitar columnas innecesarias.

---

# 12. Drawer lateral

Utilizar para:

- Cliente.
- Reserva.
- Habitación.
- Pedido.
- Contrato.
- Evento.
- Empleado.
- Auditoría.

Estructura:

```text
Título
Estado
Información principal
Información relacionada
Historial
Acciones rápidas
```

---

# 13. Modales

Usar únicamente para acciones breves:

- Confirmar pago.
- Cancelar reserva.
- Registrar merma.
- Autorizar acceso manual.
- Confirmar check-out.
- Eliminar registro.

Los formularios largos deben tener vista propia.

---

# 14. Formularios por pasos

Ejemplo Check-in:

```text
1 Cliente
2 Identificación
3 Habitación
4 Servicios
5 Pago
6 Contrato
7 Confirmación
```

Ejemplo Reserva:

```text
1 Cliente
2 Fechas
3 Habitación
4 Huéspedes
5 Servicios
6 Resumen
7 Pago
```

---

# 15. Microinteracciones

Aplicar:

- Hover.
- Transiciones 150–250 ms.
- Skeleton loading.
- Toast.
- Barras de progreso.
- Cambio animado de estado.

---

# 16. BLOQUE 1 — Inicio y control general

## Dashboard administrativo

### KPI

- Disponibles.
- Ocupadas.
- Reservadas.
- En limpieza.
- Ingresos.
- Pagos pendientes.
- Pedidos activos.
- Alertas.

### Widgets

- Ocupación por piso.
- Reservas próximas.
- Check-ins.
- Check-outs.
- Incidencias.
- Stock crítico.
- Aforo de piscina.

UX:

```text
Visual
Rápido
No saturado
Accionable
```

---

# 17. BLOQUE 2 — Recepción y operación hotelera

## 17.1 Mapa de habitaciones

Tabs:

```text
Piso 1 | Piso 2 | Piso 3 | Piso 4
```

Habitación:

```text
┌──────────────┐
│ Hab. 305     │
│ Matrimonial  │
│ ● Ocupada    │
│ Juan Pérez   │
└──────────────┘
```

Al hacer clic abrir drawer con:

- huésped.
- fechas.
- saldo.
- limpieza.
- incidencias.

## 17.2 Clientes

Pantalla:

```text
KPI
Filtros
Tabla
Drawer
```

Drawer:

- datos personales.
- reservas.
- estadías.
- consumo.
- preferencias.
- mascotas.
- incidencias.
- encuestas.

CTA:

```text
+ Nuevo cliente
```

## 17.3 Reservas

KPI:

- Activas.
- Llegadas hoy.
- Pendientes.
- Confirmadas.
- Adelantos.
- Saldo.

Tabla:

```text
Código
Cliente
Habitación
Entrada
Salida
Total
Adelanto
Saldo
Estado
```

Drawer:

- huésped.
- habitación.
- fechas.
- servicios.
- mascotas.
- cochera.
- importe.
- 50 % de adelanto.
- tiempo límite.

CTA:

```text
+ Nueva reserva
```

## 17.4 Contratos

Debe mostrar:

- Código.
- QR.
- Estado.
- Versión.
- Reserva.
- Cliente.
- Habitación.
- Vista previa.

Acciones:

```text
Imprimir
Descargar PDF
Reimprimir
Enviar
Subir firmado
Nueva versión
Crear adenda
```

## 17.5 Check-in

Wizard:

```text
Cliente
→ Identificación
→ Habitación
→ Servicios
→ Pago
→ Contrato
→ Confirmación
```

Elementos clave:

- documento verificado.
- pago.
- contrato firmado.
- evidencias.
- llaves.
- controles.

## 17.6 Check-out

Resumen:

- hospedaje.
- restaurante.
- bar.
- servicios.
- daños.
- total.
- pagado.
- saldo.

Secciones:

- cuenta.
- evidencias.
- penalidades.
- retiro anticipado.
- adenda.
- pago final.

## 17.7 Cuenta acumulada

Categorías:

```text
Hospedaje
Restaurante
Bar
Piscina
Cochera
Mascotas
Otros
```

Mostrar:

```text
Subtotal
Pagado
Saldo
```

## 17.8 Pagos / Comprobantes

KPI:

- Ingresos.
- Efectivo.
- Yape.
- Plin.
- Tarjeta.
- Pendientes.

Tabla:

```text
Código
Cliente
Reserva
Importe
Método
Operación
Estado
Fecha
```

Drawer:

- pago.
- comprobante.
- imprimir.
- descargar.
- enviar.

## 17.9 Caja

Tabs:

```text
Apertura
Movimientos
Cierre
```

Mostrar:

- fondo inicial.
- ingresos.
- egresos.
- esperado.
- contado.
- diferencia.

---

# 18. BLOQUE 3 — Operaciones internas

## Limpieza

Estados:

```text
Pendiente
Asignada
En limpieza
Completada
Aprobada
```

Mostrar:

- habitación.
- responsable.
- inicio.
- duración.
- evidencias.
- incidencias.

## Evidencias

Vista galería.

Filtros:

- habitación.
- fecha.
- tipo.
- responsable.

Comparación:

```text
Antes | Después
```

## Mantenimiento

KPI:

- reportados.
- asignados.
- reparación.
- urgentes.
- solucionados.

Tabla:

```text
Habitación
Problema
Prioridad
Responsable
Estado
Fecha
```

## Incidencias

Prioridad:

```text
Baja
Media
Alta
Urgente
```

Estado:

```text
Pendiente
Asignada
En proceso
Resuelta
Cerrada
```

---

# 19. BLOQUE 4 — Servicios al huésped

## Pedidos QR

Kanban:

```text
Recibidos
→ En preparación
→ Listos
→ Entregados
```

Cada tarjeta:

- pedido.
- ubicación.
- productos.
- hora.
- tiempo.
- estado.

## Piscina y Mirador

KPI:

- aforo.
- personas dentro.
- entradas.
- salidas.
- rechazados.
- ingresos.

Aforo visual:

```text
34 / 50
█████████████░░░
```

QR permitido:

```text
✓ ACCESO PERMITIDO
```

QR rechazado:

```text
✕ ACCESO RECHAZADO
Motivo
```

## Cochera

Mostrar:

- disponibles.
- ocupados.
- motos.
- motokar.
- autos.

Tabla:

```text
Placa
Cliente
Habitación
Tipo
Entrada
Salida
Espacio
Importe
```

## Mascotas

Mostrar:

- cliente.
- habitación.
- nombre.
- tipo.
- tamaño.
- ubicación.
- cargos.
- incidencias.

---

# 20. BLOQUE 5 — Cocina, Bar e Inventario

## Dashboard Cocina y Bar

KPI:

- pedidos.
- preparación.
- listos.
- ventas.
- mermas.
- botellas abiertas.
- onzas disponibles.
- stock crítico.

## Inventario de alimentos

Tabla:

```text
Producto
Categoría
Unidad
Stock
Mínimo
Vencimiento
Estado
```

Estados:

```text
Óptimo
Bajo
Crítico
Vencido
```

## Recetas de comidas

Cards:

- imagen.
- nombre.
- categoría.
- costo.
- precio.
- margen.
- estado.

Drawer:

- ingredientes.
- cantidades.
- costos.
- rentabilidad.

## Bebidas sin alcohol

Tabla:

- bebida.
- categoría.
- presentación.
- stock.
- precio.
- vencimiento.
- estado.

## Bar

Kanban:

```text
Recibidos
En preparación
Listos
Entregados
```

## Inventario de licores

Regla:

```text
Todo consumo operativo se expresa en OZ.
```

Tabla:

```text
Licor
Marca
Presentación
Botellas
Onzas disponibles
Estado
```

## Control de onzas y botellas

Visual recomendado:

```text
Whisky

19.36 oz / 25.36 oz
██████████████░░░ 76 %

16 porciones
```

Estados:

```text
Cerrada
Abierta
Terminada
Stock bajo
```

## Cócteles y recetas

Drawer:

```text
Ron        1.5 oz
Jarabe     0.5 oz
Limón      1.0 oz
Soda       3.0 oz
```

## Mermas y cortesías

Tabs:

```text
Mermas | Cortesías
```

Tabla:

```text
Producto
Cantidad
Unidad
Motivo
Responsable
Valor
Estado
```

Para licor:

```text
Unidad = oz
```

## Apertura / Cierre de Bar

Mostrar:

- responsable.
- turno.
- botellas.
- onzas.
- stock inicial.
- esperado.
- físico.
- diferencia.

## Conteo físico

Tabla:

```text
Producto
Sistema
Físico
Diferencia
Unidad
```

## Movimientos

Tipos:

- Compra.
- Venta.
- Ajuste.
- Merma.
- Cortesía.
- Consumo.
- Vencimiento.

## Proveedores

Tabla:

- proveedor.
- RUC.
- contacto.
- teléfono.
- categoría.
- estado.

## Reportes Cocina y Bar

KPI:

- ventas.
- costos.
- utilidad.
- margen.

Gráficos:

- ventas por categoría.
- productos.
- turnos.
- oz.
- mermas.

---

# 21. BLOQUE 6 — Eventos

## Eventos privados

KPI:

- programados.
- hoy.
- adelantos.
- saldo.
- espacios ocupados.

Tabla:

```text
Código
Cliente
Tipo
Espacio
Fecha
Horario
Asistentes
Adelanto
Saldo
Estado
```

Drawer:

- información.
- servicios.
- personal.
- pagos.
- notas.

## Calendario de eventos

Vistas:

```text
Mes
Semana
Día
```

Debe detectar:

```text
⚠ Conflicto de horario
```

Drawer:

- cliente.
- espacio.
- fecha.
- asistentes.
- servicios.
- personal.
- pago.

---

# 22. BLOQUE 7 — Personal y organización

## Administración de personal

KPI:

- activos.
- contrataciones.
- áreas.
- pagos.
- vacaciones.
- contratos próximos.

Tabla:

```text
Código
Colaborador
Cargo
Área
Teléfono
Ingreso
Sueldo
Estado
```

## Asistencia

KPI:

- entradas.
- salidas.
- tardanzas.
- faltas.
- extras.
- horas trabajadas.

Métodos:

```text
Huella
QR
Manual
```

## Turnos

Calendario semanal.

Filas:

```text
Recepción
Limpieza
Cocina
Bar
Mantenimiento
Seguridad
```

Estados:

- programado.
- confirmado.
- permiso.
- vacaciones.

## Roles y permisos

Matriz:

```text
             Admin Recepción Limpieza Cocina Bar...
Dashboard       ✓      ✓        ✓       ✓
Reservas        ✓      ✓
Check-in        ✓      ✓
Inventario      ✓                       ✓
```

Permisos:

```text
Ver
Crear
Editar
Aprobar
Eliminar
```

---

# 23. BLOQUE 8 — Comunicación, análisis y seguridad

## Centro de notificaciones

KPI:

- enviadas.
- programadas.
- fallidas.
- tasa de entrega.
- WhatsApp.
- correo.

Filtros:

```text
Canal
Tipo
Estado
Fecha
```

Drawer:

- destinatario.
- evento origen.
- plantilla.
- mensaje.
- estado.
- historial.

## Seguimiento post-estadía

KPI:

- calificación.
- respuestas.
- pendientes.
- promociones autorizadas.
- NPS.
- incidencias.

Drawer:

- habitación.
- check-out.
- calificaciones.
- comentarios.
- consentimiento.

## Reportes y estadísticas

KPI:

- ocupación.
- ingresos.
- clientes.
- cocina/bar.
- horas trabajadas.
- eventos.

Gráficos:

- ingresos por día.
- distribución.
- top indicadores.

Exportación:

```text
PDF
Excel
```

## Auditoría

Tabla:

```text
Hora
Usuario
Módulo
Acción
Registro
Resultado
```

Drawer:

- usuario.
- acción.
- contexto.
- valor anterior.
- valor nuevo.
- motivo.

## Seguridad

Paneles:

- sesiones activas.
- políticas.
- alertas.
- actividad.
- protección de documentos.

KPI:

- estado.
- sesiones.
- intentos fallidos.
- accesos restringidos.
- documentos protegidos.
- último backup.

## Copias de seguridad

KPI:

- última copia.
- próxima copia.
- tamaño.
- retención.
- guardadas.
- advertencias.

Tabla:

```text
Código
Tipo
Fecha
Tamaño
Estado
Duración
```

Drawer:

- ejecución.
- contenido.
- integridad.
- acciones.

---

# 24. Responsive

## Desktop

```text
1440px+
```

- Sidebar fijo.
- Drawer lateral.
- 4–6 KPI por fila.

## Laptop

```text
1024px–1439px
```

- Sidebar contraíble.
- Menor separación.
- Menos KPI por fila.

## Tablet

```text
768px–1023px
```

- Sidebar drawer.
- Tablas con scroll.
- KPI en 2 columnas.

## Mobile

Priorizar módulos operativos:

- limpieza.
- mantenimiento.
- cocina.
- piscina.

Ejemplo:

```text
Habitación 305

EN LIMPIEZA

[ Iniciar ]
[ Subir foto ]
[ Incidencia ]
[ Finalizar ]
```

---

# 25. Accesibilidad

Aplicar:

- contraste suficiente.
- focus visible.
- navegación con teclado.
- botones de mínimo 44px.
- labels.
- icono + texto.
- mensajes claros.

Nunca transmitir estados solo con colores.

---

# 26. Estados de interfaz

## Loading

```text
Skeleton
```

## Empty

```text
No existen reservas para esta fecha.
```

## Error

```text
No fue posible cargar la información.

[ Reintentar ]
```

## Success

```text
✓ Operación realizada correctamente.
```

---

# 27. Componentes reutilizables

```text
AppLayout
Sidebar
SidebarGroup
SidebarItem
Topbar
GlobalSearch

PageHeader
StatCard
StatusBadge
DataTable
TableToolbar

FilterBar
SearchInput
SelectFilter
DateRangeFilter

DetailDrawer
ConfirmDialog
FormModal
Toast

FormSection
StepForm
StepIndicator

FileUploader
ImageGallery
BeforeAfterViewer

QrScanner
QrStatusResult
OccupancyGauge

KanbanBoard
KanbanColumn
OrderCard

RoomMap
RoomCard
FloorTabs

Calendar
EventCard

BottleLevel
StockProgress
InventoryStatus

BarChart
DonutChart
LineChart

EmptyState
ErrorState
Skeleton
Pagination
```

---

# 28. Design Tokens

```css
:root {
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;

  --color-navy: #0F172A;
  --color-primary: #2563EB;

  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-danger: #DC2626;
  --color-purple: #7C3AED;
  --color-gold: #C59D5F;

  --color-text: #0F172A;
  --color-muted: #64748B;
  --color-border: #E2E8F0;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --sidebar-width: 240px;
  --header-height: 72px;
}
```

---

# 29. Espaciado

Escala:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
```

Regla:

```text
Relacionado = menos separación
Distinto = mayor separación
```

---

# 30. Border radius

```text
Input     8px
Button    8px
Card      12–16px
Drawer    16px
Modal     16px
Badge     999px
```

---

# 31. Iconografía

Usar una sola librería:

```text
Lucide
Heroicons
Tabler Icons
```

No mezclar estilos.

---

# 32. Flujo UX principal

```text
Dashboard
   ↓
Reserva
   ↓
Pago 50 %
   ↓
Contrato
   ↓
Check-in
   ↓
Habitación ocupada
   ↓
Servicios
   ↓
Cuenta acumulada
   ↓
Check-out
   ↓
Limpieza
   ↓
Habitación disponible
   ↓
Encuesta
```

---

# 33. Acciones contextuales

## Reserva

```text
Ver cliente
Ver habitación
Registrar pago
Ver contrato
Realizar check-in
Cancelar
```

## Check-in

```text
Ver reserva
Ver contrato
Ver habitación
Subir evidencia
```

## Check-out

```text
Ver cuenta
Registrar daño
Crear adenda
Registrar pago
Finalizar
```

---

# 34. Reglas UI/UX finales

1. No saturar las pantallas.
2. Mostrar 6–8 KPI importantes.
3. Mantener una acción principal dominante.
4. Utilizar drawers para detalles.
5. Modales solo para acciones pequeñas.
6. Formularios grandes por pasos.
7. Estados mediante badges.
8. Usar icono + texto.
9. Reutilizar componentes.
10. Mantener la misma paleta.
11. Priorizar información accionable.
12. Alertas deben permitir actuar.
13. Mantener filtros simples.
14. Ocultar detalles secundarios hasta necesitarlos.
15. Usar gráficos cuando aporten valor.
16. Mostrar trazabilidad en operaciones críticas.
17. Mantener sensación premium.
18. Optimizar tareas repetitivas.
19. Reducir clics.
20. Mantener contexto del usuario.

---

# 35. Resultado visual esperado

La aplicación debe sentirse como:

```text
Hotel premium
+
Dashboard SaaS moderno
+
Sistema operativo de recepción
+
Control administrativo
```

Debe evitar parecer:

```text
ERP antiguo
Hoja de cálculo
Formulario gigante
Sistema saturado
```

Resultado:

```text
Limpio
Moderno
Elegante
Rápido
Visual
Consistente
Profesional
```

---

# 36. Documentos del proyecto

Se recomienda trabajar con:

## Documento funcional

```text
Hotel_Park_Plaza_Proyecto_Completo.md
```

Define:

```text
QUÉ hace el sistema.
```

## Documento técnico

```text
Hotel_Park_Plaza_Especificacion_Tecnica_Programacion.md
```

Define:

```text
CÓMO se programa.
```

## Documento UI/UX

```text
Hotel_Park_Plaza_UI_UX_Mockups.md
```

Define:

```text
CÓMO debe verse y sentirse.
```

Los tres deben mantenerse sincronizados.

---

# Fin del documento
