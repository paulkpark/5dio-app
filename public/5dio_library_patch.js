
/**
 * 5DIO – Supabase Media Library Drop‑in (non-invasive)
 */
(function(){
  if (window.__libraryPatchInstalled) return;
  window.__libraryPatchInstalled = true;

  function enc(p){ return p.split('/').map(encodeURIComponent).join('/'); }

  async function render(){
    try{
      if (!window.supabase){ console.warn("[5DIO] Supabase SDK missing."); return; }
      const url = window.SUPABASE_URL, key = window.SUPABASE_KEY;
      const bucket = window.SUPABASE_BUCKET || "media";
      if (!url || !key){ console.warn("[5DIO] Supabase config missing."); return; }
      const sb   = (window.sb) || (window.sb = window.supabase.createClient(url, key));
      const base = (window.SUPABASE_PUBLIC_BASE || (url.replace(/\/+$/,'') + "/storage/v1/object/public/" + bucket)).replace(/\/+$/,'');

      // Ensure a grid exists
      let grid = document.getElementById("grid");
      if (!grid){
        grid = document.createElement("div");
        grid.id = "grid";
        grid.style.marginTop = "12px";
        document.body.appendChild(grid);
      }
      grid.innerHTML = "";

      // 1) List root to find top-level categories (folders only)
      const { data: root, error: eRoot } = await sb.storage.from(bucket).list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
      if (eRoot){ console.warn("[5DIO] list root error:", eRoot); return; }
      const categories = (root || []).filter(it => !/\./.test(it.name)).map(it => it.name);

      for (const cat of categories){
        const { data: items, error: eCat } = await sb.storage.from(bucket).list(cat, { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (eCat){ console.warn("[5DIO] list", cat, "error:", eCat); continue; }

        const names = (items || []).map(it => it.name);
        const tracks = names.filter(n => /(\.mp3|\.wav|\.ogg|\.m4a|\.flac|\.aac)$/i.test(n));

        // Category header
        grid.insertAdjacentHTML("beforeend",
          `<div style="margin:18px 0 8px;font-weight:700;color:#ddd;border-top:1px solid #222;padding-top:12px">${cat}</div>`
        );

        // Category-level fallback thumbnail (folder.png)
        const folderThumb = names.find(n => n.toLowerCase() === "folder.png")
          ? `${base}/${enc(`${cat}/folder.png`)}` : "";

        // Render each track
        for (const audioName of tracks){
          const baseName = audioName.replace(/\.[^.]+$/,"");
          const thumbFile =
            names.find(n => n.toLowerCase() === (baseName + ".png").toLowerCase()) ||
            names.find(n => n.toLowerCase() === (baseName + ".jpg").toLowerCase()) ||
            null;
          const thumbUrl = thumbFile ? `${base}/${enc(`${cat}/${thumbFile}`)}` : folderThumb;
          const audioUrl = `${base}/${enc(`${cat}/${audioName}`)}`;

          grid.insertAdjacentHTML("beforeend",
            `<div style="display:inline-block;width:180px;margin:8px;text-align:center;vertical-align:top">
              <img src="${thumbUrl}" alt="" style="width:160px;height:160px;object-fit:cover;border-radius:10px;background:#111"/>
              <div style="margin-top:6px;color:#ccc;font-size:12px;word-break:break-word">${baseName}</div>
              <audio controls preload="none" src="${audioUrl}" style="width:160px;margin-top:6px"></audio>
            </div>`
          );
        }
      }
    }catch(err){
      console.error("[5DIO] library patch error:", err);
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
