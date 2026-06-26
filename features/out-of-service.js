/**
 * features/out-of-service.js — Marcar / reactivar puntos sin servicio
 * Agrega un botón en el globo de cada punto para cambiar su estado entre
 * "active" y "down". Los puntos "down" ya se pintan de gris por el core.
 *
 * Se activa/desactiva con FEATURES.outOfService en index.html.
 *
 * BACKEND: requiere el caso "setStatus" en doPost (ver Code.gs). En modo
 * local funciona sin backend (el core ya persiste "setStatus" en localStorage).
 */
(function(){
  "use strict";

  // Estilo del botón dentro del globo (hereda el layout de .pop .actions).
  const css = document.createElement("style");
  css.textContent = `
    .pop .actions [data-oos]{flex:1;border:1px solid var(--line,#dbe3ec);background:#fff;
      color:var(--down,#8593a3);font-weight:650}
    .pop .actions [data-oos][data-reactivar]{color:var(--open,#1f9d57);border-color:var(--open,#1f9d57)}`;
  document.head.appendChild(css);

  WifiApp.feature({
    name: "outOfService",
    init(app){
      app.on("popup:open", info => {
        const { point, popupEl } = info || {};
        if(!popupEl) return;
        const actions = popupEl.querySelector(".actions");
        if(!actions || actions.querySelector("[data-oos]")) return;   // ya agregado

        const down = point.status === "down";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.oos = "1";
        btn.textContent = down ? "Reactivar" : "Sin servicio";
        if(down) btn.dataset.reactivar = "1";
        actions.appendChild(btn);

        btn.addEventListener("click", async ()=>{
          btn.disabled = true;
          const next = down ? "active" : "down";
          try{
            await app.send("setStatus", { id: point.id, status: next });
            point.status = next;     // point es una referencia viva dentro de app.points
            app.render();            // recolorea el marcador y recalcula el contador
            app.toast(next === "down" ? "Marcado sin servicio." : "Punto reactivado.");
          }catch(e){
            btn.disabled = false;
            app.toast("No se pudo actualizar.");
          }
        });
      });
    }
  });
})();
