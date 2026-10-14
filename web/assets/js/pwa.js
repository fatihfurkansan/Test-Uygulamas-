"use strict";
/* Service worker kaydı, kurulum düğmesi ve güncelleme bildirimi */
(()=>{
  const btn=document.getElementById('installBtn');let deferred=null;
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(btn&&!standalone)btn.hidden=false;});
  if(btn)btn.addEventListener('click',async()=>{
    if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;btn.hidden=true;return;}
    alertIOS();
  });
  function alertIOS(){if(document.querySelector('.updbar.ios'))return;const bar=document.createElement('div');bar.className='updbar ios';
    bar.innerHTML='<span>Safari’de <b>Paylaş</b> ▸ <b>Ana Ekrana Ekle</b> ile yükleyin.</span> <button class="btn sm">Tamam</button>';bar.querySelector('button').onclick=()=>bar.remove();document.body.appendChild(bar);}
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
  if(btn&&isIOS&&!standalone){btn.hidden=false;btn.textContent='Ana ekrana ekle';}
  window.addEventListener('appinstalled',()=>{if(btn)btn.hidden=true;});
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    navigator.serviceWorker.register('/sw.js').then(reg=>{
      reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{
        if(w.state==='installed'&&navigator.serviceWorker.controller){const bar=document.createElement('div');bar.className='updbar';
          bar.innerHTML='Yeni sürüm hazır. <button class="btn sm pri">Yenile</button>';bar.querySelector('button').onclick=()=>location.reload();document.body.appendChild(bar);}});});
    }).catch(()=>{});
  }
})();
