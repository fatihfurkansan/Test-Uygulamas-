"use strict";
/* Analiz modülü: hassasiyet (tornado, Ö4), revizyon yönetimi (Ö8), sertifikalı mekanik kapsam (Ö15). */

/* ---- Ö4 · Tornado ---- */
// Toleranssız girdiler için değişim aralığı: [anahtar, mutlak adım] ya da [anahtar, '%', bağıl yüzde]
const TN_EXTRA=[['Isc','%',1],['Imp','%',1],['Voc','%',0.5],['Vmp','%',0.5],['nbb',1],['Rf',0.5],['Tf',0.5],['Gim',0.5],['fy',0.1],['Rb',0.05],
  ['rwR',0.1],['rwT',0.1],['dMM',0.1],['tef',0.05],['eL',1],['eW',1],['dCut',0.1],['Rj',0.5],['cabL',100],['RshC','%',50],['kc',0.05]];
const TN_PRICE=['cell','glassF','rear','encF','encR','frame','wire','jbox','labor'];
const TN_METRIC={P:{l:'Pmax',u:'W',d:2,g:r=>r.P},eta:{l:'Modül verimi',u:'%',d:3,g:r=>r.eta},CTM:{l:'CTM',u:'%',d:3,g:r=>r.CTM},perW:{l:'Birim maliyet',u:'/W',d:5,g:r=>r.bom.perW}};
let tnKey='',tnTmr=null;
function tornadoData(metric){
  const M=TN_METRIC[metric]||TN_METRIC.P,base=M.g(R),rows=[];
  const run=(set)=>{const q=Object.assign({},S.p);set(q);return M.g(evaluate(q));};
  const used=new Set();
  for(const s of SCHEMA){const t=S.t[s.k];if(!(t>0)||typeof S.p[s.k]!=='number')continue;used.add(s.k);
    rows.push({k:s.k,l:s.l,rng:`± ${fmtIn(t)} ${s.u}`,lo:run(q=>{q[s.k]-=t;}),hi:run(q=>{q[s.k]+=t;})});}
  for(const [k,a,b] of TN_EXTRA){const s=SCH[k];if(!s||used.has(k)||typeof S.p[k]!=='number')continue;
    if(k==='rwR'&&S.p.wt!=='round'||k==='rwT'&&S.p.wt!=='tri'||k==='dMM'&&S.p.mmMode)continue;
    let d,rng;if(a==='%'){if(k==='RshC'){const full=R.ivSpec&&R.ivSpec.full;if(!full)continue;d=full.Rsh*b/100;rng=`± %${b} (${f(full.Rsh,0)} Ω)`;}else{d=Math.abs(S.p[k])*b/100;rng=`± %${fmtIn(b)}`;}}else{d=a;rng=`± ${fmtIn(a)} ${s.u}`;}
    if(k==='RshC'){const v=R.ivSpec.full.Rsh;rows.push({k,l:s.l,rng,lo:run(q=>{q.RshC=v-d;}),hi:run(q=>{q.RshC=v+d;})});continue;}
    const lim=v=>Math.min(s.max!==undefined?s.max:Infinity,Math.max(s.min!==undefined?s.min:-Infinity,v));
    rows.push({k,l:s.l,rng,lo:run(q=>{q[k]=lim(q[k]-d);if(['Voc','Isc','Vmp','Imp'].includes(k))cellDerived(q);}),hi:run(q=>{q[k]=lim(q[k]+d);if(['Voc','Isc','Vmp','Imp'].includes(k))cellDerived(q);})});}
  if(metric==='perW')for(const id of TN_PRICE){const ln=R.bom.lines.find(x=>x.id===id);if(!ln||!(ln.price>0))continue;
    rows.push({k:'pr_'+id,l:'Fiyat: '+ln.l,rng:'± %10',lo:run(q=>{q['pr_'+id]=ln.price*0.9;}),hi:run(q=>{q['pr_'+id]=ln.price*1.1;})});}
  for(const r of rows){r.dlo=r.lo-base;r.dhi=r.hi-base;r.sw=Math.max(Math.abs(r.dlo),Math.abs(r.dhi));}
  rows.sort((x,y)=>y.sw-x.sw);
  return {M,base,rows:rows.filter(r=>r.sw>Math.abs(base)*1e-7),flat:rows.filter(r=>r.sw<=Math.abs(base)*1e-7)};
}
function renderTornado(force){
  const box=$('#tornado');if(!box||$('[data-panel="tolerans"]').hidden)return;
  const metric=$('#tnMetric').value,key=JSON.stringify([S.p,S.t,metric]);if(!force&&key===tnKey)return;
  clearTimeout(tnTmr);tnTmr=setTimeout(()=>{tnKey=key;
    const D=tornadoData(metric),mx=Math.max(1e-12,...D.rows.map(r=>r.sw)),u=metric==='perW'?S.p.cur+'/W':D.M.u;
    const bar=(v,cls)=>{const w=Math.abs(v)/mx*50;return `<span class="${cls}" style="${v<0?`right:50%`:`left:50%`};width:${w.toFixed(2)}%"></span>`;};
    const top=D.rows.slice(0,18);
    box.innerHTML=`<p class="note">Referans: ${D.M.l} = <b>${f(D.base,D.M.d)} ${esc(u)}</b>. <span class="tnk lo"></span> girdi azaltıldığında · <span class="tnk hi"></span> girdi artırıldığında.</p>
      <div class="tn"><span class="h">Girdi · aralık</span><span class="h v">Azalt</span><span class="h"></span><span class="h v l">Artır</span>
      ${top.map(r=>`<div class="lbl">${esc(r.l)}<small>${esc(r.rng)}</small></div><span class="v">${fs(r.dlo,D.M.d)}</span><div class="tnbar">${bar(r.dlo,'lo')}${bar(r.dhi,'hi')}</div><span class="v l">${fs(r.dhi,D.M.d)}</span>`).join('')}</div>
      ${D.rows.length>top.length?`<p class="note">${D.rows.length-top.length} girdi daha düşük etkili.</p>`:''}
      ${D.flat.length?`<p class="note">Bu ölçüte etkisi olmayan: ${D.flat.map(r=>esc(r.l)).join(', ')}.</p>`:''}`;
  },60);
}
$('#tnMetric').addEventListener('change',()=>renderTornado(true));
document.addEventListener('tabshown',e=>{if(e.detail==='tolerans')renderTornado();if(e.detail==='kayit')renderRevs();if(e.detail==='cizim')renderMech();});

/* ---- Ö8 · Revizyonlar ---- */
let REVS=LS.get('pvm.revs')||[];
const nextRev=r=>{r=String(r||'').trim();if(/^\d+$/.test(r))return String(+r+1);if(/^[A-Z]+$/i.test(r)){const up=r.toUpperCase().split('');let i=up.length-1;
  while(i>=0){if(up[i]==='Z'){up[i]='A';i--;}else{up[i]=String.fromCharCode(up[i].charCodeAt(0)+1);return up.join('');}}return 'A'+up.join('');}return r?r+'.1':'A';};
const revOf=()=>REVS.filter(x=>x.dwg===(S.p.dwgNo||''));
function revSnapshot(note){return {id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),dwg:S.p.dwgNo||'',rev:S.p.rev||'A',date:new Date().toISOString(),note,
  name:S.name,by:S.p.drawer||'',p:JSON.parse(JSON.stringify(S.p)),t:JSON.parse(JSON.stringify(S.t)),P:R.P,eta:R.eta,CTM:R.CTM,perW:R.bom.perW,cur:S.p.cur,L:R.L,W:R.W};}
function revDiff(a,b){const out=[];for(const s of SCHEMA){if(['rev','P','eta','FF'].includes(s.k))continue;const x=a.p[s.k],y=b.p[s.k];
    if(JSON.stringify(x)!==JSON.stringify(y))out.push([s.l,fmtRev(s,x),fmtRev(s,y)]);
    if(s.tol!==undefined&&(a.t[s.k]??0)!==(b.t[s.k]??0))out.push([s.l+' (tol.)','± '+fmtIn(a.t[s.k]??0),'± '+fmtIn(b.t[s.k]??0)]);}
  for(const k of new Set([...Object.keys(a.p),...Object.keys(b.p)]))if(/^(pr|fw)_/.test(k)&&a.p[k]!==b.p[k])out.push([(k.startsWith('pr_')?'Fiyat: ':'Fire: ')+((BOMD[k.slice(3)]||{}).id||k.slice(3)),a.p[k]===undefined?'kütüphane':fmtIn(a.p[k]),b.p[k]===undefined?'kütüphane':fmtIn(b.p[k])]);
  return out;}
function fmtRev(s,v){if(v===undefined)return '–';if(s.type==='lib')return (LIB[s.lib].items[v]||{l:v}).l;if(s.type==='bool')return v?'evet':'hayır';if(s.type==='sel')return ((s.opts||[]).find(o=>o[0]===v)||[v,v])[1];
  return typeof v==='number'?fmtIn(v)+(s.u?' '+s.u:''):String(v);}
let revDelArm=null;
function renderRevs(){
  if(!$('#revList'))return;const list=revOf(),cur=S.p.cur;
  $('#revInfo').textContent=`${S.p.dwgNo||'çizim no yok'} · mevcut rev. ${S.p.rev||'–'} · ${list.length} kayıt`;
  $('#revList').innerHTML=list.length?`<table><tr><th>Rev.</th><th>Tarih</th><th>Not</th><th class="n">Pmax</th><th class="n">Verim</th><th class="n">${esc(cur)}/W</th><th></th></tr>${list.slice().reverse().map(r=>`<tr><td><b>${esc(r.rev)}</b></td><td>${new Date(r.date).toLocaleDateString('tr-TR')}</td><td>${esc(r.note||'–')}<br><small class="note">${esc(r.name)}${r.by?' · '+esc(r.by):''}</small></td><td class="n">${f(r.P,1)}</td><td class="n">${f(r.eta,2)}</td><td class="n">${f(r.perW,4)}</td>
    <td class="n"><div class="btns" style="justify-content:flex-end"><button class="btn sm" data-rdiff="${r.id}">Fark</button><button class="btn sm" data-rload="${r.id}">Yükle</button><button class="btn sm" data-rdel="${r.id}">${revDelArm===r.id?'Emin misiniz?':'Sil'}</button></div></td></tr>`).join('')}</table>`
    :'<p class="note">Bu çizim numarası için kayıtlı revizyon yok. İlk kayıt mevcut revizyon harfiyle yapılır; sonraki kayıtlar harfi bir artırır (A → B).</p>';
}
$('#revSave').onclick=()=>{const m=$('#revMsg'),note=$('#revNote').value.trim(),list=revOf();
  if(list.length&&!note){m.className='msg er';m.textContent='Değişiklik notu yazın (ör. hangi parametre neden değişti).';return;}
  if(list.some(x=>x.rev===S.p.rev)){S.p.rev=nextRev(S.p.rev);setVal('rev');}
  const snap=revSnapshot(note||'İlk yayın');REVS.push(snap);if(REVS.length>300)REVS=REVS.slice(-300);LS.set('pvm.revs',REVS);
  $('#revNote').value='';m.className='msg ok';m.textContent=`Rev. ${snap.rev} kaydedildi (${f(snap.P,1)} W). Çizim antetinde ve revizyon tablosunda görünür.`;
  recompute();renderRevs();};
$('#revList').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
  if(t.dataset.rload){const r=REVS.find(x=>x.id===t.dataset.rload);if(!r)return;const b=defaults();
    S={name:r.name,p:cellDerived(Object.assign(b.p,JSON.parse(JSON.stringify(r.p)))),t:Object.assign(b.t,r.t||{}),tpl:''};MC=null;mcKey='';syncInputs();recompute();renderRevs();
    $('#revMsg').className='msg ok';$('#revMsg').textContent=`Rev. ${r.rev} yüklendi.`;}
  if(t.dataset.rdel){if(revDelArm!==t.dataset.rdel){revDelArm=t.dataset.rdel;renderRevs();setTimeout(()=>{if(revDelArm===t.dataset.rdel){revDelArm=null;renderRevs();}},3500);return;}
    REVS=REVS.filter(x=>x.id!==t.dataset.rdel);revDelArm=null;LS.set('pvm.revs',REVS);renderRevs();$('#revDiff').innerHTML='';if(window.renderSheets&&!$('[data-panel="cizim"]').hidden)renderSheets();}
  if(t.dataset.rdiff){const list=revOf(),i=list.findIndex(x=>x.id===t.dataset.rdiff);if(i<0)return;const r=list[i],prev=list[i-1];
    const now={p:S.p,t:S.t};const dPrev=prev?revDiff(prev,r):null,dNow=revDiff(r,now);
    const tbl=(rows,h1,h2)=>rows.length?`<table><tr><th>Girdi</th><th>${esc(h1)}</th><th>${esc(h2)}</th></tr>${rows.map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td></tr>`).join('')}</table>`:'<p class="note">Fark yok.</p>';
    $('#revDiff').innerHTML=`<h3 style="margin-top:14px">Rev. ${esc(r.rev)} değişiklikleri</h3>${prev?`<p class="note">Önceki: rev. ${esc(prev.rev)} · Pmax ${fs(r.P-prev.P,1)} W · verim ${fs(r.eta-prev.eta,2)} puan · ${esc(r.cur)}/W ${fs(r.perW-prev.perW,4)}</p><div class="tw">${tbl(dPrev,'Rev. '+prev.rev,'Rev. '+r.rev)}</div>`:'<p class="note">İlk revizyon; önceki kayıt yok.</p>'}
      <h3 style="margin-top:14px">Rev. ${esc(r.rev)} → mevcut tasarım</h3><div class="tw">${tbl(dNow,'Rev. '+r.rev,'Mevcut')}</div>`;}});

/* ---- Ö15 · Sertifikalı mekanik kapsam ---- */
const MOUNT_L=Object.fromEntries(SCH.mountV.opts);
function saveCert(){LS.set('pvm.mechcert',MECHCERT);}
function renderMech(){
  if(!$('#certTbl')||!R.mech)return;const m=R.mech,p=S.p;
  const st={ok:['good','Sertifika kapsamında'],over:['bad','Sertifika kapsamı aşılıyor'],none:['warn','Eşleşen sertifikalı kombinasyon yok']}[m.status];
  $('#mechStat').innerHTML=`Test yükü +${f(m.tp,0)} / −${f(m.tn,0)} Pa · <span class="pill ${st[0]}">${st[1]}</span>`;
  const lab=(lib,id)=>(LIB[lib].items[id]||{l:id}).l;
  $('#certTbl').innerHTML=MECHCERT.length?`<table><tr><th>Çerçeve</th><th class="n">Ön cam</th><th>Arka katman</th><th>Montaj</th><th class="n">Test + (Pa)</th><th class="n">Test − (Pa)</th><th>Rapor no</th><th></th></tr>${MECHCERT.map((c,i)=>{const hit=m.match===c;
    return `<tr${hit?' class="hit"':''}><td>${esc(lab('frame',c.frameV))}</td><td class="n">${f(c.tgf,1)} mm</td><td>${esc(lab('rear',c.rearV))}</td><td>${esc(MOUNT_L[c.mountV]||c.mountV)}</td>
      <td class="n"><input class="cin" data-ci="${i}" data-cf="maxPos" inputmode="numeric" value="${fmtIn(c.maxPos)}" aria-label="Test yükü artı"></td><td class="n"><input class="cin" data-ci="${i}" data-cf="maxNeg" inputmode="numeric" value="${fmtIn(c.maxNeg)}" aria-label="Test yükü eksi"></td>
      <td><input class="cin txt" data-ci="${i}" data-cf="report" value="${esc(c.report||'')}" placeholder="ör. IEC 61215 rapor no" aria-label="Rapor numarası"></td><td class="n"><button class="btn sm" data-cdelc="${i}">Sil</button></td></tr>`;}).join('')}</table>`
    :'<p class="note">Henüz sertifikalı kombinasyon girilmedi. Aşağıdaki düğmeyle mevcut çerçeve / cam / arka katman / montaj kombinasyonunu ekleyip test yüklerini düzeltin.</p>';
}
$('#certAdd').onclick=()=>{const p=S.p;if(MECHCERT.some(c=>c.frameV===p.frameV&&Math.abs(c.tgf-p.tgf)<0.01&&c.rearV===p.rearV&&c.mountV===p.mountV))return;
  MECHCERT.push({frameV:p.frameV,tgf:p.tgf,rearV:p.rearV,mountV:p.mountV,maxPos:Math.ceil(R.mech.tp/100)*100,maxNeg:Math.ceil(R.mech.tn/100)*100,report:''});saveCert();recompute();renderMech();};
$('#certTbl').addEventListener('change',e=>{const t=e.target;if(!t.dataset.cf)return;const c=MECHCERT[+t.dataset.ci];if(!c)return;
  if(t.dataset.cf==='report')c.report=t.value.trim();else{const v=parseNum(t.value);if(!(v>0)){t.classList.add('err');return;}t.classList.remove('err');c[t.dataset.cf]=v;}
  saveCert();recompute();renderMech();});
$('#certTbl').addEventListener('click',e=>{const t=e.target.closest('[data-cdelc]');if(!t)return;MECHCERT.splice(+t.dataset.cdelc,1);saveCert();recompute();renderMech();});

{const _rcA=recompute;recompute=function(){_rcA();
  if(!$('[data-panel="tolerans"]').hidden)renderTornado();
  if(!$('[data-panel="cizim"]').hidden)renderMech();
  if(!$('[data-panel="kayit"]').hidden)renderRevs();};}
renderTornado();renderMech();renderRevs();
