"use strict";
/* Hat simülasyonu bölümü: üstteki "Modül tasarımı | Hat simülasyonu" anahtarı ve 3D üretim hattı
   simülatörünün (/sim/) ilk açılışta yüklenmesi. Adres: /app/#hat. Tasarıma dönünce simülasyon arka planda sürer. */
(()=>{
  const root=document.getElementById('hatRoot'),sw=document.getElementById('modeSw');
  const entry=new URL('../../sim/src/app/index.js',document.currentScript.src).href;
  let sim=null,loading=null,lastTab='tasarim';
  document.addEventListener('tabshown',e=>{lastTab=e.detail;});
  function load(){
    if(sim||loading)return;
    root.innerHTML='<p class="hatmsg">Hat simülatörü yükleniyor…</p>';
    loading=import(entry).then(m=>{root.innerHTML='';sim=window.pvsim=m.mountLineSimulator(root);})
      .catch(e=>{loading=null;root.innerHTML='<p class="hatmsg er">Simülatör yüklenemedi ('+e.message+'). Bağlantıyı kontrol edip <button class="btn sm" id="hatRetry">yeniden deneyin</button>.</p>';
        document.getElementById('hatRetry').onclick=load;});
  }
  window.showHat=on=>{
    document.body.classList.toggle('mode-hat',on);
    root.hidden=!on;
    for(const b of sw.querySelectorAll('button'))b.setAttribute('aria-pressed',String((b.dataset.mode==='hat')===on));
    if(on){load();try{history.replaceState(null,'','#hat');}catch(e){}window.scrollTo(0,0);}
  };
  sw.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    const hat=document.body.classList.contains('mode-hat');
    if(b.dataset.mode==='hat'){if(!hat)location.hash='hat';}else if(hat)location.hash=lastTab;});
})();
