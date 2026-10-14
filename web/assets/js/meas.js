"use strict";
/* Ölçüm sekmesi: flasher dosyası içe aktarım (Ö12), faktör bazlı kalibrasyon, CTM kontrol grafiği (Ö13).
   Veri yalnız bellekte tutulur. */
const MS_F=[
  ['id','Seri no',/^(seri|serial|s\/?n|sn|barkod|barcode|module.?id|id|no)\b/i],
  ['P','Pmax (W)',/^(pmax|pmpp|pm|p_?max|power|güç|guc|p)\b/i],
  ['Voc','Voc (V)',/^(voc|uoc|v_?oc)\b/i],
  ['Isc','Isc (A)',/^(isc|i_?sc|ik)\b/i],
  ['Vmp','Vmpp (V)',/^(vmpp|vmp|umpp|ump|vpm|v_?mp)\b/i],
  ['Imp','Impp (A)',/^(impp|imp|ipm|i_?mp)\b/i],
  ['FF','FF',/^(ff|fill)/i],
  ['T','Sıcaklık (°C)',/^(t|temp|tmod|tcell|sıcaklık|sicaklik)\b/i]];
let MS=null; // {name, cols:[...], raw:[[...]], map:{key:colIndex}, rows:[{id,P,Voc,Isc,Vmp,Imp,FF}]}
let msMode='I',msCal=null;

function msParseText(txt){
  const lines=txt.replace(/\r/g,'').split('\n').filter(l=>l.trim()!=='');
  const first=lines.slice(0,30).join('\n'),cnt=d=>first.split(d).length;
  const del=['\t',';',','].sort((a,b)=>cnt(b)-cnt(a))[0];
  return lines.map(l=>l.split(del).map(c=>c.trim().replace(/^"(.*)"$/,'$1')));
}
function msLoadTable(name,table){
  // başlık satırı: bilinen kolon adlarıyla en çok eşleşen ilk 30 satırdan biri
  let hi=0,best=-1;table.slice(0,30).forEach((r,i)=>{const m=r.filter(c=>MS_F.some(([,,re])=>re.test(String(c).trim()))).length;if(m>best){best=m;hi=i;}});
  if(best<2)throw new Error('Kolon başlıkları tanınamadı (Pmax, Voc, Isc gibi başlıklar bekleniyor).');
  const cols=table[hi].map(c=>String(c).trim()),raw=table.slice(hi+1).filter(r=>r.some(c=>String(c).trim()!==''));
  const map={};for(const [k,,re] of MS_F){const i=cols.findIndex((c,j)=>re.test(c)&&!Object.values(map).includes(j));if(i>=0)map[k]=i;}
  MS={name,cols,raw,map,rows:[]};msBuild();
}
function msBuild(){
  const num=v=>{if(typeof v==='number')return v;const x=parseNum(v);return Number.isFinite(x)?x:NaN;};
  const m=MS.map;MS.rows=[];
  for(const r of MS.raw){const o={id:m.id!==undefined?String(r[m.id]):String(MS.rows.length+1)};
    for(const k of ['P','Voc','Isc','Vmp','Imp','FF','T'])o[k]=m[k]!==undefined?num(r[m[k]]):NaN;
    if(!(o.P>0)&&o.Vmp>0&&o.Imp>0)o.P=o.Vmp*o.Imp;
    if(o.FF>1.5)o.FF/=100;
    if(!(o.FF>0)&&o.P>0&&o.Voc>0&&o.Isc>0)o.FF=o.P/(o.Voc*o.Isc);
    if(o.P>0)MS.rows.push(o);}
}
function msMapUI(){
  if(!MS){$('#msMap').innerHTML='';return;}
  $('#msMap').innerHTML=`<details class="grp"><summary><h3>Kolon eşleştirme</h3><small>${esc(MS.name)} · ${MS.raw.length} satır · ${MS.rows.length} geçerli</small></summary><div class="rows">${MS_F.map(([k,l])=>`<div class="row"><label for="msm-${k}">${esc(l)}</label><div class="val"><select id="msm-${k}" data-msm="${k}"><option value="">— yok —</option>${MS.cols.map((c,i)=>`<option value="${i}"${MS.map[k]===i?' selected':''}>${esc(c||'kolon '+(i+1))}</option>`).join('')}</select></div></div>`).join('')}</div></details>`;
}
$('#msMap').addEventListener('change',e=>{const k=e.target.dataset.msm;if(!k||!MS)return;if(e.target.value==='')delete MS.map[k];else MS.map[k]=+e.target.value;msBuild();msCal=null;msMapUI();renderMeas();});
$('#msFile').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const m=$('#msMsg');e.target.value='';
  const ok=()=>{msCal=null;msMapUI();renderMeas();m.className='msg ok';m.textContent=`${fl.name}: ${MS.rows.length} modül okundu.`;};
  const er=x=>{m.className='msg er';m.textContent='Okunamadı: '+(x&&x.message||x);};
  const rd=new FileReader();
  if(/\.xlsx?$/i.test(fl.name)){if(!window.XLSX){er('Excel kütüphanesi yüklenemedi');return;}
    rd.onload=()=>{try{const wb=XLSX.read(new Uint8Array(rd.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];msLoadTable(fl.name,XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}));ok();}catch(x){er(x);}};rd.readAsArrayBuffer(fl);}
  else{rd.onload=()=>{try{msLoadTable(fl.name,msParseText(rd.result));ok();}catch(x){er(x);}};rd.readAsText(fl);}};
$('#msSample').onclick=()=>{
  // örnek: modelden %0,8 düşük, hafif sürüklenme ve iki aykırı değer içeren 240 modül
  const rng=mulberry32(2024),g=()=>{let u=0;while(u===0)u=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rng());};
  const t=[['Seri No','Pmax','Voc','Isc','Vmpp','Impp','FF']];
  for(let i=0;i<240;i++){const drift=i>170?-0.004*(i-170)/70:0,out=i===95?-0.03:i===201?-0.025:0;
    const Isc=R.Isc*0.994*(1+0.004*g()),Voc=R.Voc*0.998*(1+0.0025*g()),FF=R.FF*0.997*(1+0.003*g()+drift+out);
    const P=Voc*Isc*FF,Imp=R.Imp/R.Isc*Isc,Vmp=P/Imp;t.push(['M'+String(240000+i),P.toFixed(2),Voc.toFixed(3),Isc.toFixed(3),Vmp.toFixed(3),Imp.toFixed(3),(FF*100).toFixed(2)]);}
  msLoadTable('örnek_flasher.csv',t);msCal=null;msMapUI();renderMeas();const m=$('#msMsg');m.className='msg ok';m.textContent='Örnek veri yüklendi (240 modül, tasarımdan türetilmiş).';};

/* Faktör kalibrasyonu: k_opt (Isc) → k_R (FF) → k_kal (kalan Pmax) */
function msCalibrate(st){
  const q=Object.assign({},S.p),log=[];
  if(st.Isc){for(let i=0;i<3;i++){const r=evaluate(q);q.kOptCal=(q.kOptCal||1)*st.Isc/r.Isc;}log.push('k_opt');}
  if(st.FF){const FFm=st.FF;let lo=0.05,hi=5;const ff=k=>{q.kRes=k;return evaluate(q).FF;};
    const fLo=ff(lo),fHi=ff(hi);
    if(FFm>fLo)q.kRes=lo;else if(FFm<fHi)q.kRes=hi;else{for(let i=0;i<30;i++){const m=(lo+hi)/2;if(ff(m)>FFm)lo=m;else hi=m;}q.kRes=(lo+hi)/2;}log.push('k_R');}
  for(let i=0;i<3;i++){const r=evaluate(q);q.kCal=q.kCal*st.P/r.P;}log.push('k_kal');
  const r=evaluate(q),warn=[];
  if(q.kOptCal<0.8||q.kOptCal>1.2)warn.push(`k_opt = ${f(q.kOptCal,4)} izin verilen aralığın (0,8–1,2) dışında; hücre Isc değerini kontrol edin.`);
  if(q.kRes<=0.0501||q.kRes>=4.99)warn.push(`Ölçülen FF modelin ulaşabileceği aralığın dışında (k_R sınırda: ${f(q.kRes,2)}). Hücre FF / Rs veya Rsh değerini kontrol edin.`);
  if(q.kCal<0.5||q.kCal>1.5)warn.push(`k_kal = ${f(q.kCal,4)} aralık dışında.`);
  return {kOptCal:+q.kOptCal.toFixed(4),kRes:+q.kRes.toFixed(3),kCal:+q.kCal.toFixed(4),r,warn,log};
}
function msStats(rows,k){const v=rows.map(r=>r[k]).filter(Number.isFinite);if(!v.length)return null;return stats(v);}
/* Kontrol grafiği: bireysel (I-MR) veya alt grup ortalamaları (X̄, n=5); Western Electric kuralları */
function ctrlChart(vals,mode){
  let pts=vals,lbl='Bireysel değer';let cl,sig;
  if(mode==='X'){const n=5,g=[];for(let i=0;i+n<=vals.length;i+=n){let s=0;for(let j=0;j<n;j++)s+=vals[i+j];g.push(s/n);}
    pts=g;lbl='Alt grup ortalaması (n = 5)';let rs=0;for(let i=0;i+5<=vals.length;i+=5){const sl=vals.slice(i,i+5);rs+=Math.max(...sl)-Math.min(...sl);}const Rb=rs/g.length;
    cl=g.reduce((a,b)=>a+b,0)/g.length;sig=Rb/2.326/Math.sqrt(5);}
  else{cl=vals.reduce((a,b)=>a+b,0)/vals.length;let mr=0;for(let i=1;i<vals.length;i++)mr+=Math.abs(vals[i]-vals[i-1]);sig=mr/(vals.length-1)/1.128;}
  const ucl=cl+3*sig,lcl=cl-3*sig,flag=new Array(pts.length).fill(0),why=[];
  const side=v=>v>cl?1:v<cl?-1:0;
  pts.forEach((v,i)=>{if(v>ucl||v<lcl){flag[i]|=1;}});
  for(let i=8;i<pts.length;i++){const s=side(pts[i]);if(s&&pts.slice(i-8,i+1).every(v=>side(v)===s))for(let j=i-8;j<=i;j++)flag[j]|=2;}
  for(let i=5;i<pts.length;i++){let up=true,dn=true;for(let j=i-5;j<i;j++){if(!(pts[j+1]>pts[j]))up=false;if(!(pts[j+1]<pts[j]))dn=false;}if(up||dn)for(let j=i-5;j<=i;j++)flag[j]|=4;}
  for(let i=2;i<pts.length;i++)for(const s of [1,-1]){const c=[pts[i-2],pts[i-1],pts[i]].filter(v=>s*(v-cl)>2*sig).length;if(c>=2)for(let j=i-2;j<=i;j++)if(s*(pts[j]-cl)>2*sig)flag[j]|=8;}
  const nR=[1,2,4,8].map(b=>flag.filter(x=>x&b).length);
  if(nR[0])why.push(`${nR[0]} nokta kontrol sınırı dışında (±3σ)`);if(nR[1])why.push(`9 ardışık nokta merkez çizgisinin aynı tarafında (kayma)`);
  if(nR[2])why.push(`6 ardışık artan/azalan nokta (trend)`);if(nR[3])why.push(`3 noktanın 2’si ±2σ dışında`);
  // SVG
  const W=900,H=260,ml=44,mr=82,mt=12,mb=30,n=pts.length;
  let lo=Math.min(lcl,...pts),hi=Math.max(ucl,...pts);const pad=(hi-lo)*0.08||1;lo-=pad;hi+=pad;
  const X=i=>ml+(n>1?i/(n-1):0.5)*(W-ml-mr),Y=v=>mt+(hi-v)/(hi-lo)*(H-mt-mb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kontrol grafiği">`;
  for(const [v,c,l] of [[ucl,'lim','UCL'],[cl,'ctr','CL'],[lcl,'lim','LCL']])s+=`<line class="${c}" x1="${ml}" y1="${Y(v)}" x2="${W-mr}" y2="${Y(v)}"/><text x="${W-mr+4}" y="${Y(v)+3.5}">${l} ${f(v,2)}</text>`;
  for(const v of [cl+sig,cl+2*sig,cl-sig,cl-2*sig])s+=`<line class="gr" x1="${ml}" y1="${Y(v)}" x2="${W-mr}" y2="${Y(v)}"/>`;
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;s+=`<text x="${ml-4}" y="${Y(v)+3.5}" text-anchor="end">${f(v,1)}</text>`;}
  s+=`<path class="ln s0" d="${pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join('')}" style="stroke-width:1"/>`;
  pts.forEach((v,i)=>{s+=`<circle class="${flag[i]?'out':'mk s0'}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${flag[i]?2.8:1.6}"/>`;});
  s+=`<text x="${(ml+W-mr)/2}" y="${H-6}" text-anchor="middle" class="ax">${esc(lbl)} · sıra no</text></svg>`;
  return {svg:s,cl,ucl,lcl,sig,why,n,flagged:flag.filter(Boolean).length};
}
function renderMeas(){
  const box=$('#msBody');if(!box)return;
  if(!MS||!MS.rows.length){box.innerHTML='<div class="card"><p class="note">Henüz ölçüm verisi yok. Flasher dosyası yükleyin veya örnek veriyle deneyin.</p></div>';return;}
  const rows=MS.rows,sP=msStats(rows,'P'),sV=msStats(rows,'Voc'),sI=msStats(rows,'Isc'),sF=msStats(rows,'FF'),p=S.p;
  const cmp=[['Pmax (W)',sP,R.P,2],['Voc (V)',sV,R.Voc,2],['Isc (A)',sI,R.Isc,3],['FF (%)',sF,R.FF,4]];
  let h=`<div class="card"><div class="cardhead"><h3>Ölçüm ↔ model</h3><small>${rows.length} modül · ${esc(MS.name)}</small></div>
    <div class="tw"><table><tr><th>Büyüklük</th><th class="n">Ölçüm ort.</th><th class="n">σ</th><th class="n">Model</th><th class="n">Fark</th></tr>
    ${cmp.map(([l,s,m,d])=>s?`<tr><td>${l}</td><td class="n">${l.startsWith('FF')?f(s.mean*100,2):f(s.mean,d)}</td><td class="n">${l.startsWith('FF')?f(s.sd*100,2):f(s.sd,d)}</td><td class="n">${l.startsWith('FF')?f(m*100,2):f(m,d)}</td><td class="n">${l.startsWith('FF')?fs((s.mean-m)*100,2)+' puan':fs((s.mean/m-1)*100,2)+' %'}</td></tr>`:`<tr><td>${l}</td><td colspan="4" class="note">kolon yok</td></tr>`).join('')}</table></div>
    <div class="hist" style="margin-top:10px;max-width:640px">${hist(rows.map(r=>r.P),sP,{title:'Ölçülen Pmax',unit:'Pmax (W)',dec:1,marks:[{x:R.P,l:'model',cls:'mk2'},{x:p.Pplate,l:'etiket',cls:'mk'}]})}</div>
    <p class="note">Etiket gücü (${f(p.Pplate,0)} W) altında: ${rows.filter(r=>r.P<p.Pplate).length} modül (${f(rows.filter(r=>r.P<p.Pplate).length/rows.length*100,2)} %). Cpk (alt sınır) = ${f((sP.mean-p.Pplate)/(3*sP.sd),2)}.</p></div>`;
  // kalibrasyon
  h+=`<div class="card"><div class="cardhead"><h3>Faktör bazlı kalibrasyon</h3><button class="btn sm" id="msCalRun">Hesapla</button></div>
    <p class="note">Sırayla: optik çarpan k_opt ölçülen Isc’ye, seri direnç çarpanı k_R ölçülen FF’ye, kalibrasyon çarpanı k_kal kalan Pmax farkına uydurulur. Böylece fark kaynağı (optik, direnç, gerilim) ayrışır.</p><div id="msCalOut"></div></div>`;
  // kontrol grafiği
  h+=`<div class="card"><div class="cardhead"><h3>CTM kontrol grafiği</h3><div class="row wide" style="border:0;padding:0;min-width:220px"><label for="msMode">Grafik</label><select id="msMode"><option value="I"${msMode==='I'?' selected':''}>Bireysel (I-MR)</option><option value="X"${msMode==='X'?' selected':''}>X̄, alt grup 5</option></select></div></div>
    <div id="msCtrl"></div></div>`;
  box.innerHTML=h;renderCal();renderCtrl();
}
function renderCal(){
  const o=$('#msCalOut');if(!o)return;
  if(!msCal){o.innerHTML='';return;}
  const c=msCal,p=S.p,r=c.r;
  o.innerHTML=`<div class="tw"><table><tr><th>Çarpan</th><th class="n">Mevcut</th><th class="n">Yeni</th></tr>
    <tr><td>Optik kalibrasyon k_opt (akım)</td><td class="n">${f(p.kOptCal,4)}</td><td class="n"><b>${f(c.kOptCal,4)}</b></td></tr>
    <tr><td>Seri direnç çarpanı k_R (FF)</td><td class="n">${f(p.kRes,3)}</td><td class="n"><b>${f(c.kRes,3)}</b></td></tr>
    <tr><td>Kalibrasyon çarpanı k_kal (kalan)</td><td class="n">${f(p.kCal,4)}</td><td class="n"><b>${f(c.kCal,4)}</b></td></tr></table></div>
    <div class="tw" style="margin-top:8px"><table><tr><th>Kalibre model</th><th class="n">Pmax</th><th class="n">Voc</th><th class="n">Isc</th><th class="n">FF</th></tr>
    <tr><td>Değer</td><td class="n">${f(r.P,2)} W</td><td class="n">${f(r.Voc,2)} V</td><td class="n">${f(r.Isc,3)} A</td><td class="n">${f(r.FF*100,2)} %</td></tr>
    <tr><td>Ölçüme göre fark</td>${['P','Voc','Isc','FF'].map(k=>{const s=msStats(MS.rows,k);return `<td class="n">${s?(k==='FF'?fs((r.FF-s.mean)*100,2)+' puan':fs((r[k]/s.mean-1)*100,2)+' %'):'–'}</td>`;}).join('')}</tr></table></div>
    ${c.warn.length?`<p class="msg er">${c.warn.map(esc).join('<br>')}</p>`:''}
    <div class="btns" style="margin-top:8px"><button class="btn pri" id="msCalApply">Çarpanları tasarıma uygula</button></div>
    <p class="note">Kalan Voc farkı k_kal’e yansır; Voc farkı büyükse hücre Voc girdisini veya ölçüm sıcaklığını kontrol edin.</p>`;
}
function renderCtrl(){
  const o=$('#msCtrl');if(!o||!MS)return;
  const vals=MS.rows.map(r=>r.P/R.Pcells*100);
  if(vals.length<(msMode==='X'?10:5)){o.innerHTML='<p class="note">Kontrol grafiği için yeterli nokta yok.</p>';return;}
  const c=ctrlChart(vals,msMode);
  o.innerHTML=`<div class="stats"><div class="stat hl"><i>Merkez (CTM)</i><b>${f(c.cl,2)} %</b></div><div class="stat"><i>σ (kısa dönem)</i><b>${f(c.sig,3)} puan</b></div><div class="stat"><i>UCL / LCL</i><b>${f(c.ucl,2)} / ${f(c.lcl,2)}</b></div><div class="stat"><i>Model CTM</i><b>${f(R.CTM,2)} %</b></div><div class="stat"><i>İşaretli nokta</i><b>${c.flagged} / ${c.n}</b></div></div>
    <div class="chart" style="margin-top:8px">${c.svg}</div>
    ${c.why.length?`<p class="msg er">${c.why.map(esc).join(' · ')}</p>`:'<p class="msg ok">Proses kontrol altında: kural ihlali yok.</p>'}
    <p class="note">CTM = ölçülen Pmax / Σ hücre gücü (${R.N} × ${f(R.Pcells/R.N,3)} W = ${f(R.Pcells,1)} W). Kontrol sınırları verinin kendisinden (MR̄/d₂ veya R̄/d₂) hesaplanır.</p>`;
}
$('#msBody').addEventListener('click',e=>{
  if(e.target.id==='msCalRun'){const st={P:msStats(MS.rows,'P').mean};const sI=msStats(MS.rows,'Isc'),sF=msStats(MS.rows,'FF');if(sI)st.Isc=sI.mean;if(sF)st.FF=sF.mean;
    e.target.disabled=true;e.target.textContent='Hesaplanıyor…';setTimeout(()=>{msCal=msCalibrate(st);renderCal();e.target.disabled=false;e.target.textContent='Yeniden hesapla';},20);}
  if(e.target.id==='msCalApply'&&msCal){S.p.kOptCal=msCal.kOptCal;S.p.kRes=msCal.kRes;S.p.kCal=msCal.kCal;syncInputs();recompute();
    const m=$('#msMsg');m.className='msg ok';m.textContent=`Çarpanlar uygulandı: k_opt ${f(msCal.kOptCal,4)}, k_R ${f(msCal.kRes,3)}, k_kal ${f(msCal.kCal,4)}. Model Pmax ${f(R.P,2)} W.`;msCal=null;renderMeas();}});
$('#msBody').addEventListener('change',e=>{if(e.target.id==='msMode'){msMode=e.target.value;renderCtrl();}});
document.addEventListener('tabshown',e=>{if(e.detail==='olcum')renderMeas();});
{const _rcM=recompute;recompute=function(){_rcM();if(!$('[data-panel="olcum"]').hidden){if(MS)renderCtrl();}};}
if(!$('[data-panel="olcum"]').hidden)renderMeas();
