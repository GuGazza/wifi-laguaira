// Cloudflare Worker: sirve los archivos estáticos y hace de proxy mismo-origen
// hacia el backend de Google Apps Script. Así el navegador nunca habla con
// Apps Script directo (evita CORS / CORB / redirect 302), y la respuesta vuelve
// legible para poder detectar errores de escritura.

const APPS_SCRIPT =
  "https://script.google.com/macros/s/AKfycbzx36igENhcd6v-FQPGU1YnW0dupb7J91akR7wgo-lRoW-q9Y2gA9lkHABNq-1glJEqWg/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api  ->  proxy hacia Apps Script (lectura GET y escritura POST)
    if (url.pathname === "/api") {
      const init = {
        method: request.method,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow", // sigue el 302 de Apps Script del lado servidor
      };
      if (request.method === "POST") {
        init.body = await request.text();
      }
      try {
        const upstream = await fetch(APPS_SCRIPT + url.search, init);
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": "application/json;charset=utf-8" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json;charset=utf-8" },
        });
      }
    }

    // resto -> archivos estáticos (index.html, etc.)
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html")) return response;

    // El HTML nunca debe servirse desde caché sin validar: así los deploys
    // son visibles de inmediato sin que el usuario tenga que limpiar caché.
    // no-cache = revalidar con el servidor (304 si no cambió, sin costo de red).
    const fresh = new Response(response.body, response);
    fresh.headers.set("Cache-Control", "no-cache");
    return fresh;
  },
};
