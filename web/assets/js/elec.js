"use strict";
/* Elektrik sekmesi: tek diyot modeli sonuçları, I-V / P-V eğrileri, ışınım × sıcaklık matrisi,
   akım/gerilim kontrolleri (Ö2) ve gölge senaryosu. */

/* Basit SVG çizgi grafik (tema renkleriyle) */
function lineChart(o){
  const W=o.w||420,H=o.h||236,ml=40,mr=12,mt=20,mb=34;
  let xmax=o.xmax,ymax=o.ymax;
  if(xmax===undefined){xmax=0;for(const s of o.series)for(const x of s.x)xmax=Math.max(xmax,x);}
  if(ymax===undefined){ymax=0;for(const s of o.series)for(const y of s.y)ymax=Math.max(ymax,y);}
  const nice=v=>{const e=Math.pow(10,Math.floor(Math.log10(v||1))),m=v/e;return (m<=1?1:m<=2?2:m<=5?5:10)*e;};
  const xs=nice(xmax/5),ys=nice(ymax/5);xmax=Math.ceil(xmax/xs)*xs;ymax=Math.ceil(ymax/ys)*ys;
  const X=x=>ml+x/xmax*(W-ml-mr),Y=y=>H-mb-y/ymax*(H-mt-mb);
  let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title||'grafik')}">`;
  for(let x=0;x<=xmax+1e-9;x+=xs)g+=`<line class="gr" x1="${X(x)}" y1="${mt}" x2="${X(x)}" y2="${H-mb}"/><text x="${X(x)}" y="${H-mb+13}" text-anchor="middle">${f(x,xs<1?1:0)}</text>`;
  for(let y=0;y<=ymax+1e-9;y+=ys)g+=`<line class="gr" x1="${ml}" y1="${Y(y)}" x2="${W-mr}" y2="${Y(y)}"/><text x="${ml-4}" y="${Y(y)+3.5}" text-anchor="end">${f(y,ys<1?1:0)}</text>`;
  g+=`<text x="${(ml+W-mr)/2}" y="${H-4}" text-anchor="middle" class="ax">${esc(o.xl||'')}</text><text x="${ml-30}" y="11" class="ax">${esc(o.yl||'')}</text>`;
  o.series.forEach((s,i)=>{let d='';for(let k=0;k<s.x.length;k++){if(s.y[k]<0||s.x[k]<0||s.x[k]>xmax*1.001)continue;d+=(d?'L':'M')+X(s.x[k]).toFixed(1)+' '+Y(s.y[k]).toFixed(1);}
    g+=`<path class="ln s${s.c!==undefined?s.c:i}${s.dash?' dash':''}" d="${d}"/>`;
    if(s.mark)g+=`<circle class="mk s${s.c!==undefined?s.c:i}" cx="${X(s.mark[0])}" cy="${Y(s.mark[1])}" r="3"/>`;
    if(s.label){const cl=`lb s${s.c!==undefined?s.c:i}`;
      if(s.lm&&s.mark)g+=`<text x="${X(s.mark[0])-6}" y="${Y(s.mark[1])-5}" text-anchor="end" class="${cl}">${esc(s.label)}</text>`;
      else{const k=Math.min(s.x.length-1,Math.floor(s.x.length*(s.lp||0.15)));g+=`<text x="${X(s.x[k])+3}" y="${Y(s.y[k])-4}" class="${cl}">${esc(s.label)}</text>`;}}});
  return g+'</svg>';
}
const downs=m=>ivCurve(m,140);

const IVG=[1100,1000,800,600,400,200,100],IVT=[15,25,50,75];
function ivMatrix(){if(!R.ivSpec)return null;const out={};for(const T of IVT)for(const G of IVG)out[G+'_'+T]=moduleIV(Object.assign({},R.ivSpec,{G,Tc:T})).Pmp;return out;}

function renderElec(){
  const p=S.p,box=$('#ivStats');if(!box)return;
  if(!R.iv){box.innerHTML='<p class="note">Tek diyot modeli kapalı veya hücre noktaları uydurulamadı. Elektrik modeli ayarlarından açın ve Tasarım sekmesindeki hücre değerlerini kontrol edin.</p>';
    for(const id of ['ivChartG','ivChartT','ivMatrix','shStats','shChart'])$('#'+id).innerHTML='';renderCur();return;}
  const fc=R.ivSpec.full,iv=R.iv;
  $('#ivNote').textContent=fc.ok?'hücre noktaları modelle uyumlu':'hücre noktaları modelle tam uyuşmuyor';
  box.innerHTML=[['Pmax (IV)',f(R.P,1)+' W',1],['Voc',f(R.Voc,2)+' V'],['Isc',f(R.Isc,3)+' A'],['Vmpp',f(R.Vmp,2)+' V'],['Impp',f(R.Imp,3)+' A'],['FF',f(R.FF*100,2)+' %'],
    ['Hücre ideallik n',f(fc.n,3)],['Hücre Rs',f(fc.Rs*1000,3)+' mΩ'],['Hücre Rsh',f(fc.Rsh,1)+' Ω'],['Hücre I0',fc.I0.toExponential(2)+' A'],
    ['Uyum hatası Pmax',fs(fc.errP,2)+' %'],['Uyum hatası Impp',fs(fc.errImp,2)+' %'],['Modül dış seri R',f(R.Rext*1000,1)+' mΩ'],['IV ↔ güç zinciri',fs((R.P/R.Pchain-1)*100,2)+' %']]
    .map(([i,v,h])=>`<div class="stat${h?' hl':''}"><i>${i}</i><b>${v}</b></div>`).join('');
  // I-V (ışınım) ve P-V (sıcaklık)
  const sG=[1000,800,600,400,200].map((G,i)=>{const m=moduleIV(Object.assign({},R.ivSpec,{G}));const d=downs(m);return {x:d.x,y:d.y,label:G+' W/m²',c:i,mark:[m.Vmp,m.Imp],lp:0.06};});
  $('#ivChartG').innerHTML=lineChart({series:sG,xl:'Gerilim (V)',yl:'Akım (A)',title:'I-V eğrileri'});
  const sT=[25,50,75].map((T,i)=>{const m=moduleIV(Object.assign({},R.ivSpec,{Tc:T}));const d=downs(m);return {x:d.x,y:d.P,label:`${T} °C · ${f(m.Pmp,0)} W`,c:i,mark:[m.Vmp,m.Pmp],lm:1};});
  $('#ivChartT').innerHTML=lineChart({series:sT,xl:'Gerilim (V)',yl:'Güç (W)',title:'P-V eğrileri'});
  // matris
  const M=ivMatrix(),P0=M['1000_25'];
  let t=`<table><tr><th>G (W/m²)</th>${IVT.map(T=>`<th class="n">${T} °C</th>`).join('')}<th class="n">Bağıl verim (25 °C)</th></tr>`;
  for(const G of IVG)t+=`<tr><td>${G}</td>${IVT.map(T=>`<td class="n">${f(M[G+'_'+T],1)}</td>`).join('')}<td class="n">${f(M[G+'_25']/P0*1000/G*100,1)} %</td></tr>`;
  const gam=(M['1000_50']/P0-1)/25*100;
  $('#ivMatrix').innerHTML=t+`</table><p class="note">Modelden çıkan Pmax sıcaklık katsayısı ${f(gam,3)} %/°C (girilen γ ${f(p.tc,2)} %/°C). 200 W/m²’de bağıl verim ${f(M['200_25']/P0*5*100,1)} %. NMOT (800 W/m², ${f(p.NMOT,0)} °C): ${f(R.ds.P_NMOT,1)} W.</p>`;
  renderCur();renderShade();
}
function renderCur(){
  const c=R.cur,p=S.p;if(!c||!$('#curTbl'))return;
  const pill=(ok,txt)=>`<span class="pill ${ok?'good':'bad'}">${txt}</span>`;
  const Tmin=-10,VocTmin=R.ds.Voc_m10,nmax=Math.floor(p.Vsys/VocTmin);
  const rows=[['Gereken akım Isc·(1+0,3·φ)·1,25',`${f(R.Isc,2)} A × ${f(1+0.3*R.ds.phi,3)} × 1,25`,f(c.Ireq,1)+' A',''],
    ['J-box / bypass diyot',(LIB.jbox.items[p.jboxV]||{}).l||'',c.jb?f(c.jb,0)+' A':'–',c.jb?pill(c.jb>=c.Ireq,c.jb>=c.Ireq?`pay %${f((c.jb/c.Ireq-1)*100,0)}`:'yetersiz'):''],
    ['Solar kablo',(LIB.cable.items[p.cableV]||{}).l||'',c.cab?f(c.cab,0)+' A':'–',c.cab?pill(c.cab>=c.Ireq,c.cab>=c.Ireq?`pay %${f((c.cab/c.Ireq-1)*100,0)}`:'yetersiz'):''],
    ['Konnektör',(LIB.conn.items[p.connV]||{}).l||'',c.con?f(c.con,0)+' A':'–',c.con?pill(c.con>=c.Ireq,c.con>=c.Ireq?`pay %${f((c.con/c.Ireq-1)*100,0)}`:'yetersiz'):''],
    ['Maks. seri sigorta (öneri)','≈ 1,56 × Isc, 5 A adım',c.fuse+' A',''],
    [`Voc @ ${Tmin} °C`,`β ${f(p.bVoc,2)} %/°C`,f(VocTmin,1)+' V',''],
    [`Dizi başına maks. modül (${f(p.Vsys,0)} V)`,'Voc @ −10 °C’ye göre',String(nmax),'']];
  $('#curTbl').innerHTML=`<table><tr><th>Kontrol</th><th>Bileşen / formül</th><th class="n">Değer</th><th class="n">Durum</th></tr>${rows.map(r=>`<tr><td>${r[0]}</td><td><small>${esc(r[1])}</small></td><td class="n">${r[2]}</td><td class="n">${r[3]}</td></tr>`).join('')}</table>`;
}
function renderShade(){
  const p=S.p;if(!R.ivSpec||!$('#shStats'))return;
  const nSub=R.ivSpec.groups.length,si=Math.min(Math.max(1,p.shSub),nSub)-1,brs=R.ivSpec.groups[si].branches,bi=p.shBr==='lo'&&brs.length>1?1:0;
  const n=Math.min(p.shN,brs[bi]);
  const m0=R.iv,ms=moduleIV(Object.assign({},R.ivSpec,{shade:n>0?{sub:si,br:bi,n,frac:p.shF/100}:null}));
  const loss=(1-ms.Pmp/m0.Pmp)*100;
  $('#shStats').innerHTML=[['Gölgeli Pmax',f(ms.Pmp,1)+' W',1],['Güç kaybı',f(loss,1)+' %'],['Gölgeli alan payı',f(n*p.shF/100/R.N*100,2)+' %'],
    ['Bypass diyotlar',ms.bypass.map((b,i)=>`D${i+1}:${b?'açık':'kapalı'}`).join(' ')],
    ['Gölgeli hücre gerilimi',ms.hot?f(ms.hot.V,2)+' V':'–'],['Gölgeli hücre ısı yükü',ms.hot?f(ms.hot.P,1)+' W':'–']]
    .map(([i,v,h])=>`<div class="stat${h?' hl':''}"><i>${i}</i><b>${v}</b></div>`).join('');
  const a=downs(m0),b=downs(ms);
  $('#shChart').innerHTML=lineChart({series:[{x:a.x,y:a.P,label:'gölgesiz',c:0,mark:[m0.Vmp,m0.Pmp],lm:1},{x:b.x,y:b.P,label:'gölgeli',c:3,mark:[ms.Vmp,ms.Pmp],lm:1}],xl:'Gerilim (V)',yl:'Güç (W)',title:'Gölge P-V'});
}
document.addEventListener('tabshown',e=>{if(e.detail==='elektrik')renderElec();});
{const _rcE=recompute;recompute=function(){_rcE();if(!$('[data-panel="elektrik"]').hidden)renderElec();};}
if(!$('[data-panel="elektrik"]').hidden)renderElec();
