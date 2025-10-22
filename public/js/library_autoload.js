
(function(){
  if (window.__libraryAutoInstalled) return;
  window.__libraryAutoInstalled = true;

  function enc(p){ return p.split('/').map(encodeURIComponent).join('/'); }
  function loadSDK(){
    return new Promise((resolve, reject) => {
      if (window.supabase) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@supabase/supabase-js@2.42.3/dist/umd/supabase.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  async function render(){
    try{
      await loadSDK();
      if (!window.supabase) { console.warn('[5DIO] supabase sdk still missing'); return; }
      const url=window.SUPABASE_URL, key=window.SUPABASE_KEY, bucket=window.SUPABASE_BUCKET||'media';
      if(!url||!key){ console.warn('[5DIO] config missing'); return; }
      const sb = window.sb || (window.sb = window.supabase.createClient(url, key));
      const base=(window.SUPABASE_PUBLIC_BASE || (url.replace(/\/+$/,'')+'/storage/v1/object/public/'+bucket)).replace(/\/+$/,'');

      let grid=document.getElementById('grid');
      if(!grid){ grid=document.createElement('div'); grid.id='grid'; grid.style.margin='16px'; document.body.appendChild(grid); }
      grid.innerHTML='';

      const { data: root } = await sb.storage.from(bucket).list('', { limit: 1000, sortBy:{ column:'name', order:'asc' } });
      const cats=(root||[]).filter(it=>!/\./.test(it.name)).map(it=>it.name);

      for(const cat of cats){
        const { data: items } = await sb.storage.from(bucket).list(cat, { limit: 1000, sortBy:{ column:'name', order:'asc' } });
        const names=(items||[]).map(it=>it.name);
        const tracks=names.filter(n=>/(\.mp3|\.wav|\.ogg|\.m4a|\.flac|\.aac)$/i.test(n));
        const folderThumb=names.find(n=>n.toLowerCase()==='folder.png') ? `${base}/${enc(`${cat}/folder.png`)}` : '';
        grid.insertAdjacentHTML('beforeend', `<div style="margin:18px 0 8px;font-weight:700;color:#ddd;border-top:1px solid #222;padding-top:12px">${cat}</div>`);
        for(const audioName of tracks){
          const baseName=audioName.replace(/\.[^.]+$/,'');
          const thumbFile=names.find(n=>n.toLowerCase()===(baseName+'.png').toLowerCase())||names.find(n=>n.toLowerCase()===(baseName+'.jpg').toLowerCase())||null;
          const thumbUrl=thumbFile?`${base}/${enc(`${cat}/${thumbFile}`)}`:folderThumb;
          const audioUrl=`${base}/${enc(`${cat}/${audioName}`)}`;
          grid.insertAdjacentHTML('beforeend', `
            <div style="display:inline-block;width:180px;margin:8px;text-align:center;vertical-align:top">
              <img src="${thumbUrl}" alt="" style="width:160px;height:160px;object-fit:cover;border-radius:10px;background:#111"/>
              <div style="margin-top:6px;color:#ccc;font-size:12px;word-break:break-word">${baseName}</div>
              <audio controls preload="none" src="${audioUrl}" style="width:160px;margin-top:6px"></audio>
            </div>`);
        }
      }
    }catch(err){ console.error('[5DIO] library error:', err); }
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', render, { once:true }); }
  else { render(); }
})();
