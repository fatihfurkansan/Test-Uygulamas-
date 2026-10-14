"use strict";
/* Tanıtım sayfası: örnek tasarımı hesap motoruyla hesaplar ve çizer */
(()=>{
  const d=defaults(),p=d.p;
  cellFrom(p);p.Rb=rearRb(p);p.Tf=(LIB.enc.items[p.encFV]||{T:99}).T;
  const R=evaluate(p);
  document.getElementById('exName').textContent='TOPCon G12R · 132 yarım hücre · cam-cam';
  const kp=[['Pmax',f(R.P,1)+' W'],['Modül verimi',f(R.eta,2)+' %'],['CTM',f(R.CTM,2)+' %'],['Boyut',`${f(R.L,0)} × ${f(R.W,0)} mm`],['Ağırlık',f(R.mass.total,1)+' kg'],['Birim maliyet',p.cur+f(R.bom.perW,3)+'/W']];
  document.getElementById('exKpi').innerHTML=kp.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  // basit ölçekli çizim
  const X0=R.fc+p.eW,Y0=R.fc+p.eL,h=R.h;
  const rowY=i=>i<R.up?Y0+i*(h+p.gc):Y0+R.up*h+(R.up-1)*p.gc+R.gmUse+(i-R.up)*(h+p.gc);
  let s=`<rect x="0" y="0" width="${R.W}" height="${R.L}" rx="6" class="fr"/><rect x="${R.fc}" y="${R.fc}" width="${R.Wg}" height="${R.Lg}" class="gl"/>`;
  for(let j=0;j<R.nc;j++)for(let i=0;i<R.nr;i++)s+=`<rect x="${X0+j*(p.a+p.gs)}" y="${rowY(i)}" width="${p.a}" height="${h}" class="ce"/>`;
  for(let j=0;j<R.nc;j++)for(let k=0;k<p.nbb;k+=2){const x=X0+j*(p.a+p.gs)+p.a/p.nbb*(k+0.5);s+=`<line x1="${x}" y1="${Y0}" x2="${x}" y2="${Y0+R.blockL}" class="wi"/>`;}
  document.getElementById('exDraw').innerHTML=`<svg viewBox="-20 -20 ${R.W+40} ${R.L+40}" role="img" aria-label="Örnek modül üstten görünüm ${f(R.L,0)} × ${f(R.W,0)} mm">${s}</svg>`;
  // kütüphane özeti
  let total=0;const cats=Object.entries(CATS);
  document.getElementById('libGrid').innerHTML=cats.map(([k,c])=>{const n=Object.keys(LIB[k].items).length;total+=n;
    const ex=Object.values(LIB[k].items).slice(0,3).map(it=>it.l).join(' · ');
    return `<div class="libc"><span class="n">${n}</span><b>${c.l}</b><small>${ex}${n>3?' …':''}</small></div>`;}).join('');
  document.getElementById('libTotal').textContent=total;
  document.getElementById('libCats').textContent=cats.length;
})();
