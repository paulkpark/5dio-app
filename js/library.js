
(function(){
  function enc(p){ return p.split('/').map(encodeURIComponent).join('/'); }
  async function render(){
    try{
      if (!window.supabase) { console.warn("[5DIO] supabase sdk missing"); return; }
      const url=window.SUPABASE_URL, key=window.SUPABASE_KEY, bucket=window.SUPABASE_BUCKET||'media';
      if(!url||!key){ console.warn("[5DIO] config missing"); return; }
      const sb = window.sb || (window.sb = window.supabase.createClient(url, key));
      const base=(window.SUPABASE_PUBLIC_BASE || (url.replace(/\/+$/,'')+'/storage/v1/object/public/'+bucket)).replace(/\/+$/,'');

      let grid=document.getElementById('grid');
      if(!grid){ grid=document.createElement('div'); grid.id='grid'; grid.style.margin='16px'; document.body.appendChild(grid); }
      grid.innerHTML='';

      const { data: root, error: eRoot } = await sb.storage.from(bucket).list('', { limit: 1000, sortBy:{ column:'name', order:'asc' } });
      if(eRoot){ console.warn(eRoot); return; }

      const cats = (root||[]).filter(it=>!/\./.test(it.name)).map(it=>it.name);
      for(const cat of cats){
        const { data: items, error: eCat } = await sb.storage.from(bucket).list(cat, { limit: 1000, sortBy:{ column:'name', order:'asc' } });
        if(eCat){ console.warn(cat, eCat); continue; }
        const names = (items||[]).map(it=>it.name);
        const tracks = names.filter(n=>/(\.mp3|\.wav|\.ogg|\.m4a|\.flac|\.aac)$/i.test(n));
        const folderThumb = names.find(n=>n.toLowerCase()==='folder.png') ? `${base}/${enc(`${cat}/folder.png`)}` : '';

        const header = document.createElement('div');
        header.className = 'cat-header';
        header.textContent = cat;
        grid.appendChild(header);

        for(const audioName of tracks){
          const baseName = audioName.replace(/\.[^.]+$/,'');
          const thumbFile = names.find(n=>n.toLowerCase()===(baseName + '.png').toLowerCase()) ||
                            names.find(n=>n.toLowerCase()===(baseName + '.jpg').toLowerCase()) || null;
          const thumbUrl = thumbFile ? `${base}/${enc(`${cat}/${thumbFile}`)}` : folderThumb;
          const audioUrl = `${base}/${enc(`${cat}/${audioName}`)}`;

          const card = document.createElement('div');
          card.className = 'card';
          card.innerHTML = `
            <img src="${thumbUrl}" alt="" class="thumb"/>
            <div class="title">${baseName}</div>
            <audio controls preload="none" src="${audioUrl}" class="player"></audio>
          `;
          grid.appendChild(card);
        }
      }
    }catch(e){ console.error(e); }
  }
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render, { once:true });
  } else { render(); }
})();
