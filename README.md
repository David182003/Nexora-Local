# System Cochera — Control de alquileres diarios

Aplicación web responsive construida con HTML, CSS, JavaScript modular y Firebase Authentication + Cloud Firestore.

## Funcionalidades

- Registro e inicio de sesión con correo y contraseña.
- Registro de clientes con nombre, descripción del vehículo, tarifa diaria, fecha de inicio y fecha de finalización opcional.
- Panel visual con clientes activos, cobros del mes, deuda total y días pagados del mes.
- Estado de cuenta individual para cada cliente.
- Cálculo de deuda: días desde el inicio hasta hoy (o hasta la fecha de finalización, inclusive, si ya terminó) que no estén pagados × tarifa diaria.
- Alquileres sin fecha final continúan acumulando días; los alquileres con fecha final dejan de generar deuda después de esa fecha.
- Los alquileres finalizados siguen apareciendo en el panel si conservan una deuda pendiente.
- Calendario mensual: verde = pagado; rojo = pendiente vencido (incluye el día actual); gris = futuro o anterior al inicio del alquiler.
- Selección de varios días pendientes o futuros para registrar un pago o adelanto.
- Cálculo automático del total del pago.
- Historial de cobros con fecha, días cubiertos, medio de pago y observación.
- Diseño adaptable a escritorio, tablet y móvil.

## Configuración Firebase

Este ZIP ya contiene la configuración web que estaba en el proyecto recibido (`system-cochera`). Si ese es tu proyecto, no necesitas reemplazar el bloque `firebaseConfig` de `app.js`.

Si usas otro proyecto:
1. Firebase Console > Configuración del proyecto > Tus aplicaciones > aplicación web.
2. Copia el objeto `firebaseConfig` y reemplaza el objeto del inicio de `app.js`.
3. Authentication > Proveedores de acceso: habilita Correo electrónico/Contraseña.
4. Firestore Database > Reglas: publica el contenido de `firestore.rules`.

## Ejecución local

1. Descomprime el ZIP.
2. Abre la carpeta `control-cocheras` en Visual Studio Code.
3. Instala/activa la extensión **Live Server**.
4. Clic derecho en `index.html` > **Open with Live Server**.
5. Crea tu usuario desde «¿No tienes cuenta? Crear cuenta» o inicia sesión.

No abras `index.html` directamente con `file://`; los módulos de Firebase necesitan un servidor local.

## Cómo se calcula la deuda

Para cada cliente:

`Deuda actual = cantidad de días no pagados desde la fecha de inicio hasta hoy × tarifa diaria`

Los días futuros no generan deuda. Si se seleccionan y pagan por adelantado, quedan cubiertos y se muestran en verde cuando llegue su fecha. Si el cliente tiene fecha de finalización, no se pueden seleccionar fechas posteriores a ella y el último día del alquiler sí se considera facturable. El sistema impide registrar nuevamente fechas que ya aparecen pagadas.

**Importante:** en esta versión, el día actual se considera pendiente si aún no se ha registrado su pago. Si tu negocio cobra al final del día y quieres que el día actual recién venza mañana, se puede ajustar esa regla.

## Estructura de datos

### clients
`uid`, `name`, `vehicle`, `dailyRate`, `startDate`, `endDate` (opcional; `null` si no se define), `notes`, `active`, `createdAt`.

### payments
`uid`, `clientId`, `clientName`, `days`, `amount`, `dailyRate`, `paymentDate`, `method`, `note`, `createdAt`.

Cada pago guarda la tarifa diaria aplicada en ese momento, para conservar el importe histórico aunque se modifique la tarifa del cliente en una versión futura.

## Seguridad y limitaciones

- Las reglas aíslan los documentos por UID del usuario autenticado.
- No se incluyen claves privadas ni credenciales de cuenta de servicio. La configuración web de Firebase es visible en el navegador por diseño; la protección depende de Authentication y las reglas de Firestore.
- Esta versión está pensada para un propietario/administrador. La validación de fechas duplicadas se realiza antes de guardar. Si varios cobradores registran pagos simultáneamente, se recomienda trasladar el proceso a una Cloud Function transaccional.
- No incluye todavía edición/eliminación de clientes, modificación de tarifas ni exportación de reportes.
