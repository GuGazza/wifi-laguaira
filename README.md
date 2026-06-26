# Mapa de Puntos WiFi — La Guaira (Emergencia)

## [mapa.wifi-laguaira.workers.dev](https://mapa.wifi-laguaira.workers.dev)

Aplicación web de una sola página para reportar y encontrar puntos con señal WiFi durante situaciones de emergencia. Diseñada para operar sin instalación, desde cualquier navegador móvil, con o sin backend.

## ¿Qué hace?

- Muestra un mapa interactivo (Leaflet + OpenStreetMap) con los puntos de conectividad reportados.
- Permite reportar un nuevo punto indicando ubicación (clic en el mapa o GPS), nombre/referencia y tipo de acceso (WiFi abierta o con clave).
- Permite confirmar que un punto sigue funcionando.
- Ofrece enlace directo a "Cómo llegar" vía OpenStreetMap Directions.
- Funciona en dos modos configurables:
  - **Modo local** — los datos se guardan en `localStorage` del propio dispositivo. Útil para probar sin backend.
  - **Modo colaborativo** — sincroniza con un backend (Google Apps Script) para que todos los usuarios vean los mismos puntos en tiempo real, con refresco automático cada 30 segundos.

## Estructura del proyecto

```
index.html      # Toda la aplicación (HTML + CSS + JS, sin dependencias locales)
wrangler.jsonc  # Configuración para despliegue en Cloudflare Pages/Workers
```

## Configuración

Dentro de `index.html`, al inicio del `<script>`, se encuentra el bloque `CONFIG`:

```js
const CONFIG = {
  API_URL: "",          // Vacío → modo local. URL del Apps Script → modo colaborativo.
  CENTER: [8.0, -66.0], // Coordenadas del centro inicial del mapa (Venezuela)
  ZOOM: 6               // Nivel de zoom inicial
};
```

| Variable   | Descripción |
|------------|-------------|
| `API_URL`  | URL `/exec` del Google Apps Script. Si está vacío, la app corre en modo local. |
| `CENTER`   | Coordenadas `[lat, lng]` del centro inicial del mapa. |
| `ZOOM`     | Nivel de zoom inicial (0–19). |

## Uso

### Modo local (sin backend)

1. Abrir `index.html` directamente en el navegador.
2. Dejar `API_URL` vacío en el bloque `CONFIG`.
3. Los puntos reportados se guardan en `localStorage` y solo son visibles en ese dispositivo.

### Modo colaborativo (con backend)

1. Crear un **Google Apps Script** que exponga un endpoint `doGet` / `doPost` con los métodos `add` y `confirm`.
2. Desplegar el script como aplicación web y copiar la URL `/exec`.
3. Pegar esa URL en `API_URL` dentro de `index.html`.
4. Desplegar la app (ver sección siguiente).

### Despliegue en Cloudflare Pages

El proyecto incluye `wrangler.jsonc` para publicar con Wrangler CLI:

```bash
npx wrangler pages deploy .
```

O configurar el repositorio en **Cloudflare Pages** apuntando al directorio raíz; el archivo `index.html` se sirve automáticamente como página principal.

## Leyenda del mapa

| Color   | Significado       |
|---------|-------------------|
| Verde   | WiFi abierta (sin clave) |
| Naranja | WiFi con clave    |
| Gris    | Sin servicio      |

## Administración del backend (Google Spreadsheet + Apps Script)

El backend almacena cada punto reportado como una fila en una hoja de cálculo de Google Sheets. Hay dos formas de eliminar o limpiar registros.

### Opción A — Eliminar filas manualmente desde Google Sheets

Es la forma más directa y no requiere tocar el código del Apps Script.

1. Abrir la **Google Spreadsheet** vinculada al Apps Script.
2. Localizar la fila del punto a eliminar (las columnas habituales son `id`, `name`, `lat`, `lng`, `access`, `status`, `note`, `ts`, `confirms`).
3. Hacer clic derecho sobre el número de fila → **Eliminar fila**.
4. El punto desaparecerá del mapa en el próximo refresco automático (30 segundos) o al recargar la página.

Para eliminar todos los puntos a la vez: seleccionar todas las filas de datos (sin el encabezado) → clic derecho → **Eliminar filas**.

### Opción B — Agregar una acción `remove` al Apps Script

Permite eliminar puntos desde una llamada programática (útil para integrar un panel de administración o scripts de mantenimiento).

Agregar el siguiente bloque dentro de la función `doPost` del Apps Script, junto a los casos `add` y `confirm`:

```javascript
if (action === "remove") {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data  = sheet.getDataRange().getValues();
  // La fila 0 es el encabezado; buscar desde la fila 1
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === payload.id) {   // columna 0 = campo "id"
      sheet.deleteRow(i + 1);          // getDataRange es 0-based; deleteRow es 1-based
      break;
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> **Nota:** ajustar el índice de columna (`data[i][0]`) si el campo `id` no está en la primera columna de la hoja.

#### Llamar a la acción `remove` desde el navegador o un script

```bash
curl -L -X POST "https://script.google.com/macros/s/<ID>/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"remove","id":"p_1234567890_abc12"}'
```

O desde JavaScript en el frontend:

```js
await fetch(CONFIG.API_URL, {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({ action: "remove", id: "p_1234567890_abc12" })
});
```

El `id` de cada punto está visible en la columna `id` de la hoja de cálculo, o puede copiarse desde las herramientas de desarrollo del navegador inspeccionando la respuesta de `doGet`.

### Marcar un punto como "sin servicio" sin eliminarlo

Si se prefiere conservar el historial pero ocultar visualmente un punto, se puede cambiar el valor de la columna `status` de `active` a `down` directamente en la hoja. El punto aparecerá en gris en el mapa en lugar de desaparecer por completo.

## Tecnologías

- [Leaflet 1.9.4](https://leafletjs.com/) — mapa interactivo (cargado desde CDN, sin instalación)
- [OpenStreetMap](https://www.openstreetmap.org/) — tiles del mapa y direcciones
- Google Apps Script + Google Sheets — backend opcional para el modo colaborativo
- Cloudflare Pages / Workers — hosting estático

## Consideraciones operativas

- La app no requiere instalación ni servidor propio: un solo archivo HTML es suficiente para el modo local.
- Para el modo colaborativo, el backend de Google Apps Script debe aceptar peticiones `POST` con `Content-Type: text/plain` (requerido para evitar el preflight CORS de Apps Script).
- Starlink y otros sistemas satelitales requieren cielo despejado; recomendable indicarlo en la nota del punto reportado.
- El modo local persiste datos en `localStorage` bajo la clave `starlink_points_v1`.

## Contribuciones y forks

Este proyecto nació como respuesta a una emergencia y es intencionalmente simple: un solo archivo HTML, sin dependencias locales, para que cualquiera pueda levantarlo en minutos.

Si querés mejorarlo, adaptarlo a tu ciudad o agregar funcionalidades, **hacé un fork y construí tu versión**. Algunas ideas que pueden sumarle valor:

- Panel de administración para moderar puntos desde el navegador.
- Filtros por tipo de acceso (abierta / con clave).
- Soporte para adjuntar fotos del lugar.
- Versión PWA instalable con notificaciones de nuevos puntos.
- Adaptación del backend a Supabase, Firebase u otro servicio gratuito.

Toda mejora que quieras compartir es bienvenida vía pull request.

**Gracias a quienes reportaron puntos, confirmaron señal y compartieron el mapa durante la emergencia.** Cada dato cargado fue conectividad real para alguien que la necesitaba.
