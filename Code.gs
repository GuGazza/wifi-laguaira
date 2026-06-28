/**
 * Code.gs — Backend del Mapa de Puntos WiFi (Google Apps Script)
 * ----------------------------------------------------------------
 * Hoja de cálculo de respaldo del modo colaborativo. El frontend NO llama
 * a este script directamente: lo hace a través del Worker de Cloudflare
 * (ver worker.js), que actúa como proxy mismo-origen para evitar CORS/CORB.
 *
 * REQUISITO — la fila 1 de la hoja de datos (la 1ra pestaña, o una llamada
 * 'Sheet1') debe tener EXACTAMENTE estos encabezados (en cualquier orden):
 *
 *   id | name | lat | lng | access | status | note | ts | confirms
 *
 * DESPLIEGUE — tras cualquier cambio:
 *   Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar
 *   (la URL /exec no cambia, así que no hay que tocar worker.js)
 *
 * NOTIFICACIONES POR EMAIL — configurar en Script Properties:
 *   Apps Script → Configuración del proyecto (⚙️) → Propiedades del script
 *
 *   Propiedad      | Valor de ejemplo
 *   ---------------|-----------------------------------------
 *   NOTIFY_ENABLED | true          (o false para desactivar)
 *   EMAIL_TO       | admin@gmail.com, otro@gmail.com
 *
 * Acceso del Web App: "Ejecutar como: Yo" · "Quién tiene acceso: Cualquier usuario".
 */

const SS    = SpreadsheetApp.getActiveSpreadsheet();
const SHEET = SS.getSheetByName('Sheet1') || SS.getSheets()[0];

/** GET → devuelve todos los puntos como JSON. */
function doGet(e) {
  var filas = SHEET.getDataRange().getValues();
  if (filas.length < 2) return _json([]);
  var cab = filas.shift();
  var puntos = filas.map(function(f){
    var o = {}; cab.forEach(function(c, i){ o[c] = f[i]; }); return o;
  });
  return _json(puntos);
}

/** POST → maneja las acciones "add" (alta de punto) y "confirm" (suma un voto). */
function doPost(e) {
  var datos = JSON.parse(e.postData.contents);
  var cab   = SHEET.getRange(1, 1, 1, SHEET.getLastColumn()).getValues()[0];

  if (datos.action === "add") {
    var fila = cab.map(function(col){ return datos[col] !== undefined ? datos[col] : ""; });
    SHEET.appendRow(fila);
    _notifyEmail(datos);
    return _json({ ok: true });
  }

  if (datos.action === "confirm") {
    var idCol = cab.indexOf("id");
    var cCol  = cab.indexOf("confirms");
    var filas = SHEET.getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      if (filas[i][idCol] === datos.id) {
        SHEET.getRange(i + 1, cCol + 1).setValue((filas[i][cCol] || 0) + 1);
        break;
      }
    }
    return _json({ ok: true });
  }

  if (datos.action === "setStatus") {
    var idC = cab.indexOf("id");
    var stC = cab.indexOf("status");
    var fs  = SHEET.getDataRange().getValues();
    for (var j = 1; j < fs.length; j++) {
      if (fs[j][idC] === datos.id) {
        SHEET.getRange(j + 1, stC + 1).setValue(datos.status);
        // arma un objeto con los datos completos del punto para el email
        var puntoActualizado = {};
        cab.forEach(function(c, i){ puntoActualizado[c] = fs[j][i]; });
        puntoActualizado.status = datos.status; // refleja el nuevo estado
        _notifyEmail(puntoActualizado);
        break;
      }
    }
    return _json({ ok: true });
  }

  return _json({ ok: false, error: "accion desconocida" });
}

/** Helper: respuesta JSON. */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Envía email al registrarse un nuevo punto WiFi o al cambiar su estado.
 * Se activa/desactiva y configura desde Script Properties (sin tocar este código):
 *   NOTIFY_ENABLED = true | false
 *   EMAIL_TO       = destinatarios separados por coma
 */
function _notifyEmail(datos) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("NOTIFY_ENABLED") !== "true") return;
  var to = props.getProperty("EMAIL_TO");
  if (!to) return;

  var acceso = datos.access === "key" ? "Con clave" : "WiFi abierta";
  var estado = datos.status === "down" ? "Sin servicio" : acceso;
  var esNuevo = datos.action === "add";

  try {
    MailApp.sendEmail({
      to:      to,
      subject: esNuevo
        ? "📶 Nuevo punto WiFi: " + (datos.name || "sin nombre")
        : "🔄 Estado actualizado: " + (datos.name || "sin nombre") + " → " + estado,
      body:
        (esNuevo ? "Nuevo punto WiFi reportado en el mapa." : "Un punto WiFi cambió de estado.") + "\n\n" +
        "Nombre   : " + (datos.name || "–") + "\n" +
        "Estado   : " + estado              + "\n" +
        "Nota     : " + (datos.note || "–") + "\n" +
        "Coords   : " + datos.lat + ", " + datos.lng + "\n" +
        "Ver en mapa: https://maps.google.com/?q=" + datos.lat + "," + datos.lng
    });
  } catch(e) {
    Logger.log("Email error: " + e);
  }
}
