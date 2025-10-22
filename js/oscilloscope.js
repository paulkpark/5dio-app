
(function(){
  const cvs = document.getElementById('scope');
  if(!cvs) return;
  const g = cvs.getContext('2d');
  function getAC(){
    return window.audioCtx || window.audioContext || window.ctx || window.genCtx || window.AC || window.__ac || null;
  }
  function pickMaster(){
    const cands = [window.genMasterGain, window.masterGain, window.__genGain, window.output, window.out];
    return cands.find(n => n && typeof n.connect === 'function') || null;
  }
  let analyser = null;
  async function start(){
    const ac = getAC(); if(!ac) return;
    if(ac.state==='suspended'){ try{ await ac.resume(); }catch(e){} }
    if(!analyser){
      try{
        analyser = ac.createAnalyser(); analyser.fftSize = 2048;
        const src = pickMaster(); if(src) try{ src.connect(analyser); }catch(e){}
      }catch(e){ return; }
    }
    const W=cvs.width, H=cvs.height; const buf=new Uint8Array(analyser.fftSize);
    (function loop(){
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0,0,W,H); g.beginPath();
      const step = W/buf.length;
      for(let i=0;i<buf.length;i++){ const x=i*step, y=(buf[i]/128)*H/2; i?g.lineTo(x,y):g.moveTo(x,y); }
      g.stroke(); requestAnimationFrame(loop);
    })();
  }
  document.addEventListener('click', start, { once:true, capture:true });
})();
