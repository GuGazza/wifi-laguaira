/**
 * features/nearest.js — "WiFi más cercano"
 * Agrega un botón flotante que vuela al punto ACTIVO más próximo a la
 * ubicación del usuario (GPS) y muestra la distancia.
 *
 * Se activa/desactiva con FEATURES.nearest en index.html. Es autocontenido:
 * arma su propio botón y CSS, y solo usa la API pública `WifiApp`.
 */
(function(){
  "use strict";

  // Distancia en metros entre dos coordenadas (Haversine).
  function distM(a, b){
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const s = Math.sin(dLat/2)**2 +
              Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const fmt = m => m < 1000 ? Math.round(m) + " m" : (m/1000).toFixed(1) + " km";

  WifiApp.feature({
    name: "nearest",
    init(app){
      // Estilo propio del módulo (no toca el CSS del core).
      const css = document.createElement("style");
      css.textContent = `
        .near-btn{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom) + 150px);
          z-index:850;border:none;cursor:pointer;background:#fff;color:var(--signal-ink,#06727f);
          font-weight:650;font-size:13px;padding:10px 14px;border-radius:999px;
          box-shadow:var(--shadow,0 6px 24px rgba(15,27,45,.16));display:flex;align-items:center;gap:6px}
        .near-btn:active{transform:scale(.96)}`;
      document.head.appendChild(css);

      const btn = document.createElement("button");
      btn.className = "near-btn";
      btn.innerHTML = "📍 WiFi cercano";
      btn.setAttribute("aria-label", "Buscar el WiFi más cercano");
      document.body.appendChild(btn);

      btn.addEventListener("click", ()=>{
        if(!navigator.geolocation){ app.toast("Tu equipo no permite ubicación."); return; }
        app.toast("Buscando el más cercano…");
        navigator.geolocation.getCurrentPosition(
          pos => {
            const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            let best = null, bestD = Infinity;
            app.points.forEach(p => {
              if(p.status === "down") return;          // solo puntos activos
              const d = distM(from, p);
              if(d < bestD){ bestD = d; best = p; }
            });
            if(!best){ app.toast("Todavía no hay puntos activos."); return; }
            app.map.flyTo([best.lat, best.lng], 17);
            const m = app.markers[best.id];
            if(m) m.openPopup();
            app.toast("WiFi más cercano: a " + fmt(bestD));
          },
          ()=> app.toast("No pudimos obtener tu ubicación."),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
  });
})();
