# Hotel Park Plaza

## 1. Descripción general

El sistema **Hotel Park Plaza** será una plataforma integral de gestión hotelera orientada a controlar las operaciones principales del establecimiento desde una sola aplicación.

El sistema permitirá administrar:

- Habitaciones.
- Reservas.
- Contratos de hospedaje.
- Check-in y check-out.
- Pagos y caja.
- Clientes.
- Limpieza.
- Mantenimiento.
- Pedidos mediante códigos QR.
- Cocina e inventario.
- Cochera.
- Mascotas.
- Piscina y mirador.
- Eventos privados.
- Personal.
- Asistencia y turnos.
- Incidencias.
- Encuestas de satisfacción.
- Reportes y estadísticas.
- Programa de clientes frecuentes.

---

# 2. Recepción y habitaciones

## 2.1 Distribución

El hotel tiene **4 pisos**.

- Los **2 primeros pisos** tienen **8 habitaciones** cada uno.
- Los **2 últimos pisos** tienen **11 habitaciones** cada uno.
- En total, el hotel cuenta con **38 habitaciones**.

## 2.2 Categorías de habitación

Las habitaciones podrán clasificarse en las siguientes categorías:

- Simple.
- Matrimonial.
- Doble.
- Triple.
- Suite.

Cada categoría permitirá indicar si la habitación cuenta o no con:

- Aire acondicionado.
- Televisor.
- Agua caliente.
- Wi-Fi.
- Frigobar.
- Otros servicios configurables.

El precio de la habitación dependerá de:

- Categoría.
- Aire acondicionado.
- Temporada.
- Número de huéspedes.
- Servicios adicionales contratados.

## 2.3 Estados de habitación

Cada habitación tendrá un estado actualizado en tiempo real:

- Disponible.
- Reservada.
- Ocupada.
- En limpieza.
- En mantenimiento.
- Bloqueada.
- Fuera de servicio.

No se podrá reservar una habitación mientras se encuentre en limpieza, mantenimiento, bloqueada o fuera de servicio.

## 2.4 Mapa visual del hotel

El sistema contará con una vista gráfica de los cuatro pisos.

Cada habitación podrá identificarse mediante colores según su estado.

Desde esta pantalla se podrá consultar rápidamente:

- Número de habitación.
- Categoría.
- Piso.
- Estado.
- Cliente alojado.
- Fecha de check-in.
- Fecha prevista de check-out.
- Saldo pendiente.
- Estado de limpieza.
- Incidencias activas.

---

# 3. Gestión de clientes

## 3.1 Registro de clientes

El sistema permitirá registrar:

- DNI, carnet de extranjería o pasaporte.
- Nombres y apellidos.
- Teléfono.
- Correo electrónico.
- Dirección.
- Nacionalidad.
- Fecha de nacimiento.
- Contacto de emergencia.
- Observaciones.

## 3.2 Historial del cliente

Cada cliente tendrá un historial con:

- Reservas realizadas.
- Habitaciones utilizadas.
- Número de estadías.
- Consumo acumulado.
- Servicios adicionales.
- Incidencias.
- Mascotas registradas.
- Preferencias.
- Última estadía.
- Cancelaciones.
- Calificaciones y encuestas.

## 3.3 Clientes frecuentes

Se podrá implementar un programa de fidelización.

Los beneficios podrán incluir:

- Descuentos.
- Cupones.
- Acceso gratuito a determinados servicios.
- Mejora de categoría de habitación.
- Promociones especiales.
- Beneficios por número de estadías.

---

# 4. Reservas

## 4.1 Registro de reserva

Cada reserva almacenará:

- Cliente.
- Habitación.
- Categoría.
- Fecha de ingreso.
- Fecha de salida.
- Número de huéspedes.
- Número de personas adicionales.
- Mascotas.
- Servicios adicionales.
- Importe total.
- Adelanto.
- Saldo pendiente.
- Estado.

## 4.2 Confirmación de reserva

Para confirmar una reserva, el cliente deberá pagar el **50 % del importe total**.

La reserva podrá tener los siguientes estados:

- Pendiente.
- Confirmada.
- Cliente presente.
- Completada.
- Cancelada.
- No presentado.
- Vencida.

## 4.3 Tiempo límite de llegada

Se establecerá un tiempo máximo de espera para la llegada del cliente.

El sistema mostrará una cuenta regresiva o indicador del tiempo restante.

Si el cliente llega dentro del plazo:

- Se registra el check-in.
- Se completa el pago correspondiente.

Si el cliente no llega dentro del plazo:

- La reserva cambia automáticamente a **No presentado**.
- El hotel retiene el 50 % abonado.
- La habitación se libera automáticamente para nuevas reservas.

## 4.4 Personas adicionales

Se realizará un cobro adicional por huéspedes que excedan la capacidad o cantidad inicialmente contratada.

El sistema calculará automáticamente este importe.

## 4.5 Generación automática del contrato de hospedaje

Una vez registrada la reserva y confirmado el pago requerido, el sistema generará automáticamente un **Contrato de Hospedaje** asociado a la reserva.

El contrato se generará inicialmente con estado **Pendiente de firma** y contendrá como mínimo:

### Datos del cliente

- Código único del contrato.
- Nombres y apellidos.
- DNI, carnet de extranjería o pasaporte.
- Teléfono.
- Correo electrónico.
- Dirección.
- Nacionalidad.

### Datos de la contratación

- Código de reserva.
- Número de habitación.
- Piso.
- Categoría de habitación.
- Servicios y características contratadas.
- Fecha de ingreso.
- Fecha de salida contratada.
- Número de noches.
- Número de huéspedes.
- Personas adicionales.
- Mascotas registradas.
- Cochera, si corresponde.
- Servicios adicionales.
- Precio por noche.
- Importe total.
- Adelanto realizado.
- Saldo pendiente.
- Método de pago.

### Condiciones del hospedaje

El contrato deberá incluir de manera clara:

- Horarios de check-in y check-out.
- Condiciones de permanencia.
- Responsabilidad del huésped sobre los bienes de la habitación.
- Normas sobre ruido, visitas y uso de instalaciones.
- Restricciones establecidas por el hotel.
- Política sobre mascotas.
- Política de personas adicionales.
- Política de cochera.
- Política de zonas recreativas.
- Condiciones para retiro anticipado.
- Condiciones para ampliación de estadía.
- Política de cancelación y no presentación.
- Obligaciones del hotel.
- Obligaciones del huésped.
- Multas, penalidades y cargos adicionales aplicables.

### Obligaciones del huésped

El contrato podrá establecer, entre otras obligaciones:

- Mantener la habitación y sus bienes en buenas condiciones.
- Respetar las normas internas del establecimiento.
- Informar cualquier daño o incidencia.
- No exceder la cantidad de huéspedes autorizada sin comunicarlo.
- No retirar bienes pertenecientes al hotel.
- Cumplir las condiciones establecidas para mascotas.
- Cumplir los horarios de salida.
- Pagar los consumos y servicios adicionales generados durante la estadía.

### Multas y penalidades

El sistema permitirá administrar un **catálogo configurable de penalidades**, evitando que los importes queden fijados directamente en el código del sistema.

Se podrán configurar conceptos como:

- Pérdida de llave.
- Pérdida o daño de control remoto.
- Daños en televisores u otros equipos.
- Daños en muebles.
- Daños en sábanas, colchones o toallas.
- Fumar en habitaciones cuando esté prohibido.
- Limpieza extraordinaria.
- Daños ocasionados por mascotas.
- Objetos faltantes.
- Salida fuera del horario permitido.
- Daños en instalaciones.
- Otras penalidades definidas por la administración.

Cada penalidad podrá tener:

- Nombre.
- Descripción.
- Importe.
- Tipo de cargo.
- Estado activo o inactivo.
- Evidencia requerida.
- Usuario que aplicó el cargo.
- Fecha y hora.

## 4.6 Estados del contrato

El contrato podrá tener los siguientes estados:

- Generado.
- Pendiente de firma.
- Firmado.
- Modificado.
- Con adenda.
- Finalizado.
- Anulado.

## 4.7 Versionado del contrato

Los contratos no deberán reemplazarse silenciosamente cuando exista una modificación.

Cada cambio importante generará una nueva versión.

Ejemplo:

- Contrato V1: contratación original.
- Contrato V2: modificación antes del ingreso.
- Adenda V1: cambio durante la estadía.
- Contrato final: cierre de la estadía.

El sistema conservará todas las versiones para mantener la trazabilidad.

## 4.8 Código único y QR del contrato

Cada contrato tendrá un código único, por ejemplo:

`HP-2026-000152`

El documento podrá incluir un código QR que permita consultar dentro del sistema:

- Reserva relacionada.
- Cliente.
- Habitación.
- Estado del contrato.
- Versión.
- Fecha de generación.
- Documento firmado asociado.

## 4.9 Impresión y exportación

Una vez generado el contrato, el sistema permitirá:

- Visualizarlo antes de imprimir.
- Descargarlo en PDF.
- Realizar impresión directa.
- Reimprimirlo.
- Generar una copia para el cliente.
- Enviarlo por correo electrónico.
- Enviarlo por WhatsApp, si el canal se encuentra habilitado.

La impresión mostrará un formato preparado para firma del huésped y del representante del hotel.

---

# 5. Check-in

El **Check-in** será el momento en el que se validará definitivamente la contratación antes de entregar la habitación al huésped.

El contrato podrá haberse generado previamente en el módulo de Reservas, pero su **verificación final, firma y carga del documento firmado** se realizará dentro del módulo de Check-in.

## 5.1 Verificación de identidad

Durante el ingreso del cliente se registrará y verificará:

- Hora real de llegada.
- Documento de identidad presentado.
- Tipo de documento.
- Número de documento.
- Número de huéspedes.
- Acompañantes.
- Mascotas.
- Vehículo.
- Servicios contratados.
- Pago pendiente.
- Observaciones.

Los documentos aceptados podrán incluir:

- DNI.
- Carnet de extranjería.
- Pasaporte, cuando corresponda.

El documento será utilizado para verificar la identidad del huésped y registrar los datos necesarios dentro del sistema.

El sistema deberá registrar:

- Tipo de documento presentado.
- Número.
- Fecha y hora de verificación.
- Usuario que realizó la verificación.
- Resultado de la validación.

El documento de identidad original será devuelto al cliente después de la verificación.

## 5.2 Revisión del contrato

Antes de completar el Check-in, el recepcionista podrá visualizar el contrato generado desde la reserva.

Se deberá verificar:

- Identidad del huésped.
- Habitación asignada.
- Fechas contratadas.
- Número de huéspedes.
- Servicios.
- Mascotas.
- Cochera.
- Precio.
- Adelanto.
- Saldo.
- Obligaciones.
- Multas y penalidades.
- Políticas del hotel.

Si se detecta una modificación antes de la firma, se generará una nueva versión del contrato.

## 5.3 Firma del contrato

El huésped podrá firmar el contrato:

- De manera manuscrita sobre la copia impresa.
- Mediante firma digital, si el sistema implementa esta funcionalidad.

En el caso de firma manuscrita:

1. Se imprime el contrato.
2. El cliente revisa las condiciones.
3. El cliente firma el documento.
4. El representante del hotel firma cuando corresponda.
5. El documento firmado se digitaliza.
6. Se carga al sistema.

## 5.4 Carga del contrato firmado

El sistema permitirá adjuntar:

- PDF.
- Fotografía.
- Documento escaneado.

El registro del contrato firmado almacenará:

- Archivo.
- Fecha de firma.
- Fecha de carga.
- Usuario que realizó la carga.
- Versión firmada.
- Código del contrato.
- Observaciones.

El documento firmado quedará asociado permanentemente a:

- Cliente.
- Reserva.
- Habitación.
- Estadía.

## 5.5 Evidencias iniciales

También se podrá registrar durante el Check-in:

- Evidencia fotográfica del estado de la habitación.
- Estado del mobiliario.
- Estado de equipos.
- Entrega de llaves.
- Entrega de controles remotos.
- Otros objetos entregados al huésped.

Estas evidencias podrán utilizarse posteriormente para comparar el estado inicial con el estado encontrado durante el Check-out.

## 5.6 Finalización del Check-in

Una vez completado el proceso:

- Se registra la hora real de ingreso.
- La reserva cambia a **Cliente presente**.
- El contrato cambia a **Firmado**.
- La habitación cambia automáticamente a **Ocupada**.
- Se inicia la cuenta acumulada de la habitación.

---

# 6. Check-out

Al finalizar la estadía, el sistema deberá calcular la cuenta completa del cliente.

Se considerarán:

- Hospedaje.
- Personas adicionales.
- Comida.
- Bebidas.
- Mascotas.
- Cochera.
- Piscina.
- Mirador.
- Limpieza adicional.
- Daños.
- Eventos.
- Otros servicios.

Durante el check-out se podrá registrar:

- Hora de salida.
- Saldo final.
- Método de pago.
- Observaciones.
- Evidencias.
- Daños encontrados.

Una vez completado el check-out:

1. Se registra la hora real de salida.
2. Se cierra la cuenta de la habitación.
3. El contrato pasa a estado **Finalizado**.
4. La habitación pasará a estado **En limpieza**.
5. Se notificará al personal responsable.
6. Después de aprobar la limpieza, volverá a estado **Disponible**.

## 6.1 Retiro anticipado

Si el cliente contrató una habitación por una cantidad determinada de noches pero decide retirarse antes de la fecha pactada, el sistema permitirá registrar un **Retiro anticipado**.

No se deberá eliminar ni reemplazar la información original de la contratación.

Se conservarán:

- Fecha de ingreso contratada.
- Fecha de salida contratada.
- Número de noches contratadas.
- Importe originalmente pactado.

Y se agregarán:

- Fecha real de salida.
- Hora real de salida.
- Número de noches efectivamente utilizadas.
- Motivo del retiro anticipado.
- Usuario que registró la modificación.
- Fecha y hora de modificación.

## 6.2 Recálculo por retiro anticipado

Al registrar un retiro anticipado, el sistema deberá:

1. Solicitar la nueva fecha y hora de salida.
2. Registrar el motivo.
3. Calcular las noches efectivamente utilizadas.
4. Aplicar la política de retiro anticipado configurada por el hotel.
5. Recalcular el hospedaje cuando corresponda.
6. Mantener los consumos y servicios adicionales realizados.
7. Mantener los cargos por daños o penalidades existentes.
8. Mostrar el importe originalmente contratado.
9. Mostrar el importe recalculado.
10. Calcular el nuevo saldo a pagar o el importe sujeto a devolución según la política del hotel.
11. Registrar al usuario que autorizó la modificación.

## 6.3 Adenda por modificación de estadía

Cuando se modifique una condición relevante después de que el contrato haya sido firmado, se generará automáticamente una **Adenda al Contrato de Hospedaje**.

La adenda podrá registrar:

- Código del contrato original.
- Número de adenda.
- Fecha.
- Motivo.
- Condición original.
- Nueva condición.
- Fecha de salida original.
- Nueva fecha de salida.
- Importe original.
- Nuevo importe.
- Observaciones.
- Firma del cliente.
- Firma del representante del hotel.

La adenda también podrá:

- Imprimirse.
- Descargarse en PDF.
- Firmarse.
- Subirse al sistema.
- Consultarse desde el historial del contrato.

## 6.4 Acta de daños y penalidades

Si durante el Check-out se detecta un daño o corresponde aplicar una penalidad, el sistema permitirá generar un **Acta de Daños o Incidencias**.

El acta podrá contener:

- Cliente.
- Habitación.
- Fecha.
- Tipo de daño.
- Descripción.
- Bien afectado.
- Evidencia fotográfica o en video.
- Penalidad aplicada.
- Importe.
- Responsable que realizó la revisión.
- Observaciones.

La penalidad deberá estar asociada a evidencia cuando la política del hotel así lo requiera.

## 6.5 Comparación de evidencias

Durante el Check-out se podrá visualizar:

- Evidencia registrada en el Check-in.
- Evidencia registrada durante la estadía.
- Evidencia registrada en el Check-out.

Esto permitirá comparar el estado de:

- Habitación.
- Muebles.
- Equipos.
- Sábanas.
- Toallas.
- Controles.
- Llaves.
- Otros bienes del hotel.

---

# 7. Cuenta acumulada por habitación

Cada habitación ocupada tendrá una cuenta asociada al huésped.

Los consumos se agregarán automáticamente durante su estadía.

La cuenta podrá incluir:

- Hospedaje.
- Restaurante.
- Bar.
- Bebidas.
- Piscina.
- Mirador.
- Cochera.
- Mascotas.
- Limpieza adicional.
- Daños.
- Otros servicios.

El cliente podrá pagar:

- Todo al finalizar.
- Parcialmente durante la estadía.
- Directamente al realizar determinados pedidos.

---

# 8. Pagos

El sistema permitirá registrar diferentes métodos de pago:

- Efectivo.
- Yape.
- Plin.
- Tarjeta.
- Transferencia.
- Pasarela de pagos.

Cada pago almacenará:

- Cliente.
- Reserva.
- Importe.
- Método.
- Fecha.
- Responsable.
- Número de operación.
- Estado.

---

# 9. Facturación y comprobantes

El sistema podrá generar:

- Boletas.
- Facturas.
- Recibos.
- Comprobantes de adelanto.
- Comprobantes de servicios.
- Resumen de consumo.
- Comprobante final de estadía.

Los documentos podrán descargarse o enviarse al cliente mediante:

- Correo electrónico.
- WhatsApp.
- Impresión.

Además, el sistema administrará documentos contractuales relacionados con la estadía:

- Contrato de hospedaje.
- Versiones del contrato.
- Adendas.
- Contrato firmado digitalizado.
- Actas de daños.
- Constancias de modificación.
- Comprobante final de estadía.

Los documentos contractuales permitirán:

- Vista previa.
- Generación PDF.
- Impresión directa.
- Reimpresión.
- Carga de documento firmado.
- Consulta histórica.
- Asociación con cliente, reserva y habitación.

---

# 10. Caja

## 10.1 Apertura de caja

Cada trabajador autorizado podrá realizar la apertura de caja indicando:

- Fecha.
- Hora.
- Monto inicial.
- Responsable.
- Observaciones.

## 10.2 Movimientos

Se registrarán ingresos provenientes de:

- Reservas.
- Hospedaje.
- Restaurante.
- Bar.
- Piscina.
- Mirador.
- Cochera.
- Mascotas.
- Eventos.
- Otros servicios.

También podrán registrarse egresos autorizados.

## 10.3 Cierre de caja

Al finalizar el turno se registrará:

- Total esperado.
- Total contado.
- Diferencia.
- Ingresos por método de pago.
- Egresos.
- Responsable del cierre.

---

# 11. Mascotas

Se realizará un cobro adicional por mascotas.

Se habilitará la zona de cochera para el alojamiento de mascotas cuando corresponda.

Si el cliente mantiene la mascota dentro de la habitación, podrán aplicarse cargos por:

- Cambio adicional de sábanas.
- Limpieza especial.
- Daños.
- Desinfección.

El sistema almacenará:

- Tipo de mascota.
- Nombre.
- Tamaño.
- Observaciones.
- Lugar de alojamiento.
- Cobro aplicado.

El personal deberá registrar cualquier daño ocasionado a la propiedad.

---

# 12. Zonas recreativas

El hotel podrá gestionar servicios adicionales como:

- Piscina.
- Mirador.

El uso tendrá un cobro adicional configurable.

El cliente recibirá un brazalete de color que permita identificar las zonas contratadas.

También se entregarán avisos y recomendaciones sobre:

- Horarios.
- Tipo de ropa permitida.
- Objetos necesarios.
- Normas de uso.

El sistema registrará:

- Cliente.
- Zona utilizada.
- Fecha.
- Hora.
- Importe.
- Personal responsable.

## 12.1 Control de acceso a piscina mediante QR

La piscina contará con un **lector de código QR conectado a una valla o puerta de acceso automática**.

Cuando un huésped desee ingresar, deberá presentar su código QR ante el lector.

El sistema realizará una validación en tiempo real antes de permitir el acceso.

Se comprobará como mínimo:

- Que el código QR sea válido.
- Que corresponda a un huésped registrado.
- Que exista una reserva activa.
- Que el servicio de piscina haya sido contratado y pagado.
- Que el acceso se encuentre vigente.
- Que el huésped se encuentre dentro del horario autorizado.
- Que no se haya alcanzado el aforo máximo.
- Que el número de accesos autorizados no haya sido superado.

Si todas las validaciones son correctas:

1. El sistema aprobará el acceso.
2. La valla se abrirá automáticamente.
3. Se registrará la hora de ingreso.
4. Se actualizará el aforo de la piscina.
5. El acceso quedará asociado al cliente, huésped, reserva y habitación.

Si alguna validación falla:

1. La valla permanecerá cerrada.
2. El sistema mostrará el motivo del rechazo.
3. El intento quedará registrado para consulta y auditoría.

Los motivos de rechazo podrán incluir:

- Servicio no contratado.
- Pago pendiente.
- QR inválido.
- QR vencido.
- Reserva finalizada.
- Fuera del horario permitido.
- Límite de accesos alcanzado.
- Aforo máximo alcanzado.
- Acceso bloqueado administrativamente.

## 12.2 QR dinámico y vinculado al huésped

El acceso a piscina utilizará un **QR dinámico o validado contra la reserva activa**, evitando depender de un código permanente que pueda ser compartido fácilmente.

El QR estará relacionado con:

- Cliente.
- Huésped autorizado.
- Reserva.
- Habitación.
- Servicio de piscina.
- Fecha de vigencia.
- Estado del pago.
- Cantidad de accesos permitidos.

Para grupos o familias, el sistema permitirá definir cuántas personas tienen acceso.

Cuando se requiera un control más preciso, podrá generarse un QR individual por huésped.

## 12.3 Estados del acceso a piscina

El acceso podrá manejar estados como:

- No contratado.
- Pendiente de pago.
- Pagado.
- Habilitado.
- Dentro de piscina.
- Finalizado.
- Vencido.
- Bloqueado.

Cuando recepción registre correctamente el pago del servicio, el acceso podrá pasar automáticamente a **Habilitado**.

## 12.4 Control de entrada y salida

Además del lector de ingreso, se recomienda contar con un lector para registrar la salida de la zona de piscina.

Cada movimiento almacenará:

- Cliente.
- Huésped.
- Habitación.
- Reserva.
- Código QR utilizado.
- Fecha.
- Hora.
- Tipo de movimiento: entrada o salida.
- Lector utilizado.
- Resultado de validación.
- Motivo de rechazo, si corresponde.
- Usuario responsable, cuando exista intervención manual.

Esto permitirá conocer cuántas personas se encuentran dentro de la piscina en tiempo real.

## 12.5 Control de aforo

El sistema manejará un aforo máximo configurable.

El dashboard podrá mostrar información como:

- Aforo actual.
- Capacidad máxima.
- Espacios disponibles.
- Entradas del día.
- Salidas del día.
- Accesos rechazados.
- Huéspedes con acceso activo.

Ejemplo:

`Aforo actual: 34 / 50 personas`

Cuando se alcance el aforo máximo, el sistema podrá rechazar temporalmente nuevos ingresos hasta que se registre una salida.

## 12.6 Control de cantidad de personas autorizadas

El pago del servicio deberá indicar cuántas personas tienen derecho de acceso.

Ejemplo:

- Habitación 305.
- 4 huéspedes registrados.
- 2 accesos a piscina contratados.

En este caso, el sistema deberá permitir únicamente la cantidad de accesos autorizados según la política configurada.

La administración podrá definir si el acceso es:

- Una sola entrada.
- Múltiples entradas durante el día.
- Acceso ilimitado durante una fecha determinada.
- Acceso durante toda la estadía.

## 12.7 Acceso manual autorizado

En caso de falla del lector, problema con el QR o una situación excepcional, un usuario autorizado podrá permitir el ingreso manualmente.

Esta acción deberá registrar obligatoriamente:

- Cliente.
- Habitación.
- Fecha.
- Hora.
- Usuario que autorizó.
- Motivo.
- Observaciones.

El acceso manual quedará registrado en la auditoría del sistema.

## 12.8 Desactivación automática en Check-out

Cuando el huésped complete el Check-out, todos los accesos vinculados a su estadía deberán quedar automáticamente deshabilitados.

Esto incluirá:

- Piscina.
- Mirador.
- Otros servicios controlados mediante QR.

Aunque el cliente conserve una fotografía o copia del QR, el sistema deberá rechazarlo porque la reserva ya no se encuentra activa.

## 12.9 Historial de accesos

Dentro del historial del cliente y de la reserva se podrá consultar:

- Servicio contratado.
- Importe pagado.
- Fecha de habilitación.
- Cantidad de accesos.
- Primera entrada.
- Última entrada.
- Última salida.
- Accesos rechazados.
- Estado actual del acceso.

## 12.10 Panel de monitoreo de piscina

El sistema contará con una vista administrativa para supervisar el funcionamiento del acceso.

Podrá mostrar:

- Personas actualmente dentro.
- Aforo disponible.
- Ingresos registrados hoy.
- Salidas registradas hoy.
- Accesos rechazados.
- Huéspedes con acceso habilitado.
- Ingresos económicos por piscina.
- Alertas del lector o de la valla.
- Accesos manuales autorizados.

## 12.11 Flujo del acceso a piscina

El flujo general será:

**Cliente solicita piscina**
→ **Servicio registrado**
→ **Pago confirmado**
→ **Acceso QR habilitado**
→ **Cliente llega a la piscina**
→ **Escanea QR**
→ **Sistema valida reserva, pago, vigencia, horario, accesos y aforo**
→ **Valla se abre**
→ **Entrada registrada**
→ **Aforo actualizado**
→ **Cliente utiliza la piscina**
→ **Registra salida**
→ **Aforo actualizado**

Si la validación falla:

**QR escaneado**
→ **Validación rechazada**
→ **Valla permanece cerrada**
→ **Se muestra el motivo**
→ **Intento registrado en el sistema**

---

# 13. Cochera

El acceso a cochera dependerá de:

- Categoría de habitación.
- Tipo de vehículo.
- Disponibilidad.

Tipos de vehículos:

- Moto.
- Motokar.
- Auto.

Condiciones generales:

- Moto: uso gratuito.
- Motokar y auto: cobro configurable según la categoría de habitación.

Cada registro podrá almacenar:

- Cliente.
- Placa.
- Tipo de vehículo.
- Hora de ingreso.
- Hora de salida.
- Espacio asignado.
- Importe.

---

# 14. Labor de limpieza

Cuando una habitación esté próxima a liberarse, se notificará automáticamente al personal de limpieza.

Durante la limpieza:

- La habitación quedará inhabilitada para nuevas reservas.
- El estado cambiará a **En limpieza**.

El trabajador deberá registrar:

- Hora de inicio.
- Hora de finalización.
- Observaciones.
- Productos utilizados.
- Fotos.
- Videos.
- Incidencias encontradas.

Después de finalizar:

1. El trabajador marcará la tarea como completada.
2. Un responsable podrá revisar las evidencias.
3. La habitación será habilitada nuevamente.
4. Su estado cambiará a **Disponible**.

---

# 15. Evidencias del estado de habitaciones

Se podrán registrar fotografías o videos durante:

- Check-in.
- Check-out.
- Limpieza.
- Mantenimiento.

Esto permitirá comparar el estado de la habitación antes y después de una estadía.

Las evidencias podrán utilizarse para comprobar:

- Daños.
- Objetos faltantes.
- Problemas de limpieza.
- Problemas de mantenimiento.

---

# 16. Mantenimiento

El sistema permitirá reportar problemas relacionados con:

- Aire acondicionado.
- Electricidad.
- Agua.
- Televisión.
- Wi-Fi.
- Cerraduras.
- Puertas.
- Baños.
- Muebles.
- Otros equipos.

Cada reporte tendrá:

- Habitación.
- Tipo de problema.
- Descripción.
- Prioridad.
- Responsable.
- Fecha.
- Evidencia.
- Estado.
- Solución aplicada.

Estados posibles:

- Reportado.
- Asignado.
- En reparación.
- Solucionado.
- Cerrado.

Si el problema es grave, la habitación cambiará automáticamente a **Fuera de servicio**.

---

# 17. Pedidos mediante QR

## 17.1 QR de habitaciones

Cada habitación tendrá un código QR vinculado a:

- Número de habitación.
- Piso.
- Reserva activa.

El huésped podrá solicitar:

- Comida.
- Bebidas.
- Limpieza adicional.
- Solución de problemas.
- Servicios adicionales.

## 17.2 Información de pedidos

Para comida y bebidas se mostrará:

- Nombre del producto.
- Imagen.
- Descripción.
- Precio.
- Disponibilidad.
- Comentario del cliente.
- Tiempo estimado.
- Método de pago.

Métodos disponibles:

- Yape.
- Plin.
- Tarjeta.
- Pasarela de pagos.
- Cargar a la habitación.

## 17.3 Estados del pedido

Los pedidos tendrán los siguientes estados:

1. Pedido recibido.
2. Confirmado.
3. En preparación.
4. Listo.
5. En camino.
6. Entregado.
7. Pagado.
8. Cancelado.

El cliente podrá consultar el estado desde su dispositivo.

## 17.4 Integración con inventario

Cuando un pedido de comida o bebida sea confirmado y preparado, el sistema se comunicará con el módulo de inventario.

Para comidas:

- Descontará los ingredientes definidos en la receta.

Para bebidas:

- Descontará las unidades o cantidades utilizadas.

Para cócteles y licores:

- Descontará automáticamente las cantidades correspondientes en onzas.

Los pedidos cancelados antes de su preparación no deberán generar consumo definitivo de inventario.

---

# 18. QR de la zona de barra

Se habilitará un código QR para solicitar:

- Comida.
- Bebidas.
- Servicios adicionales.

Cada pedido mostrará:

- Precio.
- Comentario.
- Tiempo estimado.
- Método de pago.
- Estado.

---

# 19. QR de la terraza

Se habilitará un código QR para solicitar:

- Comida.
- Bebidas.
- Servicios adicionales.

Los pedidos funcionarán con el mismo sistema de seguimiento utilizado en habitaciones y barra.

---

# 20. Gestión de alimentos, bebidas y bar

El sistema permitirá administrar de manera integrada los alimentos, bebidas, licores, recetas, inventario, consumos, mermas y operaciones del bar.

El inventario se dividirá en las siguientes categorías principales:

- Alimentos.
- Bebidas sin alcohol.
- Licores.
- Insumos para cócteles.
- Productos terminados.
- Productos de apoyo para cocina y bar.

Cada movimiento deberá quedar registrado dentro del sistema.

## 20.1 Inventario de alimentos

El sistema permitirá registrar los alimentos e insumos utilizados por cocina.

Ejemplos:

- Carnes.
- Pollo.
- Pescado.
- Arroz.
- Papas.
- Verduras.
- Frutas.
- Lácteos.
- Aceites.
- Condimentos.
- Panes.
- Otros insumos.

Cada producto podrá registrar:

- Nombre.
- Categoría.
- Unidad de medida.
- Stock actual.
- Stock mínimo.
- Stock máximo.
- Lote.
- Fecha de ingreso.
- Fecha de vencimiento.
- Proveedor.
- Precio de compra.
- Costo unitario.
- Estado.

Las unidades podrán incluir:

- Miligramos.
- Gramos.
- Kilogramos.
- Mililitros.
- Litros.
- Unidades.

## 20.2 Recetas de comidas

Cada plato tendrá una receta asociada.

La receta indicará exactamente cuánto de cada ingrediente se necesita para preparar una porción.

Ejemplo:

### Hamburguesa clásica

- Carne: 180 g.
- Pan: 1 unidad.
- Queso: 30 g.
- Lechuga: 20 g.
- Tomate: 30 g.
- Papas: 150 g.

Cuando cocina marque el pedido como **En preparación**, el sistema podrá reservar los insumos.

Cuando el pedido sea confirmado como preparado, se realizará el descuento definitivo del inventario.

Si el pedido es cancelado antes de prepararse, los insumos reservados deberán liberarse.

## 20.3 Bebidas sin alcohol

El inventario de bebidas sin alcohol podrá incluir:

- Agua.
- Gaseosas.
- Jugos.
- Energizantes.
- Café.
- Té.
- Leche.
- Jarabes.
- Concentrados.
- Bebidas preparadas.

Los productos podrán controlarse por:

- Unidad.
- Mililitros.
- Litros.

En el caso de bebidas preparadas, también se utilizarán recetas.

Ejemplo:

### Limonada

- Jugo de limón: 2 oz.
- Jarabe: 1 oz.
- Agua: 6 oz.
- Hielo: cantidad configurada.

Cuando se prepare una bebida, el sistema descontará automáticamente los insumos correspondientes.

## 20.4 Gestión de bar

El módulo de bar permitirá administrar:

- Bebidas disponibles.
- Cócteles.
- Licores.
- Botellas.
- Porciones.
- Mermas.
- Cortesías.
- Degustaciones.
- Pedidos.
- Personal encargado.
- Apertura y cierre de turno.

Cada venta realizada desde el bar deberá estar asociada a:

- Producto o cóctel.
- Cantidad.
- Precio.
- Cliente o habitación, cuando corresponda.
- Método de pago.
- Trabajador que realizó la operación.
- Fecha.
- Hora.
- Turno.

## 20.5 Inventario de licores

Los licores serán administrados de forma independiente debido a que necesitan mayor control de consumo.

Cada licor podrá registrar:

- Nombre.
- Marca.
- Categoría.
- Presentación.
- Capacidad de la botella.
- Contenido total en onzas.
- Número de botellas cerradas.
- Número de botellas abiertas.
- Stock total disponible en onzas.
- Precio de compra por botella.
- Costo por onza.
- Precio de venta.
- Proveedor.
- Lote.
- Fecha de ingreso.
- Estado.

Ejemplos de categorías:

- Whisky.
- Ron.
- Vodka.
- Tequila.
- Pisco.
- Gin.
- Vino.
- Otros licores.

## 20.6 Control de licores en onzas

Para efectos del sistema, el consumo y las recetas de licores se manejarán utilizando la **onza (oz)** como unidad estándar.

Cada botella tendrá registrada su equivalencia total en onzas.

Ejemplo:

### Whisky

- Presentación: botella.
- Capacidad: 750 ml.
- Contenido aproximado: 25.36 oz.
- Porción estándar: 1.5 oz.

El sistema podrá calcular automáticamente:

- Onzas disponibles.
- Onzas consumidas.
- Onzas utilizadas en cócteles.
- Porciones disponibles.
- Costo por onza.
- Valor del inventario restante.

Ejemplo:

Si existen:

- 8 botellas.
- 25.36 oz por botella.

El inventario total será:

`8 × 25.36 oz = 202.88 oz`

Si cada porción utiliza:

`1.5 oz`

El sistema calculará aproximadamente cuántas porciones pueden prepararse.

## 20.7 Porciones de licor

El administrador podrá configurar diferentes cantidades de servicio.

Ejemplos:

- 1 oz.
- 1.5 oz.
- 2 oz.

Cada producto podrá tener una porción estándar.

Ejemplo:

### Whisky servido

- Whisky: 1.5 oz.

Cuando se registre la venta, el sistema descontará automáticamente:

`1.5 oz`

del stock disponible.

## 20.8 Recetas de cócteles

Cada cóctel tendrá una receta expresada principalmente en onzas.

Ejemplo:

### Mojito

- Ron: 1.5 oz.
- Jarabe: 0.5 oz.
- Jugo de limón: 1 oz.
- Soda: 3 oz.
- Hielo: cantidad configurada.
- Hierbabuena: cantidad configurada.

Ejemplo:

### Chilcano

- Pisco: 2 oz.
- Ginger Ale: 4 oz.
- Jugo de limón: 0.5 oz.
- Amargo de angostura: cantidad configurada.

Cuando el bartender marque el cóctel como preparado, el sistema descontará automáticamente cada ingrediente.

## 20.9 Botellas abiertas y cerradas

El sistema permitirá diferenciar:

- Botellas cerradas.
- Botellas abiertas.
- Botellas terminadas.

Cuando se abra una botella se registrará:

- Producto.
- Fecha.
- Hora.
- Trabajador.
- Turno.
- Contenido inicial en oz.

Cada consumo disminuirá las onzas disponibles.

Ejemplo:

### Botella abierta

- Whisky: 25.36 oz iniciales.
- Consumo: 6 oz.
- Disponible: 19.36 oz.

Cuando el contenido llegue a cero, la botella cambiará automáticamente a estado:

**Terminada**

## 20.10 Mermas, pérdidas y consumos no vendidos

El sistema permitirá registrar movimientos que disminuyen el inventario pero que no corresponden directamente a una venta.

Tipos:

- Derrame.
- Botella rota.
- Producto vencido.
- Error de preparación.
- Cortesía.
- Degustación.
- Consumo interno autorizado.
- Diferencia de inventario.
- Otro.

En licores, la cantidad deberá registrarse en onzas.

Ejemplo:

### Derrame

- Whisky.
- Cantidad: 0.5 oz.
- Motivo: derrame durante preparación.
- Trabajador: usuario responsable.
- Fecha y hora.

Cada merma quedará registrada en el historial.

## 20.11 Control de cortesías

Cuando se entregue una bebida o licor como cortesía, deberá registrarse.

El sistema almacenará:

- Producto.
- Cantidad.
- Cantidad en oz, si corresponde.
- Cliente.
- Habitación.
- Motivo.
- Usuario que autorizó.
- Fecha.
- Hora.

Aunque no exista ingreso económico, el inventario deberá descontarse.

## 20.12 Apertura de bar

Al iniciar un turno, el responsable podrá realizar una apertura de bar.

Se registrará:

- Fecha.
- Hora.
- Trabajador.
- Turno.

También podrá registrarse:

- Botellas cerradas.
- Botellas abiertas.
- Onzas disponibles.
- Bebidas disponibles.
- Insumos principales.

Este registro funcionará como inventario inicial del turno.

## 20.13 Cierre de bar

Al terminar el turno, el sistema realizará un cierre.

Se comparará:

**Stock inicial + ingresos - ventas - mermas - cortesías = stock esperado**

Después se registrará el stock físico real.

El sistema calculará:

**Diferencia = stock real - stock esperado**

El cierre podrá mostrar:

- Stock inicial.
- Compras o reposiciones.
- Ventas.
- Mermas.
- Cortesías.
- Stock esperado.
- Stock físico.
- Diferencia.
- Responsable.
- Observaciones.

En el caso de licores, las diferencias se expresarán en **onzas**.

## 20.14 Conteo físico de licores

El personal autorizado podrá realizar conteos físicos.

Para botellas cerradas se registrará:

- Número de botellas.

Para botellas abiertas se registrará:

- Cantidad estimada o medida en oz.

Ejemplo:

### Whisky

- Botellas cerradas: 4.
- Botella abierta: 12.5 oz.
- Total disponible calculado: 113.94 oz.

El sistema comparará esta cantidad con el stock teórico.

## 20.15 Diferencias de inventario

Cuando exista una diferencia entre el stock teórico y el stock físico, el sistema generará una incidencia.

Se registrará:

- Producto.
- Stock esperado.
- Stock encontrado.
- Diferencia.
- Unidad.
- Trabajador responsable.
- Turno.
- Fecha.
- Motivo.
- Observaciones.

Para licores:

- Stock esperado: 14.5 oz.
- Stock físico: 13 oz.
- Diferencia: -1.5 oz.

## 20.16 Control de stock mínimo

Cada producto tendrá un stock mínimo configurable.

El sistema generará alertas cuando:

- El producto alcance el stock mínimo.
- Esté próximo a agotarse.
- Se agote.
- Existan demasiadas mermas.
- Exista una diferencia recurrente.
- Una botella abierta tenga poco contenido.

En licores, el stock mínimo también podrá expresarse en oz.

## 20.17 Disponibilidad automática del menú

El sistema verificará si existen suficientes insumos para preparar un plato o bebida.

Si falta un ingrediente indispensable, el producto podrá cambiar automáticamente a:

**No disponible**

Ejemplo:

Si un Mojito necesita 1.5 oz de ron y solo quedan 0.8 oz, el sistema podrá impedir nuevos pedidos de Mojito hasta realizar una reposición.

## 20.18 Costos de alimentos y bebidas

El sistema calculará el costo de cada receta.

Para comidas se utilizará el costo proporcional de cada ingrediente.

Para bebidas y licores se utilizará el costo por unidad, mililitro, litro u onza.

Ejemplo:

### Whisky

- Botella: S/ 120.
- Contenido: 25.36 oz.

Costo aproximado:

`S/ 120 ÷ 25.36 oz = S/ 4.73 por oz`

Si una bebida utiliza:

`1.5 oz`

Costo de licor:

`1.5 × S/ 4.73 = S/ 7.10`

El sistema podrá comparar:

- Costo.
- Precio de venta.
- Ganancia.
- Margen de ganancia.

## 20.19 Rentabilidad de platos y bebidas

El sistema podrá mostrar:

- Precio de venta.
- Costo de preparación.
- Ganancia por unidad.
- Margen porcentual.
- Cantidad vendida.
- Ganancia acumulada.

Esto permitirá identificar:

- Platos más rentables.
- Cócteles más rentables.
- Bebidas más vendidas.
- Productos con bajo margen.

## 20.20 Integración con pedidos QR

Los pedidos realizados desde:

- Habitaciones.
- Barra.
- Terraza.

se conectarán automáticamente con cocina y bar.

El flujo será:

**Cliente realiza pedido**
→ **Pedido recibido**
→ **Pedido confirmado**
→ **Cocina o bar acepta el pedido**
→ **En preparación**
→ **Se reservan o descuentan insumos**
→ **Producto preparado**
→ **Inventario actualizado**
→ **Pedido listo**
→ **Entrega**
→ **Pago o cargo a habitación**

## 20.21 Historial de movimientos de inventario

Todo producto contará con un historial.

Cada movimiento registrará:

- Producto.
- Tipo de movimiento.
- Cantidad.
- Unidad.
- Stock anterior.
- Stock nuevo.
- Fecha.
- Hora.
- Usuario.
- Motivo.
- Pedido relacionado, si corresponde.

Tipos de movimientos:

- Compra.
- Ingreso.
- Venta.
- Consumo por receta.
- Merma.
- Cortesía.
- Ajuste.
- Devolución.
- Vencimiento.

## 20.22 Proveedores de alimentos y bebidas

El sistema podrá relacionar cada producto con uno o más proveedores.

Se almacenará:

- Proveedor.
- Producto.
- Precio de compra.
- Presentación.
- Fecha de última compra.
- Tiempo de entrega.
- Historial de precios.

Esto permitirá comparar proveedores y costos.

## 20.23 Alertas de vencimiento

Para productos perecibles se registrarán:

- Fecha de elaboración.
- Fecha de vencimiento.
- Lote.

El sistema podrá priorizar el uso de productos que estén próximos a vencer.

También generará alertas preventivas.

## 20.24 Reportes de cocina y bar

El sistema permitirá generar reportes como:

### Cocina

- Platos más vendidos.
- Ingredientes más utilizados.
- Costos por plato.
- Mermas.
- Productos vencidos.
- Rentabilidad.

### Bebidas

- Bebidas más vendidas.
- Consumo por turno.
- Costos.
- Margen de ganancia.

### Licores

- Onzas vendidas.
- Onzas utilizadas en cócteles.
- Onzas registradas como merma.
- Onzas entregadas como cortesía.
- Botellas abiertas.
- Botellas terminadas.
- Diferencias de inventario.
- Consumo por bartender.
- Consumo por turno.
- Licores más vendidos.
- Rentabilidad por licor.

### Bar

- Ventas por turno.
- Ventas por trabajador.
- Cócteles más vendidos.
- Ingresos del bar.
- Diferencias entre inventario teórico y físico.

## 20.25 Dashboard de cocina y bar

El dashboard podrá mostrar indicadores como:

- Pedidos pendientes.
- Pedidos en preparación.
- Platos vendidos hoy.
- Bebidas vendidas hoy.
- Cócteles vendidos hoy.
- Ingresos de cocina.
- Ingresos de bar.
- Productos con stock bajo.
- Productos próximos a vencer.
- Botellas abiertas.
- Onzas disponibles.
- Mermas del día.
- Diferencias de inventario.

---

# 21. Proveedores

El sistema podrá manejar proveedores de:

- Alimentos.
- Bebidas.
- Productos de limpieza.
- Artículos de mantenimiento.
- Otros productos.

Información registrada:

- Razón social.
- RUC.
- Contacto.
- Teléfono.
- Correo.
- Productos suministrados.
- Historial de compras.

Para cada relación producto-proveedor también se podrá registrar:

- Presentación.
- Capacidad.
- Precio histórico.
- Precio actual.
- Última compra.
- Tiempo promedio de entrega.
- Proveedor principal.
- Proveedor alternativo.

---

# 22. Eventos privados

Se podrá reservar:

- Bar.
- Terraza.
- Otras áreas disponibles.

El sistema permitirá registrar:

- Cliente.
- Tipo de evento.
- Fecha.
- Hora de inicio.
- Hora de finalización.
- Número de asistentes.
- Espacio reservado.
- Servicios solicitados.
- Personal asignado.
- Adelanto.
- Saldo.
- Estado.

## 22.1 Servicios para eventos

Se podrán ofrecer:

- Comida.
- Bebidas.
- Decoración.
- Catering.
- Equipos de sonido.
- Mesas.
- Sillas.
- Otros servicios.

También podrán configurarse paquetes para:

- Cumpleaños.
- Matrimonios.
- Reuniones familiares.
- Reuniones empresariales.
- Celebraciones privadas.

---

# 23. Calendario de eventos

El sistema mostrará un calendario con:

- Fecha.
- Horario.
- Espacio reservado.
- Responsable.
- Cliente.
- Tipo de evento.
- Servicios contratados.
- Estado.

Se evitarán automáticamente reservas duplicadas del mismo espacio y horario.

---

# 24. Administración de personal

Se podrán registrar trabajadores con información como:

- DNI.
- Nombres.
- Apellidos.
- Cargo.
- Área.
- Teléfono.
- Correo.
- Sueldo.
- Estado.

---

# 25. Asistencia del personal

Se podrá utilizar:

- Lector de huella.
- Código QR.

El sistema registrará:

- Hora de entrada.
- Hora de salida.
- Tiempo trabajado.
- Tardanzas.
- Faltas.
- Horas extras.

También podrá calcular el pago correspondiente al trabajador.

---

# 26. Turnos del personal

Se podrán crear horarios para:

- Recepción.
- Limpieza.
- Cocina.
- Bar.
- Mantenimiento.
- Seguridad.
- Administración.

El sistema permitirá administrar:

- Turnos.
- Descansos.
- Permisos.
- Vacaciones.
- Cambios de turno.
- Horas extras.

---

# 27. Roles y permisos

El sistema podrá incluir los siguientes roles:

- Administrador.
- Recepcionista.
- Limpieza.
- Cocina.
- Bar.
- Contabilidad.
- Mantenimiento.
- Seguridad.

Cada rol tendrá permisos específicos.

Ejemplo:

### Administrador

Podrá acceder a todos los módulos.

### Recepcionista

Podrá gestionar:

- Clientes.
- Reservas.
- Check-in.
- Check-out.
- Habitaciones.
- Pagos.

### Limpieza

Podrá acceder únicamente a:

- Habitaciones asignadas.
- Tareas.
- Evidencias.
- Incidencias.

### Cocina

Podrá gestionar:

- Pedidos.
- Menú.
- Inventario relacionado.

---

# 28. Sistema de incidencias

Clientes y trabajadores podrán reportar problemas.

Cada incidencia tendrá:

- Código.
- Tipo.
- Descripción.
- Fecha.
- Prioridad.
- Responsable.
- Evidencia.
- Estado.
- Solución.

Prioridades:

- Baja.
- Media.
- Alta.
- Urgente.

Estados:

- Pendiente.
- Asignada.
- En proceso.
- Resuelta.
- Cerrada.

---

# 29. Notificaciones

El sistema podrá enviar notificaciones mediante:

- WhatsApp.
- Correo electrónico.
- Notificaciones internas.

Ejemplos:

- Confirmación de reserva.
- Pago registrado.
- Recordatorio de llegada.
- Reserva próxima a vencer.
- Aviso de check-out.
- Pedido recibido.
- Pedido listo.
- Habitación pendiente de limpieza.
- Habitación lista.
- Evento próximo.
- Inventario bajo.
- Encuesta de satisfacción.

---

# 30. Seguimiento posterior a la estadía

Entre **24 y 48 horas después del check-out**, se podrá enviar automáticamente una encuesta.

La encuesta podrá solicitar:

- Calificación general.
- Calificación de limpieza.
- Calificación de atención.
- Calificación de habitación.
- Opinión sobre comida.
- Comentarios.
- Incidencias.
- Recomendaciones.

También podrá solicitar autorización para recibir futuras promociones.

---

# 31. Dashboard administrativo

El sistema contará con un panel principal con indicadores en tiempo real.

## Indicadores de habitaciones

- Total de habitaciones.
- Disponibles.
- Ocupadas.
- Reservadas.
- En limpieza.
- En mantenimiento.

## Indicadores financieros

- Ingresos del día.
- Ingresos de la semana.
- Ingresos del mes.
- Pagos pendientes.
- Adelantos recibidos.

## Indicadores operativos

- Check-in del día.
- Check-out del día.
- Reservas próximas.
- Pedidos pendientes.
- Tareas de limpieza.
- Incidencias abiertas.
- Eventos próximos.
- Productos con stock bajo.
- Productos próximos a vencer.
- Botellas abiertas.
- Onzas disponibles de licores.
- Mermas de cocina y bar.
- Diferencias de inventario.
- Aforo actual de piscina.
- Accesos a piscina del día.
- Accesos QR rechazados.

---

# 32. Reportes y estadísticas

El sistema permitirá generar reportes por diferentes períodos.

## 32.1 Reportes de habitaciones

- Ocupación.
- Disponibilidad.
- Categoría más reservada.
- Habitaciones más utilizadas.
- Habitaciones con más incidencias.

## 32.2 Reportes financieros

- Ingresos diarios.
- Ingresos semanales.
- Ingresos mensuales.
- Ingresos anuales.
- Ingresos por servicio.
- Ingresos por método de pago.

## 32.3 Reportes de clientes

- Clientes frecuentes.
- Clientes nuevos.
- Número de estadías.
- Consumo promedio.
- Cancelaciones.

## 32.4 Reportes de cocina, bebidas y bar

- Platos más vendidos.
- Bebidas más vendidas.
- Cócteles más vendidos.
- Horarios de mayor demanda.
- Ingresos por pedidos.
- Ingresos de cocina.
- Ingresos de bar.
- Costo y rentabilidad de platos.
- Costo y rentabilidad de bebidas.
- Rentabilidad de cócteles.
- Consumo de licores en onzas.
- Onzas vendidas.
- Onzas utilizadas en cócteles.
- Onzas registradas como merma.
- Cortesías.
- Botellas abiertas y cerradas.
- Diferencias de inventario.
- Mermas por turno.
- Ventas por bartender.

## 32.5 Reportes de personal

- Horas trabajadas.
- Tardanzas.
- Faltas.
- Horas extras.
- Productividad.

## 32.6 Reportes de eventos

- Cantidad de eventos.
- Ingresos.
- Tipo de evento más solicitado.
- Servicios más contratados.

---

# 33. Auditoría del sistema

Las operaciones importantes deberán quedar registradas.

El historial podrá almacenar:

- Usuario.
- Acción realizada.
- Módulo.
- Fecha.
- Hora.
- Registro afectado.
- Valor anterior.
- Valor nuevo.
- Código y versión del contrato afectado, cuando corresponda.
- Motivo de la modificación.

Esto permitirá identificar quién realizó cada modificación.

También se auditarán acciones como:

- Generación de contratos.
- Reimpresión de contratos.
- Carga de documentos firmados.
- Generación de adendas.
- Modificación de fechas de estadía.
- Aplicación de penalidades.
- Registro de retiro anticipado.
- Accesos permitidos y rechazados mediante QR.
- Aperturas manuales de la valla de piscina.
- Cambios de estado de accesos a zonas recreativas.

---

# 34. Seguridad

El sistema deberá implementar:

- Inicio de sesión seguro.
- Contraseñas cifradas.
- Recuperación de contraseña.
- Roles y permisos.
- Control de sesiones.
- Registro de actividad.
- Copias de seguridad.
- Protección de información personal.
- Control de acceso a contratos y documentos firmados.
- Protección de archivos adjuntos y evidencias.

---

# 35. Copias de seguridad

Se recomienda realizar copias de seguridad periódicas de:

- Clientes.
- Reservas.
- Habitaciones.
- Pagos.
- Pedidos.
- Inventario.
- Personal.
- Eventos.
- Evidencias.

Las copias podrán realizarse diariamente de forma automática.

---

# 36. Orden recomendado de desarrollo

Para desarrollar el sistema de forma progresiva se recomienda utilizar las siguientes etapas.

## Etapa 1 — Base del sistema

1. Usuarios.
2. Roles y permisos.
3. Clientes.
4. Habitaciones.
5. Categorías.
6. Precios.

## Etapa 2 — Operación hotelera

1. Reservas.
2. Pagos de adelanto.
3. Contratos de hospedaje.
4. Impresión y gestión documental.
5. Check-in.
6. Firma y carga de contrato firmado.
7. Check-out.
8. Retiro anticipado y adendas.
9. Cuenta acumulada.
10. Estados de habitación.

## Etapa 3 — Operaciones internas

1. Limpieza.
2. Mantenimiento.
3. Incidencias.
4. Evidencias.

## Etapa 4 — Servicios al huésped

1. Pedidos mediante QR.
2. Restaurante.
3. Bar.
4. Piscina.
5. Mirador.
6. Cochera.
7. Mascotas.
8. Control QR de piscina y zonas recreativas.

## Etapa 5 — Administración

1. Caja.
2. Facturación.
3. Personal.
4. Asistencia.
5. Turnos.
6. Eventos.

## Etapa 6 — Control y análisis

1. Inventario de alimentos.
2. Inventario de bebidas.
3. Control de licores en onzas.
4. Gestión de bar.
5. Proveedores.
6. Dashboard.
7. Reportes.
8. Estadísticas.
9. Encuestas.
10. Programa de fidelización.

---

# 37. Flujo principal del sistema

El flujo general puede funcionar de la siguiente manera:

**Cliente registrado**
→ **Reserva**
→ **Pago del 50 %**
→ **Reserva confirmada**
→ **Generación automática del contrato**
→ **Vista previa / PDF / impresión**
→ **Llegada del cliente**
→ **Verificación de identidad**
→ **Revisión del contrato**
→ **Firma del contrato**
→ **Carga del contrato firmado**
→ **Check-in**
→ **Habitación ocupada**
→ **Consumos y servicios**
→ **Cuenta acumulada**
→ **Posible modificación de estadía / retiro anticipado**
→ **Generación de adenda cuando corresponda**
→ **Check-out**
→ **Liquidación final**
→ **Habitación en limpieza**
→ **Validación de limpieza**
→ **Habitación disponible**
→ **Encuesta de satisfacción**

---

# 38. Objetivo final

El objetivo es convertir el proyecto en un **Sistema Integral de Gestión Hotelera (PMS)** que permita controlar desde una sola plataforma las áreas principales del Hotel Park Plaza.

La solución deberá mejorar:

- La atención al cliente.
- El control de reservas.
- La generación y trazabilidad de contratos de hospedaje.
- La gestión de documentos firmados y adendas.
- La disponibilidad de habitaciones.
- El control financiero.
- La coordinación del personal.
- La gestión de cocina e inventario.
- La gestión de eventos.
- La rapidez de los pedidos.
- El seguimiento de incidencias.
- La toma de decisiones mediante estadísticas y reportes.
