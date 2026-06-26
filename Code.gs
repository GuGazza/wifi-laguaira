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
 * Si los nombres no coinciden con los campos que envía el frontend, la
 * acción "add" grabará celdas vacías.
 *
 * DESPLIEGUE — tras cualquier cambio:
 *   Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar
 *   (la URL /exec no cambia, así que no hay que tocar worker.js)
 *
 * Acceso del Web App: "Ejecutar como: Yo" · "Quién tiene acceso: Cualquier usuario".
 */

const SS    = SpreadsheetApp.getActiveSpreadsheet();
const SHEET = SS.getSheetByName('Sheet1') || SS.getSheets()[0];   // 'Sheet1' o, si no existe, la 1ra pestaña

/** GET → devuelve todos los puntos como JSON. */
function doGet(e) {
  var filas = SHEET.getDataRange().getValues();
  if (filas.length < 2) return _json([]);            // hoja vacía o solo encabezado
  var cab = filas.shift();                            // 1ra fila = nombres de columna
  var puntos = filas.map(function(f){
    var o = {}; cab.forEach(function(c, i){ o[c] = f[i]; }); return o;
  });
  return _json(puntos);
}

/** POST → maneja las acciones "add" (alta de punto) y "confirm" (suma un voto). */
function doPost(e) {
  var datos = JSON.parse(e.postData.contents);        // el body llega como text/plain
  var cab   = SHEET.getRange(1, 1, 1, SHEET.getLastColumn()).getValues()[0];

  if (datos.action === "add") {
    var fila = cab.map(function(col){ return datos[col] !== undefined ? datos[col] : ""; });
    SHEET.appendRow(fila);
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

  return _json({ ok: false, error: "accion desconocida" });
}

/** Helper: respuesta JSON. */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
