# Hotel Park Plaza

Prototipo frontend de un sistema integral de gestión hotelera (PMS) construido con React 19 y Vite 8. La interfaz conserva la identidad visual esmeralda, blanca y dorada del Hotel Park Plaza y cubre los dominios definidos en `Hotel_Park_Plaza_Proyecto_Completo_Actualizado.md`.

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0` (requisito declarado por Vite 8).
- npm y las dependencias de `package-lock.json`.

## Uso local

```bash
npm ci
npm run dev
```

Vite mostrará la URL local. La aplicación utiliza rutas hash, por ejemplo:

- `#/dashboard`
- `#/reservas`
- `#/checkin-checkout`
- `#/contratos`
- `#/recreacion`
- `#/configuracion`

Los enlaces hash permiten recargar una vista y usar Atrás/Adelante sin configurar un servidor de rutas.

## Arquitectura

- `src/domain/hotelModel.js`: vocabularios canónicos, tarifas, selectores y datos iniciales. Genera exactamente 38 habitaciones en cuatro pisos con distribución 8/8/11/11.
- `src/state/HotelContext.jsx`: único reducer propietario del estado del hotel y de las transiciones conectadas.
- `src/hooks/useHashRoute.js`: router hash sin dependencias.
- `src/components/ui/Overlay.jsx`: `Dialog`, `Drawer` y `Tabs` accesibles.
- `src/components/views/CoreViews.jsx`: recepción y módulos operativos existentes.
- `src/components/views/ExtendedViews.jsx`: contratos, finanzas, mascotas, recreación, cocina/bar, proveedores, incidencias, encuestas, permisos, auditoría y configuración.
- `src/integrations/biometrics/zkBridgeClient.js`: cliente del contrato local ZK9500 sin transportar biometría.
- `src/components/biometrics/`: controles reutilizables de enrolamiento, verificación y asistencia.
- `bridge/`: servicio Windows x86, almacenamiento cifrado local, configuración y scripts operativos. Ver `bridge/README.md`.

## Flujo conectado

La confirmación de una reserva actualiza disponibilidad y registra adelanto del 50 %, contrato, documento, caja, notificación y auditoría. El check-in crea la estadía y su cuenta; los pedidos reservan o consumen inventario y pueden cargar a la habitación. El check-out liquida la cuenta, finaliza contrato y accesos, y crea una tarea de limpieza. La habitación vuelve a estar disponible solamente después de aprobar esa tarea.

## Límites del prototipo

- Todo el estado vive en memoria y se reinicia al recargar la página.
- No hay autenticación, autorización de servidor ni protección real de datos personales.
- No se procesan pagos ni se emiten comprobantes fiscales.
- No se generan, firman, almacenan ni envían documentos reales.
- Correo, WhatsApp y pasarelas están pendientes de integración.
- El lector QR y la valla no están conectados. La biometría requiere iniciar y configurar el bridge local; la interfaz informa indisponibilidad y no simula resultados.
- No existen copias de seguridad ni almacenamiento seguro de evidencias.
- Las acciones externas nunca informan un éxito ficticio: muestran su estado pendiente o no disponible.

## Calidad

```bash
npm run lint
npm run build
npm run preview
```

No hay suite de pruebas automatizadas configurada todavía. Para una validación manual, revisar al menos las rutas anteriores en anchos de 320, 768, 1024 y escritorio amplio, además del flujo reserva → check-in → pedido → check-out → aprobación de limpieza.
