# Mapa de Puntos WiFi — La Guaira (Emergencia)

## [mapa.wifi-laguaira.workers.dev](https://mapa.wifi-laguaira.workers.dev)

Aplicación web de una sola página para reportar y encontrar puntos con señal WiFi durante situaciones de emergencia. Diseñada para operar sin instalación, desde cualquier navegador móvil, con o sin backend.

## En memoria

> Que viva La Guaira. Siempre en el Corazón, que Dios los tenga en su Gloria.


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
index.html               # Núcleo (core): mapa, formulario y API pública WifiApp
features/                # Módulos opcionales (se activan/desactivan desde index.html)
  nearest.js             #   "WiFi más cercano": vuela al punto activo más próximo
  out-of-service.js      #   Marcar / reactivar puntos sin servicio
worker.js                # Cloudflare Worker: sirve los estáticos y proxea /api → Apps Script
Code.gs                  # Backend de Google Apps Script (lee/escribe en la hoja de cálculo)
wrangler.jsonc           # Configuración de despliegue del Worker (Cloudflare)
.assetsignore            # Excluye worker.js, Code.gs, etc. de servirse como estáticos públicos
```

## Configuración

Dentro de `index.html`, al inicio del `<script>`, se encuentra el bloque `CONFIG`:

```js
const CONFIG = {
  API_URL: "/api",      // "/api" → modo colaborativo vía Worker proxy. Vacío → modo local.
  CENTER: [8.0, -66.0], // Coordenadas del centro inicial del mapa (Venezuela)
  ZOOM: 6               // Nivel de zoom inicial
};
```

| Variable   | Descripción |
|------------|-------------|
| `API_URL`  | `/api` para modo colaborativo (el navegador habla con el Worker, no con Apps Script directo). Vacío para modo local (solo este dispositivo). |
| `CENTER`   | Coordenadas `[lat, lng]` del centro inicial del mapa. |
| `ZOOM`     | Nivel de zoom inicial (0–19). |

> La URL `/exec` del Apps Script **no va en `index.html`**: se configura en la constante `APPS_SCRIPT` de `worker.js`.

## Módulos (features)

Las funcionalidades opcionales viven en la carpeta [`features/`](features/) como módulos independientes. El núcleo no depende de ninguno.

### Habilitar / deshabilitar un módulo

Se controla **únicamente** desde el bloque `FEATURES`, al inicio de `index.html` (dentro del primer `<script>`, junto a `CONFIG`):

```js
const FEATURES = {
  nearest: false,       // true = activado · false = desactivado
  outOfService: false
};
```

- **Deshabilitar:** poné su flag en `false`. El módulo queda inerte (su `<script>` se carga pero no se inicializa) y el comportamiento es idéntico a no tenerlo. **No hay que tocar nada más.**
- **Habilitar:** poné su flag en `true`.
- Después de cambiar un flag hay que **volver a desplegar** (`npx wrangler deploy`) para que tome efecto en producción.

> Estado actual en el repo: **ambos módulos están en `false`** (se despliegan sin activar). Ver [Despliegue seguro y rollback](#despliegue-seguro-y-rollback) para activarlos de forma gradual.

### Cómo funciona

El core expone una API mínima en `window.WifiApp`; los módulos **solo hablan con ella** (no tocan variables internas), lo que evita el acoplamiento:

| Miembro | Para qué |
|---------|----------|
| `app.map` | el mapa Leaflet |
| `app.points` · `app.markers` | datos y marcadores (lectura) |
| `app.render()` · `app.toast(msg)` · `app.send(action, payload)` | acciones del core |
| `app.icon(p)` · `app.popupHtml(p)` · `app.colorFor(p)` | helpers de render |
| `app.on(evento, fn)` | engancharse a eventos del core |
| `app.feature({ name, init })` | registrar el módulo |

**Eventos disponibles:** `points:loaded` (datos: array de puntos) y `popup:open` (datos: `{ point, popupEl, marker }`).

### Crear un módulo nuevo

1. Crear `features/mi-modulo.js`:

   ```js
   (function(){
     "use strict";
     WifiApp.feature({
       name: "miModulo",
       init(app){
         // armá tu UI y tu lógica acá, usando solo `app`
       }
     });
   })();
   ```

2. Agregar su flag en `FEATURES` (`miModulo: true`) y su `<script src="features/mi-modulo.js"></script>` antes de `</body>` en `index.html`.

> **Nota:** se usan `<script>` planos a propósito (no ES Modules), para que `index.html` siga funcionando al abrirlo como archivo local (`file://`), donde los módulos ES fallan por CORS.

### Módulos incluidos

#### `nearest.js` — "WiFi más cercano"

Agrega un botón flotante **"📍 WiFi cercano"** abajo a la izquierda (sobre la leyenda). Al tocarlo:

1. Pide la ubicación del usuario (GPS).
2. El mapa vuela con animación al punto **activo** más cercano y le abre el globo.
3. Muestra la distancia en un toast (ej.: *"WiFi más cercano: a 320 m"*).

Solo considera puntos activos (ignora los marcados sin servicio). Si no hay GPS o no hay puntos activos, avisa con un toast y no rompe nada. Autocontenido, no necesita backend.

#### `out-of-service.js` — marcar / reactivar puntos

No tiene botón propio: actúa **dentro del globo** de cada punto.

- En un punto **activo**, agrega el botón **"Sin servicio"**. Al tocarlo, el marcador pasa a **gris**, el contador de "activos" baja y el globo muestra el tag *"Sin servicio"*.
- En un punto **caído**, agrega el botón **"Reactivar"** (verde) y **oculta "Funciona"** (confirmar un caído no tiene sentido). Al reactivarlo vuelve a su color y suma al contador.

Requiere el caso `setStatus` en `doPost` (ya incluido en `Code.gs`); en modo local funciona sin backend.

## Uso

### Modo local (sin backend)

1. Abrir `index.html` directamente en el navegador.
2. Dejar `API_URL` vacío en el bloque `CONFIG`.
3. Los puntos reportados se guardan en `localStorage` y solo son visibles en ese dispositivo.

### Modo colaborativo (con backend)

El frontend no llama a Apps Script directamente: lo hace a través de un **Worker de Cloudflare** (`worker.js`) que actúa como proxy del mismo origen bajo la ruta `/api`. Esto evita los errores de CORS/CORB del navegador (causados por el redirect 302 de Apps Script) y permite leer la respuesta del servidor para detectar errores de escritura.

```
index.html  ──fetch("/api")──▶  worker.js  ──fetch()──▶  Code.gs (Apps Script)  ──▶  Google Sheet
  (navegador, mismo origen)      (Cloudflare, servidor)        (doGet / doPost)
```

1. Crear un **Google Apps Script** con el contenido de [`Code.gs`](Code.gs), vinculado a una hoja `Sheet1` con los encabezados requeridos (ver [Administración del backend](#administración-del-backend-google-spreadsheet--apps-script)).
2. Desplegarlo como aplicación web — **Ejecutar como: Yo** · **Quién tiene acceso: Cualquier usuario** — y copiar la URL `/exec`.
3. Pegar esa URL en la constante `APPS_SCRIPT` de `worker.js`.
4. Dejar `API_URL: "/api"` en `index.html`.
5. Desplegar (ver sección siguiente).

### Despliegue en Cloudflare Workers

El proyecto se despliega como un **Worker con archivos estáticos**: `wrangler.jsonc` define `main: worker.js` y el binding `assets`. Publicar con Wrangler CLI:

```bash
npx wrangler deploy
```

El Worker sirve `index.html` y los demás estáticos, y atiende la ruta `/api` como proxy hacia Apps Script. Tras cambiar la URL del Apps Script se edita `worker.js` (no `index.html`) y se vuelve a desplegar.

### Despliegue seguro y rollback

Como el sitio está **online**, conviene validar cada cambio antes de activarlo en producción. De menos a más seguro:

**1. Previsualizar sin afectar producción** *(recomendado)* — sube una versión nueva y devuelve una URL de preview, sin activarla:

```bash
npx wrangler versions upload      # imprime una URL de preview para probar
npx wrangler versions deploy      # recién acá la promovés a producción
```

**2. Correrlo local** — levanta el Worker + estáticos en tu máquina:

```bash
npx wrangler dev                  # abrí http://localhost:8787 y revisá la consola
```

Las lecturas pegan al Apps Script real (seguras); una escritura de prueba agrega una fila que después borrás.

**3. Chequeo de sintaxis de los módulos** antes de subir:

```bash
node --check features/nearest.js
node --check features/out-of-service.js
```

**Red de seguridad — rollback.** Cloudflare guarda el historial de versiones. Si algo se ve mal después de publicar, revertís en segundos:

```bash
npx wrangler rollback
```

(o desde el dashboard → Workers → tu Worker → **Deployments → Rollback**).

> **Activar módulos nuevos de forma gradual:** subí primero con los flags de `FEATURES` en `false` (sin cambios de comportamiento), validá que el core y el proxy funcionan, y en un segundo deploy activá un módulo por vez poniendo su flag en `true`. Así aislás cualquier problema a un solo cambio.

## Leyenda del mapa

| Color   | Significado       |
|---------|-------------------|
| Verde   | WiFi abierta (sin clave) |
| Naranja | WiFi con clave    |
| Gris    | Sin servicio      |

## Administración del backend (Google Spreadsheet + Apps Script)

El código del backend está en [`Code.gs`](Code.gs). Almacena cada punto reportado como una fila en una hoja de cálculo de Google Sheets (`Sheet1`).

**Encabezados requeridos** — la fila 1 de `Sheet1` debe tener exactamente estos nombres (en cualquier orden); el alta de puntos mapea por nombre de columna:

```
id   name   lat   lng   access   status   note   ts   confirms
```

Si los nombres no coinciden con los campos que envía el frontend, el alta grabará celdas vacías.

### Eliminar o limpiar registros

Hay dos formas de eliminar puntos.

### Opción A — Eliminar filas manualmente desde Google Sheets

Es la forma más directa y no requiere tocar el código del Apps Script.

1. Abrir la **Google Spreadsheet** vinculada al Apps Script.
2. Localizar la fila del punto a eliminar (las columnas habituales son `id`, `name`, `lat`, `lng`, `access`, `status`, `note`, `ts`, `confirms`).
3. Hacer clic derecho sobre el número de fila → **Eliminar fila**.
4. El punto desaparecerá del mapa en el próximo refresco automático (30 segundos) o al recargar la página.

Para eliminar todos los puntos a la vez: seleccionar todas las filas de datos (sin el encabezado) → clic derecho → **Eliminar filas**.

### Opción B — Agregar una acción `remove` al Apps Script

Permite eliminar puntos desde una llamada programática (útil para integrar un panel de administración o scripts de mantenimiento).

Agregar el siguiente bloque dentro de la función `doPost` de [`Code.gs`](Code.gs), junto a los casos `add` y `confirm` (reutiliza las variables `datos`, `cab`, `SHEET` y el helper `_json` ya definidos en ese archivo):

```javascript
if (datos.action === "remove") {
  var idCol = cab.indexOf("id");
  var filas = SHEET.getDataRange().getValues();
  for (var i = filas.length - 1; i >= 1; i--) {   // de abajo hacia arriba al borrar filas
    if (filas[i][idCol] === datos.id) {
      SHEET.deleteRow(i + 1);                       // getDataRange es 0-based; deleteRow es 1-based
      break;
    }
  }
  return _json({ ok: true });
}
```

#### Llamar a la acción `remove` desde el navegador o un script

A través del Worker proxy (mismo origen que el mapa):

```bash
curl -X POST "https://mapa.wifi-laguaira.workers.dev/api" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"remove","id":"p_1234567890_abc12"}'
```

O desde JavaScript en el frontend:

```js
await fetch(CONFIG.API_URL, {                        // CONFIG.API_URL === "/api"
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
- Google Apps Script + Google Sheets — backend del modo colaborativo (ver `Code.gs`)
- Cloudflare Workers — hosting de los estáticos y proxy mismo-origen `/api` (ver `worker.js`)

## Consideraciones operativas

- La app no requiere instalación ni servidor propio: un solo archivo HTML es suficiente para el modo local.
- En el modo colaborativo, el navegador solo habla con el Worker (`/api`, mismo origen); el Worker llama a Apps Script del lado servidor. Esto evita los errores de CORS/CORB que aparecen al llamar a Apps Script directamente desde el navegador.
- Starlink y otros sistemas satelitales requieren cielo despejado; recomendable indicarlo en la nota del punto reportado.
- El modo local persiste datos en `localStorage` bajo la clave `starlink_points_v1`.

## Diagnóstico del backend (troubleshooting)

Dos pruebas con `curl` para verificar el Apps Script **directamente** (sin pasar por el Worker), útiles para aislar si un fallo está en el backend o en el frontend. Reemplazá `<URL_EXEC>` por la URL `/exec` real del Apps Script (la misma que está en la constante `APPS_SCRIPT` de `worker.js`).

### Prueba 1 — Escribir un punto (POST `add`)

```bash
curl -L -X POST "<URL_EXEC>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"add","id":"test1","name":"Prueba","lat":10.6,"lng":-66.9,"access":"open","status":"active","note":"","ts":1700000000000,"confirms":0}'
```

El `doPost` se ejecuta y graba la fila en el **primer salto**, antes del redirect. Por eso, aunque esta respuesta muestre un error `411 Length Required`, **la fila igual se escribió**: el `411` es un artefacto de `curl -L` reenviando el POST con `Transfer-Encoding: chunked` al destino del redirect 302 de Apps Script (Google exige `Content-Length`). No es un error del backend, y **no ocurre a través del Worker**, que sigue el redirect correctamente del lado servidor.

### Prueba 2 — Leer los puntos (GET) y confirmar la escritura

```bash
curl -sSL "<URL_EXEC>"
```

El GET también redirige, pero `curl -L` lo sigue limpio (sin body, sin `411`). Si en el JSON de respuesta aparece el punto recién escrito, el backend funciona de punta a punta:

```json
[{"id":"test1","name":"Prueba","lat":10.6,"lng":-66.9,"access":"open","status":"active","note":"","ts":1700000000000,"confirms":0}]
```

### Cómo interpretar los resultados

| Respuesta | Significado |
|-----------|-------------|
| HTML "El archivo que solicitaste no existe" | La URL `/exec` está mal (¿pegaste un placeholder en vez de la URL completa?). |
| `TypeError: Cannot read properties of null (reading 'getRange')` | `getSheetByName(...)` devolvió `null`: el nombre de la pestaña no coincide. `Code.gs` ya cae a la 1ra pestaña con `getSheets()[0]`. |
| `411 Length Required` en la Prueba 1 | Ruido de `curl -L` con el redirect; la fila se escribió igual. Confirmalo con la Prueba 2. |
| La Prueba 2 lista el punto | Backend OK de punta a punta. |
| El punto aparece con campos vacíos | Los encabezados de la fila 1 de la hoja no coinciden con los campos del frontend. |

> Para probar el camino real de producción (navegador → Worker → Apps Script), usá `https://mapa.wifi-laguaira.workers.dev/api` en lugar de `<URL_EXEC>`: el GET devuelve el JSON de puntos y el POST responde `{"ok":true}` de forma legible.

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

---
