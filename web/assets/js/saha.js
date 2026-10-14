"use strict";
/* Saha sekmesi (Ö19): PVGIS PVcalc ile 1 kWp özgül verim → bu modülün yıllık enerjisi.
   Sorgu Netlify sunucu fonksiyonu üzerinden yapılır (PVGIS tarayıcıdan doğrudan çağrılamaz). */
const SITES=[['Ankara',39.93,32.86],['İstanbul',41.01,28.98],['İzmir',38.42,27.14],['Antalya',36.90,30.70],['Konya',37.87,32.48],['Kayseri',38.73,35.48],['Adana',37.00,35.32],
  ['Gaziantep',37.07,37.38],['Şanlıurfa',37.16,38.79],['Diyarbakır',37.91,40.24],['Van',38.50,43.38],['Erzurum',39.90,41.27],['Samsun',41.29,36.33],
  ['Berlin (DE)',52.52,13.40],['Sevilla (ES)',37.39,-5.98],['Roma (IT)',41.90,12.50],['Varşova (PL)',52.23,21.01],['Kahire (EG)',30.04,31.24],['Riyad (SA)',24.71,46.68],['Abu Dabi (AE)',24.45,54.38]];
const GREF=-0.40; // PVGIS kristal Si modelinin yaklaşık eşdeğer Pmax sıcaklık katsayısı (%/°C)
const AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
let PVG=LS.get('pvm.pvgis')||{};
const pvgKey=p=>[p.lat.toFixed(2),p.lon.toFixed(2),Math.round(p.tilt),Math.round(p.azim),p.mplace,+p.sysLoss.toFixed(1)].join('|');
function pvgQuery(p){return new URLSearchParams({lat:p.lat.toFixed(4),lon:p.lon.toFixed(4),angle:String(Math.round(p.tilt)),aspect:String(Math.round(p.azim)),loss:String(p.sysLoss),mountingplace:p.mplace}).toString();}
async function pvgFetch(p){
  const q=pvgQuery(p);let last=null;
  for(const base of ['/api/pvgis','/.netlify/functions/pvgis']){
    try{const r=await fetch(base+'?'+q,{headers:{Accept:'application/json'}});const ct=r.headers.get('content-type')||'';
      if(!ct.includes('json')){last=new Error(r.status===404?'Sunucu fonksiyonu bulunamadı (site Netlify’da mı yayında?)':'Beklenmeyen yanıt ('+r.status+')');continue;}
      const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||('HTTP '+r.status));return d;}
    catch(e){last=e;if(e&&e.message&&!/fonksiyon|Beklenmeyen|Failed to fetch|NetworkError|Load failed/i.test(e.message))throw e;}}
  throw last||new Error('PVGIS’e ulaşılamadı');
}
function sahaCalc(d){
  const p=S.p,ds=R.ds,kWp=R.P/1000,bif=1+ds.phi*p.rearPct/100,tmp=1+(p.tc-GREF)/100*p.dTop;
  const k=kWp*bif*tmp,E1=d.E_y*k;let life=0;for(let y=1;y<=p.yrs;y++)life+=E1*(y===1?ds.y1:ds.y1-(y-1)*p.ann)/100;
  return {kWp,bif,tmp,E0:d.E_y*kWp,E1,spec:d.E_y*bif*tmp,life,monthly:d.monthly.map(m=>m.E_m*k),perArea:E1/(R.Amod/1e6),cpkwh:R.bom.total/life};
}
function renderSaha(){
  const out=$('#sahaOut');if(!out)return;const p=S.p,key=pvgKey(p),d=PVG[key];
  if(!d){out.innerHTML=`<div class="card"><p class="note">Bu konum ve montaj için PVGIS sonucu yok. “PVGIS’ten hesapla” düğmesine basın.</p></div>`;return;}
  const c=sahaCalc(d),cur=p.cur,mx=Math.max(...c.monthly);
  const W=420,H=210,ml=36,mb=26,mt=24,bw=(W-ml-10)/12;
  let ch=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Aylık enerji">`;
  const nice=v=>{const e=Math.pow(10,Math.floor(Math.log10(v||1))),m=v/e;return (m<=1?1:m<=2?2:m<=5?5:10)*e;},st=nice(mx/4),top=Math.ceil(mx/st)*st;
  for(let v=0;v<=top+1e-9;v+=st){const y=H-mb-v/top*(H-mt-mb);ch+=`<line class="gr" x1="${ml}" y1="${y}" x2="${W-10}" y2="${y}"/><text x="${ml-4}" y="${y+3.5}" text-anchor="end">${f(v,0)}</text>`;}
  c.monthly.forEach((v,i)=>{const h=v/top*(H-mt-mb);ch+=`<rect class="bar" x="${ml+i*bw+2}" y="${H-mb-h}" width="${bw-4}" height="${h}"><title>${AY[i]}: ${f(v,1)} kWh</title></rect><text x="${ml+i*bw+bw/2}" y="${H-mb+13}" text-anchor="middle">${AY[i]}</text>`;});
  ch+=`<text x="4" y="12">kWh/ay</text></svg>`;
  out.innerHTML=`<div class="card"><div class="cardhead"><h3>Modül başına enerji</h3><small>${esc(d.place||'')} ${f(d.lat,2)}°, ${f(d.lon,2)}° · ${esc(d.db||'PVGIS')}</small></div>
    <div class="stats">
      <div class="stat hl"><i>Yıllık enerji (1. yıl)</i><b>${f(c.E1,0)} kWh</b></div>
      <div class="stat"><i>Özgül verim</i><b>${f(c.spec,0)} kWh/kWp</b></div>
      <div class="stat"><i>Alan başına</i><b>${f(c.perArea,0)} kWh/m²</b></div>
      <div class="stat"><i>PVGIS 1 kWp</i><b>${f(d.E_y,0)} kWh</b></div>
      <div class="stat"><i>Eğik düzlem ışınımı</i><b>${f(d.H_y,0)} kWh/m²</b></div>
      <div class="stat"><i>Bifasiyal kazanç</i><b>${fs((c.bif-1)*100,2)} %</b></div>
      <div class="stat"><i>Sıcaklık katsayısı farkı</i><b>${fs((c.tmp-1)*100,2)} %</b></div>
      <div class="stat"><i>${p.yrs} yıllık enerji</i><b>${f(c.life/1000,2)} MWh</b></div>
      <div class="stat"><i>Modül maliyeti / ömür enerjisi</i><b>${cur}${f(c.cpkwh*1000,2)}/MWh</b></div>
    </div>
    <div class="grid2" style="margin-top:10px"><div class="hist">${ch}</div><div class="tw"><table><tr><th>Ay</th><th class="n">Modül (kWh)</th><th class="n">1 kWp (kWh)</th><th class="n">Işınım (kWh/m²)</th></tr>${d.monthly.map((m,i)=>`<tr><td>${AY[i]}</td><td class="n">${f(c.monthly[i],1)}</td><td class="n">${f(m.E_m,1)}</td><td class="n">${f(m.H_m,1)}</td></tr>`).join('')}</table></div></div>
    <p class="note">E₁ = PVGIS 1 kWp yıllık enerjisi × modül gücü (${f(R.P,1)} W) × bifasiyal çarpan (1 + φ ${f(R.ds.phi,2)} × arka oran %${f(p.rearPct,0)}) × sıcaklık çarpanı (1 + (γ ${f(p.tc,2)} − ${f(GREF,2)}) × ${f(p.dTop,0)} °C / 100). PVGIS sistem kaybı %${f(p.sysLoss,1)} dahildir. Ömür enerjisi garanti eğrisiyle (1. yıl %${f(R.ds.y1,1)}, yıllık −%${f(p.ann,2)}) hesaplanır.</p>
    ${d.SD_y?`<p class="note">Yıllar arası değişkenlik (σ): ${f(d.SD_y,0)} kWh/kWp. Kayıplar: geliş açısı ${f(d.l_aoi,1)} %, spektral ${f(d.l_spec,1)} %, sıcaklık/ışınım ${f(d.l_tg,1)} % (PVGIS).</p>`:''}</div>`;
}
function sahaInit(){
  const sel=$('#siteSel');if(!sel)return;
  sel.innerHTML='<option value="">— Konum seçin —</option>'+SITES.map((s,i)=>`<option value="${i}">${esc(s[0])}</option>`).join('');
  sel.onchange=()=>{const s=SITES[+sel.value];if(!s)return;S.p.lat=s[1];S.p.lon=s[2];syncInputs();schedule();};
  $('#pvgisRun').onclick=async()=>{const p=S.p,st=$('#pvgisState'),b=$('#pvgisRun');b.disabled=true;st.className='note';st.textContent='PVGIS sorgulanıyor…';
    try{const d=await pvgFetch(p);const s=SITES.find(x=>Math.abs(x[1]-p.lat)<0.01&&Math.abs(x[2]-p.lon)<0.01);d.place=s?s[0]:'';
      PVG[pvgKey(p)]=d;const ks=Object.keys(PVG);if(ks.length>30)delete PVG[ks[0]];LS.set('pvm.pvgis',PVG);st.className='note';st.textContent='Güncel PVGIS sonucu.';renderSaha();}
    catch(e){st.className='msg er';st.textContent=(e&&e.message)||'PVGIS hatası';}
    finally{b.disabled=false;}};
}
sahaInit();
document.addEventListener('tabshown',e=>{if(e.detail==='saha')renderSaha();});
{const _rcS=recompute;recompute=function(){_rcS();if(!$('[data-panel="saha"]').hidden)renderSaha();};}
if(!$('[data-panel="saha"]').hidden)renderSaha();
