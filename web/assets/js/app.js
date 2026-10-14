"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

/* ---- Şablonlar: sektördeki tipik modül yapıları ---- */
const ERAS={now:'Güncel (2023 →)',mid:'Geçiş dönemi (2019–2022)',old:'Eski tip (≤ 2018)'};
const TEMPLATES=[
  {id:'gg_tc_g12r',era:'now',l:'Cam-cam çerçeveli · TOPCon G12R · 132 yarım hücre, 16BB (2382×1134)',lib:{},set:{}},
  {id:'gg_tc_m10r',era:'now',l:'Cam-cam çerçeveli · TOPCon M10R 0BB · 144 yarım hücre (2278×1134)',
    lib:{fmtV:'m10r',techV:'topcon0bb',wireV:'r20',coatV:'bare',joinV:'film',rearV:'gr20',encFV:'EPE',encRV:'POE',frameV:'al30'},set:{nbb:20,nc:6,nr:24,gc:1.0,gm:6,eL:19.5,eW:11.15,Pplate:590,Lmax:2280,Wmax:1136}},
  {id:'gg_tc_g12',era:'now',auto:true,l:'Cam-cam çerçeveli · TOPCon G12 · 132 yarım hücre, 18BB',
    lib:{fmtV:'g12',techV:'topcon',wireV:'r22',rearV:'gr20',encFV:'EPE',encRV:'POE',frameV:'al35',jboxV:'split35',cableV:'c40_400'},set:{nbb:18,nc:6,nr:22,gc:1.0,gm:6,eL:24,eW:15.25}},
  {id:'gg_hjt_g12',era:'now',l:'Cam-cam çerçevesiz · HJT G12 · 132 yarım hücre (2384×1303)',
    lib:{fmtV:'g12',techV:'hjt',wireV:'r22',coatV:'snbi',joinV:'lt',glassFV:'g20ar',rearV:'gc20',encFV:'POE',encRV:'POE',frameV:'none',edgeV:'tape',jboxV:'split35',cableV:'c40_400'},set:{nbb:18,nc:6,nr:22,gc:1.0,gm:6,eL:24,eW:15.25,Pplate:705,Lmax:2386,Wmax:1305}},
  {id:'gg_hjt_g12r',era:'now',auto:true,l:'Cam-cam çerçeveli · HJT G12R Cu kaplama · 132 yarım hücre, 0BB',
    lib:{fmtV:'g12r',techV:'hjt_cu',wireV:'r18',coatV:'snbi',joinV:'film',glassFV:'g20ar',rearV:'gc20',encFV:'POE',encRV:'POE',frameV:'al30'},set:{nbb:20,nc:6,nr:22,gc:1.0,gm:6,eL:20,eW:11.15}},
  {id:'gg_bc_m10r',era:'now',l:'Cam-cam çerçeveli · BC M10R · 144 yarım hücre (2278×1134)',
    lib:{fmtV:'m10r',techV:'bc',wireV:'f9x20',rearV:'gc20',encFV:'POE',encRV:'POE',frameV:'al30'},set:{nbb:10,nc:6,nr:24,gc:1.0,gm:6,eL:19.5,eW:11.15,Pplate:620,Lmax:2280,Wmax:1136}},
  {id:'gb_bc_blk',era:'now',auto:true,l:'Cam-backsheet all-black · BC M10R · 108 yarım hücre (çatı)',
    lib:{fmtV:'m10r',techV:'bc',wireV:'f9x20',glassFV:'g32ar',rearV:'bsBLK',encFV:'POE',encRV:'EVAB',frameV:'al30b',jboxV:'split25'},set:{nbb:10,nc:6,nr:18,gc:1.0,gm:6,eL:19.5,eW:11.15}},
  {id:'rd_tandem',era:'now',auto:true,l:'Ar-Ge · Perovskit/Si tandem M10R · 144 yarım hücre, cam-cam',
    lib:{fmtV:'m10r',techV:'tandem',wireV:'r24',coatV:'snbi',joinV:'lt',rearV:'gc20',encFV:'POE',encRV:'POE',frameV:'al30',edgeV:'butyl'},set:{nbb:16,nc:6,nr:24,gc:1.0,gm:6,eL:19.5,eW:11.15}},
  {id:'gb_perc_m10',era:'mid',auto:true,l:'Cam-backsheet · PERC M10 182 · 144 yarım hücre, 10BB, 3,2 mm cam',
    lib:{fmtV:'m10',techV:'perc',wireV:'r30',glassFV:'g32ar',rearV:'bsKPf',encFV:'EVA',encRV:'EVAW',frameV:'al35'},set:{eta:23.4,nbb:10,wpad:0.1,nc:6,nr:24,gc:1.5,gm:6,eL:19.6,eW:11.4}},
  {id:'gb_perc_m6',era:'mid',auto:true,l:'Cam-backsheet · PERC M6 · 144 yarım hücre, 9BB MBB',
    lib:{fmtV:'m6',techV:'perc',wireV:'r35',busV:'b5x35',glassFV:'g32ar',rearV:'bsKPf',encFV:'EVA',encRV:'EVAW',frameV:'al35',cableV:'c40_1200'},set:{eta:22.8,half:true,nbb:9,wpad:0.1,nc:6,nr:24,gc:1.5,gm:6,eL:20,eW:13,ov:2}},
  {id:'gg_perc_m6',era:'mid',auto:true,l:'Cam-cam bifasiyal · PERC M6 · 144 yarım hücre, 9BB, 2,0+2,0 mm',
    lib:{fmtV:'m6',techV:'perc_bi',wireV:'r35',glassFV:'g20ar',rearV:'gc20',encFV:'EVA',encRV:'POE',frameV:'al30',cableV:'c40_1200'},set:{eta:22.6,half:true,nbb:9,wpad:0.1,nc:6,nr:24,gc:1.5,gm:6,eL:20,eW:13,ov:2}},
  {id:'gb_perc_g1',era:'mid',auto:true,l:'Cam-backsheet · PERC G1 · 120 yarım hücre, 5BB',
    lib:{fmtV:'g1',techV:'perc',wireV:'f9x23',busV:'b5x35',glassFV:'g32ar',rearV:'bsKPf',encFV:'EVA',encRV:'EVA',frameV:'al35',cableV:'c40_1200'},set:{eta:22.2,half:true,nbb:5,wpad:0.7,nc:6,nr:20,gc:1.5,gm:6,eL:20,eW:15,ov:2}},
  {id:'gb_pert_m4',era:'mid',auto:true,l:'Cam-cam bifasiyal · n-PERT M4 · 72 tam hücre, 5BB',
    lib:{fmtV:'m4',techV:'pert',wireV:'f9x23',busV:'b6x40',glassFV:'g25ar',rearV:'gc25',encFV:'POE',encRV:'POE',frameV:'al35',jboxV:'one3',cableV:'c40_1000'},set:{half:false,nbb:5,wpad:0.7,nc:6,nr:12,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'gb_mwt_m2',era:'mid',auto:true,l:'Cam-iletken backsheet · MWT PERC M2 · 60 tam hücre',
    lib:{fmtV:'m2',techV:'mwt',wireV:'f9x20',coatV:'bare',joinV:'eca',busV:'b6x40',glassFV:'g32ar',rearV:'bsMWT',encFV:'EVA',encRV:'EVA',frameV:'al35',jboxV:'one3',cableV:'c40_900'},set:{half:false,nbb:4,nc:6,nr:10,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old72_mono',era:'old',auto:true,l:'Cam-backsheet · Al-BSF mono M2 · 72 tam hücre, 4BB',
    lib:{fmtV:'m2',techV:'bsf_mono',wireV:'f10x25',busV:'b6x40',glassFV:'g32ar',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al40',jboxV:'one3',cableV:'c40_1000',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{eta:19.6,half:false,nbb:4,wpad:0.9,nc:6,nr:12,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old60_perc',era:'old',auto:true,l:'Cam-backsheet · PERC mono M2 · 60 tam hücre, 5BB',
    lib:{fmtV:'m2',techV:'perc',wireV:'f9x23',busV:'b6x40',glassFV:'g32ar',rearV:'bsKPK',encFV:'EVA',encRV:'EVA',frameV:'al35',jboxV:'one3',cableV:'c40_900'},set:{eta:21.6,half:false,nbb:5,wpad:0.7,nc:6,nr:10,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old60_pmc',era:'old',auto:true,l:'Cam-backsheet · PERC multi (black-Si) M2 · 60 tam hücre, 5BB',
    lib:{fmtV:'m2sq',techV:'perc_mc',wireV:'f9x23',busV:'b6x40',glassFV:'g32ar',rearV:'bsKPE',encFV:'EVA',encRV:'EVA',frameV:'al35',jboxV:'one3',cableV:'c40_900'},set:{half:false,nbb:5,wpad:0.7,nc:6,nr:10,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old60_multi',era:'old',auto:true,l:'Cam-backsheet · Al-BSF multi M2 · 60 tam hücre, 4BB',
    lib:{fmtV:'m2sq',techV:'bsf_mc',wireV:'f10x25',busV:'b6x40',glassFV:'g32ar',rearV:'bsTPE',encFV:'EVA',encRV:'EVA',frameV:'al40',jboxV:'one3',cableV:'c40_900'},set:{half:false,nbb:4,wpad:0.9,nc:6,nr:10,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old60_3bb',era:'old',auto:true,l:'Cam-backsheet · Al-BSF multi M2 · 60 tam hücre, 3BB LHS ribbon',
    lib:{fmtV:'m2sq',techV:'bsf_mc',wireV:'s15x20',busV:'b6x40',glassFV:'g32ar',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al40',jboxV:'one3',cableV:'c40_900',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{half:false,nbb:3,wpad:1.4,nc:6,nr:10,gc:2,gs:3,eL:24,eW:15,ov:2}},
  {id:'old72_m0',era:'old',auto:true,l:'Cam-backsheet · Al-BSF mono M0 156 · 72 tam hücre, 3BB',
    lib:{fmtV:'f156m0',techV:'bsf_mono',wireV:'f15x20',busV:'b6x40',glassFV:'g32no',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al45',jboxV:'one3',cableV:'c40_900',potV:'none',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{eta:18.8,half:false,nbb:3,wpad:1.4,nc:6,nr:12,gc:2.5,gs:3,eL:25,eW:16,ov:2}},
  {id:'old60_m0mc',era:'old',auto:true,l:'Cam-backsheet · Al-BSF multi M0 156 · 60 tam hücre, 2BB (çok eski)',
    lib:{fmtV:'f156sq',techV:'bsf_mc',wireV:'f20x18',busV:'b6x40',glassFV:'g32no',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al45',jboxV:'one2',cableV:'c25_900',potV:'none',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{eta:16.8,half:false,nbb:2,wpad:1.8,nc:6,nr:10,gc:2.5,gs:3,eL:25,eW:16,ov:2}},
  {id:'old72_125',era:'old',auto:true,l:'Cam-backsheet · Mono 125 mm (5 inç) · 72 tam hücre, 2BB (çok eski)',
    lib:{fmtV:'f125',techV:'bsf_mono',wireV:'f20x15',busV:'b5x30',glassFV:'g32no',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al45',jboxV:'one2',cableV:'c25_900',potV:'none',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{eta:17.5,half:false,nbb:2,wpad:1.8,nc:6,nr:12,gc:2.5,gs:3,eL:25,eW:16,ov:2}},
  {id:'old36_12v',era:'old',auto:true,l:'Cam-backsheet · Al-BSF multi M2 · 36 hücre (12 V), 3BB',
    lib:{fmtV:'m2sq',techV:'bsf_mc',wireV:'f15x20',busV:'b6x40',glassFV:'g32no',rearV:'bsTPT',encFV:'EVAold',encRV:'EVAold',frameV:'al35',jboxV:'one2',cableV:'c25_900',insV:'tpt',fluxV:'rma',packV:'horiz'},set:{half:false,nbb:3,wpad:1.4,nc:4,nr:9,gc:2,gs:3,eL:24,eW:14,ov:2}}
];
function fromTemplate(id){
  const d=defaults();const tp=TEMPLATES.find(t=>t.id===id)||TEMPLATES[0];
  cellFrom(d.p);
  for(const [k,v] of Object.entries(tp.lib))applyLib(d.p,k,v);
  for(const [k,v] of Object.entries(tp.set))if(k in SCH&&k!=='eta')d.p[k]=v;
  if(tp.set.eta)cellFrom(d.p,tp.set.eta);
  cellDerived(d.p);
  d.p.Rb=rearRb(d.p);d.p.Tf=(LIB.enc.items[d.p.encFV]||{T:99}).T;
  if(tp.auto){const r=evaluate(d.p,true);d.p.Lmax=Math.ceil(r.L)+2;d.p.Wmax=Math.ceil(r.W)+2;}
  // etiket gücü: ölçülen gücün ≥ %97,7'si etiketin üstünde kalacak şekilde (nominal − 2σ), sınıf adımına yuvarlanır
  if(tp.auto||!('Pplate' in tp.set)){const r=evaluate(d.p,true);const sg=Math.sqrt(d.p.sCTM**2+d.p.sMeas**2)/100;d.p.Pplate=Math.floor(r.P*(1-2*sg)/d.p.bin)*d.p.bin;}
  return {name:tp.l,p:d.p,t:d.t,tpl:tp.id};
}

/* ---- Durum ---- */
libApplyUser(LS.get('pvm.userlib'));
let S=(()=>{const dr=LS.get('pvm.draft');if(dr&&dr.p){const b=defaults();const p=Object.assign(b.p,dr.p);if(!dr.p.Vmp)p.Vmp=0;return {name:dr.name||'Tasarım',p:cellDerived(p),t:Object.assign(b.t,dr.t||{}),tpl:dr.tpl||''};}return fromTemplate(TEMPLATES[0].id);})();
let R=null,MC=null,DL=null;
let SAVED=LS.get('pvm.saved');
if(!Array.isArray(SAVED)){
  const a=fromTemplate('gg_tc_g12r'),b=fromTemplate('gg_tc_g12r');
  applyLib(b.p,'rearV','gc20');applyLib(b.p,'encFV','POE');applyLib(b.p,'wireV','r26');
  const c=fromTemplate('gg_tc_m10r');
  SAVED=[{id:'ex1',name:'G12R 132 · grid arka cam (örnek)',p:a.p,t:a.t,ex:true},{id:'ex2',name:'G12R 132 · şeffaf arka cam, POE, Ø0,26 tel (örnek)',p:b.p,t:b.t,ex:true},{id:'ex3',name:'M10R 144 · 0BB 20 tel (örnek)',p:c.p,t:c.t,ex:true}];
}
let CMP=LS.get('pvm.cmp')||{ref:'ex1',sel:['ex1','ex2','ex3']};

/* ---- Girdi alanları ---- */
const fmtIn=v=>typeof v==='number'?v.toLocaleString('tr-TR',{maximumFractionDigits:6,useGrouping:false}):v;
const parseNum=s=>{s=String(s).trim().replace(/\s/g,'').replace(',','.');return s===''?NaN:Number(s);};
function libOpts(s){const items=LIB[s.lib].items;return Object.entries(items).filter(([,it])=>!s.filter||s.filter(it)).map(([id,it])=>[id,it.l+(it.spec?' — '+it.spec:'')]);}
function rowHTML(s){
  const id='in-'+s.k,hint=s.hint?`<small>${esc(s.hint)}</small>`:'';
  if(s.type==='lib'||s.type==='sel'){
    const opts=(s.type==='lib'?libOpts(s):s.opts).map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
    return `<div class="row wide" data-row="${s.k}"><label for="${id}">${esc(s.l)}${hint}</label><select id="${id}" data-k="${s.k}">${opts}</select></div>`;
  }
  if(s.type==='calc')return `<div class="row" data-row="${s.k}"><label for="${id}">${esc(s.l)}${hint}</label><div class="val"><input type="text" id="${id}" data-k="${s.k}" data-calc="${s.d||2}" readonly tabindex="-1" class="calc"><span class="u">${esc(s.u)}</span></div><div></div></div>`;
  if(s.type==='text')return `<div class="row wide" data-row="${s.k}"><label for="${id}">${esc(s.l)}${hint}</label><input type="text" id="${id}" data-k="${s.k}" class="txt"></div>`;
  if(s.type==='bool')return `<div class="row" data-row="${s.k}"><label for="${id}">${esc(s.l)}${hint}</label><div class="val"><input type="checkbox" id="${id}" data-k="${s.k}"></div><div></div></div>`;
  const tol=s.tol!==undefined?`<div class="tol"><span>±</span><input type="text" inputmode="decimal" id="tol-${s.k}" data-tol="${s.k}" aria-label="${esc(s.l)} toleransı"></div>`:'<div></div>';
  return `<div class="row" data-row="${s.k}"><label for="${id}">${esc(s.l)}${hint}</label><div class="val"><input type="text" inputmode="decimal" id="${id}" data-k="${s.k}"><span class="u">${esc(s.u)}</span></div>${tol}</div>`;
}
function groupHTML(g,open){
  const items=SCHEMA.filter(s=>s.g===g&&s.k!=='cur');
  const hasTol=items.some(s=>s.tol!==undefined);
  return `<details class="grp" ${open?'open':''} data-grp="${g}"><summary><h3>${GROUPS[g]}</h3><small id="gs-${g}"></small></summary><div class="rows">${hasTol?'<div class="rowhead"><span></span><span>Değer</span><span>± Tol.</span></div>':''}${items.map(rowHTML).join('')}</div></details>`;
}
function buildInputs(){
  $('#inputsDesign').innerHTML=['cell','lay','int','mat','fr','lim'].map((g,i)=>groupHTML(g,i<2)).join('');
  $('#inputsCTM').innerHTML=groupHTML('ctm',false)+groupHTML('ds',false);
  $('#inputsMC').innerHTML=groupHTML('mc',true);
  $('#inputsMech').innerHTML=groupHTML('mech',false);
  $('#inputsCost').innerHTML=groupHTML('cost',false);
  $('#in-cur').innerHTML=SCH.cur.opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  $('#tplSel').innerHTML='<option value="">— Şablon seçin —</option>'+Object.entries(ERAS).map(([e,el])=>`<optgroup label="${esc(el)}">${TEMPLATES.filter(t=>t.era===e).map(t=>`<option value="${t.id}">${esc(t.l)}</option>`).join('')}</optgroup>`).join('');
}
function syncInputs(){
  for(const el of $$('[data-k]')){const k=el.dataset.k,v=S.p[k];
    if(el.type==='checkbox')el.checked=!!v;else if(el.tagName==='SELECT')el.value=v;else if(el.dataset.calc)el.value=f(v,+el.dataset.calc);else if(document.activeElement!==el){el.value=fmtIn(v);el.classList.remove('err');}}
  for(const el of $$('[data-tol]')){if(document.activeElement!==el){el.value=fmtIn(S.t[el.dataset.tol]??0);el.classList.remove('err');}}
  $('#in-name').value=S.name;
}
function onField(el){
  if(el.id==='tplSel'){if(el.value){const d=fromTemplate(el.value);S.p=d.p;S.t=d.t;S.name=d.name;S.tpl=d.tpl;syncInputs();schedule();}return;}
  if(el.id==='in-name'){S.name=el.value||'Tasarım';schedule();return;}
  if(el.dataset.tol){const v=parseNum(el.value);if(!(v>=0)){el.classList.add('err');return;}el.classList.remove('err');S.t[el.dataset.tol]=v;schedule(true);return;}
  const k=el.dataset.k;if(!k)return;
  const s=SCH[k];
  if(el.dataset.pk){const v=parseNum(el.value);if(!(v>=0)){el.classList.add('err');return;}el.classList.remove('err');S.p[k]=v;schedule(true);return;}
  if(!s)return;
  if(s.type==='text'){S.p[k]=el.value;schedule();return;}
  if(s.type==='bool'){S.p[k]=el.checked;}
  else if(s.type==='lib'){applyLib(S.p,k,el.value);syncInputs();}
  else if(s.type==='sel'){S.p[k]=el.value;}
  else{
    let v=parseNum(el.value);
    if(!Number.isFinite(v)||(s.min!==undefined&&v<s.min)||(s.max!==undefined&&v>s.max)){el.classList.add('err');return;}
    if(s.int)v=Math.round(v);
    el.classList.remove('err');S.p[k]=v;
    const A=cellAreaCm2(S.p);
    if(['Voc','Isc','Vmp','Imp','a','b','ch'].includes(k)){cellDerived(S.p);for(const c of ['P','eta','FF'])setVal(c);}
  }
  schedule(true);
}
function setVal(k){const el=$('#in-'+k);if(el)el.value=el.dataset.calc?f(S.p[k],+el.dataset.calc):fmtIn(S.p[k]);}
/* Hücre türetilmiş değerleri: Pmax = Vmpp·Impp, verim, FF */
function cellDerived(p){if(!(p.Vmp>0)&&p.P>0&&p.Imp>0)p.Vmp=+(p.P/p.Imp).toFixed(4);
  p.P=+(p.Vmp*p.Imp).toFixed(4);p.eta=+(p.P/(cellAreaCm2(p)*0.1)*100).toFixed(3);p.FF=+(p.P/(p.Voc*p.Isc)*100).toFixed(2);return p;}
document.addEventListener('input',e=>{const el=e.target;if(el.matches('input[type=text][data-k],input[data-tol],#in-name'))onField(el);});
document.addEventListener('change',e=>{const el=e.target;if(el.matches('select,input[type=checkbox]'))onField(el);});

let tmr=null;
function schedule(){clearTimeout(tmr);tmr=setTimeout(recompute,120);}
/* Monte Carlo girdiler değiştikçe kendiliğinden yeniden çalışır (Tolerans sekmesi açıkken) */
let mcTmr=null,mcKey='';
const mcInputKey=()=>JSON.stringify([S.p,S.t]);
function mcAuto(){const key=mcInputKey();if(MC&&key===mcKey)return;
  if($('[data-panel="tolerans"]').hidden){if(key!==mcKey)MC=null;return;}
  clearTimeout(mcTmr);$('#mcState').textContent='Hesaplanıyor…';
  mcTmr=setTimeout(()=>{const t0=performance.now();MC=runMC(S.p,S.t);MC.ms=performance.now()-t0;mcKey=key;renderMC();},250);}

/* ---- Hesap + çizim ---- */
function recompute(){
  R=evaluate(S.p);
  LS.set('pvm.draft',{name:S.name,p:S.p,t:S.t,tpl:S.tpl});
  renderKPI();renderSummary();renderMini();renderViol();renderDrawings();renderCTM();renderCost();renderCompare();
  mcAuto();
  for(const r of $$('.row[data-row]'))r.classList.toggle('bad',R.bad.has(r.dataset.row));
  $('#gs-cell').textContent=`${S.p.tech} · ${f(S.p.a,1)}×${f(S.p.b,1)} · ${f(S.p.P,2)} W`;
  $('#gs-lay').textContent=`${R.N} parça · ${R.nc}×${R.nr}${R.half?' half-cut':''}`;
}
function renderKPI(){
  const c=S.p.cur,nv=R.viol.length;
  $('#hdrName').textContent=S.name;
  $('#kpis').innerHTML=[
    ['Pmax',f(R.P,1)+' W'],['Verim',f(R.eta,2)+' %'],['CTM',f(R.CTM,2)+' %'],[c+'/W',f(R.bom.perW,4)],
    ['Boyut',`${f(R.L,0)}×${f(R.W,0)}`]].map(([i,b])=>`<div class="kpi"><i>${i}</i><b>${b}</b></div>`).join('')+
    `<div class="kpi"><i>Sınırlar</i>${nv?`<span class="chip bad">● ${nv} ihlal</span>`:'<span class="chip good">● uygun</span>'}</div>`;
}
function renderSummary(){
  const m=R.mass;
  $('#sumStats').innerHTML=[
    ['Modül Pmax',f(R.P,1)+' W',1],['Modül verimi',f(R.eta,2)+' %',1],['CTM oranı',f(R.CTM,2)+' %'],
    ['Modül (dış)',`${f(R.L,1)} × ${f(R.W,1)} mm`],['Cam',`${f(R.Lg,1)} × ${f(R.Wg,1)} mm`],['Modül alanı',f(R.Amod/1e6,3)+' m²'],
    ['Hücre alanı',f(R.Acells/1e6,3)+' m²'],['Aktif alan oranı',f(R.AAR,2)+' %'],['Ağırlık',f(m.total,1)+' kg'],
    ['Ağırlık / alan',f(m.total/(R.Amod/1e6),1)+' kg/m²'],['Maliyet',S.p.cur+f(R.bom.total,2)],[S.p.cur+'/W',f(R.bom.perW,4)]
  ].map(([i,b,h])=>`<div class="stat${h?' hl':''}"><i>${i}</i><b>${b}</b></div>`).join('');
}
function renderMini(){
  const st=R.steps.filter(s=>Math.abs(s.k-1)>1e-9);
  $('#ctmMini').innerHTML=`<div class="mrow h"><span>Σ hücre gücü <small>${R.N} × ${f(R.Pcells/R.N,3)} W</small></span><b>${f(R.Pcells,1)} W</b></div>`+
    st.map(s=>`<div class="mrow"><span>${esc(s.l)}</span><b class="${s.dW>=0?'pos':'neg'}">${fs(s.dW,1)} W</b></div>`).join('')+
    `<div class="mrow t"><span>Modül Pmax · CTM ${f(R.CTM,2)} %</span><b>${f(R.P,1)} W</b></div>`;
}
$('#measApply').onclick=()=>{const v=parseNum($('#measP').value),m=$('#measOut');
  if(!(v>0)){m.className='msg er';m.textContent='Geçerli bir güç girin (W).';return;}
  const base=R.P/S.p.kCal,old=R.P,k=v/base;
  if(k<0.8||k>1.2){m.className='msg er';m.textContent=`Ölçüm modelden %${f(Math.abs(k-1)*100,1)} farklı. Hücre gücünü, dizilimi ve malzemeleri kontrol edin; kalibrasyon ±%20 ile sınırlıdır.`;return;}
  S.p.kCal=+k.toFixed(4);syncInputs();schedule();
  m.className='msg ok';m.textContent=`k_kal = ${f(k,4)} uygulandı (model ${f(old,1)} W → ${f(v,1)} W, fark ${fs((v/old-1)*100,2)} %). Bu çarpan tüm tasarım varyantlarına uygulanır; ayrıntılı kalibrasyon CTM sekmesinde.`;};
function renderViol(){
  const html=R.viol.length?R.viol.map(v=>`<div>${esc(v.m)}</div>`).join(''):'<p class="okmsg">Tüm sınır kontrolleri uygun.</p>';
  $('#violBox').innerHTML=html;
  $('#violBox2').innerHTML=html+`<p class="note">Kontrol edilen: yan kenar ≥ ${f(S.p.eMin,1)} mm (hücre), üst/alt kenar ≥ ${f(S.p.eMin,1)} mm (bus ribbon), boşluk alt sınırları, maks. dış ölçüler. Bus ribbon–cam kenarı nominal: ${f(R.eBus,2)} mm.</p>`;
}

/* ---- SVG çizim ---- */
function arrow(x,y,dx,dy,len){const px=-dy,py=dx,w=len*0.32;return `<polygon points="${x},${y} ${x-dx*len+px*w},${y-dy*len+py*w} ${x-dx*len-px*w},${y-dy*len-py*w}"/>`;}
function dimH(x1,x2,yF,yL,label,ts,sw,bad){
  const s=yL<yF?-1:1,ext=ts*0.35,len=ts*0.45,inside=(x2-x1)>2.6*len;
  let g=`<g class="dim${bad?' bad':''}" stroke-width="${sw}"><line x1="${x1}" y1="${yF}" x2="${x1}" y2="${yL+s*ext}"/><line x1="${x2}" y1="${yF}" x2="${x2}" y2="${yL+s*ext}"/>`;
  if(inside)g+=`<line x1="${x1}" y1="${yL}" x2="${x2}" y2="${yL}"/>`+arrow(x1,yL,-1,0,len)+arrow(x2,yL,1,0,len);
  else g+=`<line x1="${x1-2.2*len}" y1="${yL}" x2="${x2+2.2*len}" y2="${yL}"/>`+arrow(x1,yL,1,0,len)+arrow(x2,yL,-1,0,len);
  return g+`<text x="${(x1+x2)/2}" y="${yL-ts*0.38}" font-size="${ts}" text-anchor="middle" stroke="none">${label}</text></g>`;
}
function dimV(y1,y2,xF,xL,label,ts,sw,bad){
  const s=xL<xF?-1:1,ext=ts*0.35,len=ts*0.45,inside=(y2-y1)>2.6*len;
  let g=`<g class="dim${bad?' bad':''}" stroke-width="${sw}"><line x1="${xF}" y1="${y1}" x2="${xL+s*ext}" y2="${y1}"/><line x1="${xF}" y1="${y2}" x2="${xL+s*ext}" y2="${y2}"/>`;
  if(inside)g+=`<line x1="${xL}" y1="${y1}" x2="${xL}" y2="${y2}"/>`+arrow(xL,y1,0,-1,len)+arrow(xL,y2,0,1,len);
  else g+=`<line x1="${xL}" y1="${y1-2.2*len}" x2="${xL}" y2="${y2+2.2*len}"/>`+arrow(xL,y1,0,1,len)+arrow(xL,y2,0,-1,len);
  const tx=xL-ts*0.38*(s<0?1:-1)*(s<0?1:-1)-ts*0.38,ty=(y1+y2)/2;
  return g+`<text x="${xL-ts*0.38}" y="${ty}" font-size="${ts}" text-anchor="middle" stroke="none" transform="rotate(-90 ${xL-ts*0.38} ${ty})">${label}</text></g>`;
}
function geom(){
  const p=S.p,X0=R.fc+p.eW,Y0=R.fc+p.eL;
  const rowY=i=>i<R.up?Y0+i*(R.h+p.gc):Y0+R.up*R.h+(R.up-1)*p.gc+R.gmUse+(i-R.up)*(R.h+p.gc);
  const colX=j=>X0+j*(p.a+p.gs);
  return {X0,Y0,rowY,colX};
}
function scene(detail){
  const p=S.p,{X0,Y0,rowY,colX}=geom();let s='';
  if(R.fc>0)s+=`<rect class="c-frame" x="0" y="0" width="${R.W}" height="${R.L}"/>`;
  s+=`<rect class="c-glass" x="${R.fc}" y="${R.fc}" width="${R.Wg}" height="${R.Lg}"/>`;
  // ihlal bölgeleri
  const z=(x,y,w,h)=>`<rect class="c-badz" x="${x}" y="${y}" width="${w}" height="${h}" stroke-width="${detail?0.15:3}"/>`;
  if(R.bad.has('eW')){s+=z(R.fc,R.fc,p.eW,R.Lg)+z(R.fc+R.Wg-p.eW,R.fc,p.eW,R.Lg);}
  if(R.bad.has('eL')){const e=Math.max(p.eL-p.bg-p.bw,0.01);s+=z(R.fc,R.fc,R.Wg,e)+z(R.fc,R.fc+R.Lg-e,R.Wg,e);}
  const h=R.h;
  const c=p.ch>0?Math.min(p.ch,p.a/2,h/2):0;
  for(let j=0;j<R.nc;j++)for(let i=0;i<R.nr;i++){const x=colX(j),y=rowY(i);
    if(!c){s+=`<rect class="c-cell" x="${x}" y="${y}" width="${p.a}" height="${h}"/>`;continue;}
    // psödo-kare pah: tam hücrede 4 köşe, yarım hücrede dış kenardaki 2 köşe
    const tp=!R.half||i%2===0,bt=!R.half||i%2===1,ct=tp?c:0,cb=bt?c:0,x2=x+p.a,y2=y+h;
    s+=`<polygon class="c-cell" points="${x+ct},${y} ${x2-ct},${y} ${x2},${y+ct} ${x2},${y2-cb} ${x2-cb},${y2} ${x+cb},${y2} ${x},${y2-cb} ${x},${y+ct}"/>`;}
  // teller (BC'de önde tel yok)
  if(p.tech!=='BC'&&p.tech!=='MWT'){
    const pitch=p.a/p.nbb;const segs=R.half&&R.lo>0?[[rowY(0),rowY(R.up-1)+h],[rowY(R.up),rowY(R.nr-1)+h]]:[[rowY(0),rowY(R.nr-1)+h]];
    for(let j=0;j<R.nc;j++)for(let k=0;k<p.nbb;k++){const x=colX(j)+pitch*(k+0.5);
      for(const [y1,y2] of segs){
        if(detail)s+=`<rect class="c-wiref" x="${x-p.dw/2}" y="${y1+p.ov}" width="${p.dw}" height="${y2-y1-2*p.ov}"/>`;
        else s+=`<line class="c-wire" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke-width="0.6" vector-effect="non-scaling-stroke" opacity="0.55"/>`;}}
  }
  // bus ribbon (ön, üst/alt)
  const yb1=Y0-p.bg-p.bw,yb2=Y0+R.blockL+p.bg;
  s+=`<rect class="c-bus" x="${X0}" y="${yb1}" width="${R.blockW}" height="${p.bw}"/><rect class="c-bus" x="${X0}" y="${yb2}" width="${R.blockW}" height="${p.bw}"/>`;
  // arka: orta bus ve J-box'lar (kesikli)
  const swr=detail?0.12:2.2;
  if(R.half&&R.lo>0){const ym=rowY(R.up)-R.gmUse/2;s+=`<line class="c-rear" x1="${X0}" y1="${ym}" x2="${X0+R.blockW}" y2="${ym}" stroke-width="${swr}"/>`;
    const nj=p.nJB;for(let k=0;k<nj;k++){const cx=X0+R.blockW*(nj===1?0.5:(k*2+1)/(nj*2));s+=`<rect class="c-rear" x="${cx-45}" y="${ym-35}" width="90" height="70" stroke-width="${swr}"/>`;}}
  else{const nj=p.nJB;const ym=R.fc+p.eL+120;for(let k=0;k<nj;k++){const cx=X0+R.blockW*(nj===1?0.5:(k*2+1)/(nj*2));s+=`<rect class="c-rear" x="${cx-45}" y="${ym-35}" width="90" height="70" stroke-width="${swr}"/>`;}}
  return s;
}
function renderDrawings(){
  const p=S.p,ts=46,sw=2.4,M=ts*3.6;
  const {X0,Y0,rowY,colX}=geom();
  let d=scene(false);
  d+=dimH(0,R.W,0,-ts*1.6,'Dış '+f(R.W,1),ts,sw,R.bad.has('W'));
  d+=dimH(R.fc,R.fc+R.Wg,R.L,R.L+ts*1.6,'Cam '+f(R.Wg,1),ts,sw,false);
  d+=dimV(0,R.L,0,-ts*1.6,'Dış '+f(R.L,1),ts,sw,R.bad.has('L'));
  d+=dimV(R.fc,R.fc+R.Lg,R.W,R.W+ts*1.6,'Cam '+f(R.Lg,1),ts,sw,false);
  // detay işaretleri
  const call=(x,y,r,t)=>`<circle class="c-call" cx="${x}" cy="${y}" r="${r}" stroke-width="3"/><text class="call" x="${x+r*0.75}" y="${y-r*0.75}" font-size="${ts*0.9}">${t}</text>`;
  d+=call(R.fc+p.eW/2+10,R.fc+p.eL/2+10,70,'A');
  d+=call(colX(1)-p.gs/2,rowY(1)-p.gc/2,40,'B');
  if(R.half&&R.lo>0)d+=call(colX(1)-p.gs/2,rowY(R.up)-R.gmUse/2,40,'C');
  const vb=`${-M} ${-M} ${R.W+2*M} ${R.L+2*M}`;
  const svg=cls=>`<svg class="${cls}" viewBox="${vb}" role="img" aria-label="Modül üstten görünüm, ${f(R.L,1)} × ${f(R.W,1)} mm">${d}</svg>`;
  if($('#drawMain'))$('#drawMain').innerHTML=svg('main');$('#drawSide').innerHTML=svg('main');
  // detaylar
  const det=(id,title,x0,y0,w,h,dims)=>{const ts2=w/11,sw2=ts2*0.07,m=ts2*3.4;
    return `<figure><figcaption>${title}</figcaption><svg viewBox="${x0-m} ${y0-m} ${w+2*m} ${h+2*m}" role="img" aria-label="${title}"><defs><clipPath id="cp-${id}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#cp-${id})">${scene(true)}</g><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="var(--line)" stroke-width="${sw2}"/>${dims(ts2,sw2,m)}</svg></figure>`;};
  let html='';
  const wA=Math.max(R.fc+p.eW+22,30),hA=Math.max(R.fc+p.eL+22,30);
  html+=det('A','DETAY A · köşe',0,0,wA,hA,(t,sw2)=>{
    let g=dimH(0,R.fc,0,-t*1.5,f(R.fc,1),t,sw2,false)+dimH(R.fc,R.fc+p.eW,0,-t*1.5,f(p.eW,2),t,sw2,R.bad.has('eW'));
    const yb=R.fc+p.eL-p.bg-p.bw;
    g+=dimV(0,R.fc,0,-t*1.5,f(R.fc,1),t,sw2,false)+dimV(R.fc,yb,0,-t*1.5,f(yb-R.fc,2),t,sw2,R.bad.has('eL'));
    g+=dimV(yb,yb+p.bw,wA,wA+t*1.5,f(p.bw,1),t,sw2,false)+dimV(yb+p.bw,R.fc+p.eL,wA,wA+t*1.5,f(p.bg,1),t,sw2,false);
    g+=dimV(R.fc,R.fc+p.eL,wA,wA+t*3.0,'e '+f(p.eL,1),t,sw2,false);return g;});
  const bx=colX(1)-p.gs/2,by=rowY(1)-p.gc/2,wB=Math.max(p.gs*6,16),hB=Math.max(p.gc*8,12);
  html+=det('B','DETAY B · hücre aralıkları',bx-wB/2,by-hB/2,wB,hB,(t,sw2)=>
    dimH(colX(1)-p.gs,colX(1),by-hB/2,by-hB/2-t*1.5,'g_s '+f(p.gs,2),t,sw2,R.bad.has('gs'))+
    dimV(rowY(1)-p.gc,rowY(1),bx-wB/2,bx-wB/2-t*1.5,'g '+f(p.gc,2),t,sw2,R.bad.has('gc')));
  if(R.half&&R.lo>0){const cy=rowY(R.up)-R.gmUse/2,wC=Math.max(p.gs*6,16),hC=Math.max(R.gmUse*2.5,12);
    html+=det('C','DETAY C · orta boşluk',bx-wC/2,cy-hC/2,wC,hC,(t,sw2)=>dimV(rowY(R.up)-R.gmUse,rowY(R.up),bx-wC/2,bx-wC/2-t*1.5,'g_m '+f(R.gmUse,2),t,sw2,R.bad.has('gm')));}
  if($('#drawDetails'))$('#drawDetails').innerHTML=html+`<p class="note" style="grid-column:1/-1">Hücre parçası ${f(p.a,1)} × ${f(R.h,2)} mm · ${(p.tech!=='BC'&&p.tech!=='MWT')?`${p.nbb} tel, ${f(p.dw,2)} mm`:p.tech+': ön yüzde tel yok'} · Hücre bloğu ${f(R.blockW,1)} × ${f(R.blockL,1)} mm</p>`;
}

/* ---- CTM ---- */
function renderCTM(){
  $('#ctmStats').innerHTML=[['Σ Hücre gücü',f(R.Pcells,1)+' W'],['Modül Pmax',f(R.P,1)+' W',1],['CTM oranı',f(R.CTM,2)+' %',1],['Modül verimi',f(R.eta,2)+' %'],['Cam alanı verimi',f(R.etaG,2)+' %'],['Hücre sayısı',`${R.N} parça (${R.Nfull} tam)`]]
    .map(([i,b,h])=>`<div class="stat${h?' hl':''}"><i>${i}</i><b>${b}</b></div>`).join('');
  const st=R.steps.filter(s=>Math.abs(s.k-1)>1e-9);
  const mx=Math.max(...st.map(s=>Math.abs(s.dPct)),0.5);
  let h='<div class="h">Faktör</div><div class="h">Δ (%)</div><div class="h" style="text-align:right">k</div><div class="h w" style="text-align:right">ΔW</div>';
  for(const s of st){const w=Math.abs(s.dPct)/mx*50;
    h+=`<div class="lbl">${esc(s.l)}<small>${esc(s.note)}</small></div><div class="barw"><span class="${s.dPct>=0?'g':'l'}" style="width:${w}%"></span></div><div class="v">${f(s.k,4)}</div><div class="v w ${s.dW>=0?'':''}">${fs(s.dW,2)}</div>`;}
  h+=`<div class="lbl sum">Toplam CTM</div><div class="sum v" style="text-align:left">${fs(R.CTM-100,2)} %</div><div class="v sum">${f(R.CTM/100,4)}</div><div class="v w sum">${fs(R.P-R.Pcells,1)}</div>`;
  $('#chain').innerHTML=h;
  const tr=(a,b)=>`<tr><td>${a}</td><td class="n">${b}</td></tr>`;
  $('#elecTbl').innerHTML=tr('Pmax',f(R.P,1)+' W')+tr('Voc',f(R.Voc,2)+' V')+tr('Isc',f(R.Isc,2)+' A')+tr('Vmp',f(R.Vmp,2)+' V')+tr('Imp',f(R.Imp,2)+' A')+tr('Dolum faktörü (FF)',f(R.FF*100,2)+' %')+tr('Bağlantı',`${R.Ns} seri × ${R.Np} paralel`)+tr('Voc @ −10 °C (dizi hesabı)',f(R.ds.Voc_m10,1)+' V');
  const d=R.ds,y=S.p.yrs;
  $('#dsTbl').innerHTML=tr('Pmax sıcaklık katsayısı γ',f(S.p.tc,2)+' %/°C')+tr('Voc katsayısı β / Isc katsayısı α',`${f(S.p.bVoc,2)} / ${fs(S.p.aIsc,3)} %/°C`)
    +tr(`P<sub>NMOT</sub> (800 W/m², ${f(S.p.NMOT,0)} °C)`,f(d.P_NMOT,1)+' W')+tr('Modül bifasiyalliği φ<sub>mod</sub>',d.phi>0?f(d.phi*100,1)+' %':'tek yüzlü')
    +(d.phi>0?tr(`P<sub>BNPI</sub> (1000 + ${f(S.p.Grear,0)} W/m²)`,f(d.P_BNPI,1)+' W')+tr('Arka kazanç +%10 / +%20 / +%30',`${f(d.P_b10,0)} / ${f(d.P_b20,0)} / ${f(d.P_b30,0)} W`):'')
    +tr('Garanti: 1. yıl / '+y+'. yıl',`${f(d.y1,1)} % / ${f(d.yN,1)} % (${f(R.P*d.yN/100,0)} W)`)+tr('Gümüş (hücrelerde)',f(d.agG,2)+' g/modül');
  $('#ctmDetail').innerHTML=tr('Tel akımı I_w',f(R.Iw,3)+' A')+tr('Tel kesiti',f(R.Aw,4)+' mm²')+tr('Tel R′',f(R.Rw*1000,1)+' mΩ/m')+tr('Hücre üstü tel boyu ℓ',f(R.lOn,1)+' mm')
    +tr('Tel kaybı',f(R.Pw,2)+' W')+tr('Bus R′',f(R.Rbus*1000,2)+' mΩ/m')+tr('Bus kaybı',f(R.Pbus,2)+' W')+tr('Kablo direnci (2 kutup)',f(R.Rcab*1000,2)+' mΩ')
    +tr('J-box/kablo kaybı',f(R.Pj,2)+' W')+tr('Etkin gap alanı',f(R.Agap/1e6,4)+' m² ('+f(R.Agap/R.Acells*100,2)+' %)')+tr('Arka yansıtma R_arka',f(S.p.Rb,2))+tr('Mismatch δ',f(R.dmm,2)+' %');
}
let calK=null;
$('#calSample').onclick=()=>{const base=R.Pcells;const r=mulberry32(7);let t='';for(let i=0;i<12;i++){const c=base*(1+(r()-0.5)*0.01);t+=`${f(c,1)} ; ${f(c*0.962*(1+(r()-0.5)*0.008),1)}\n`;}$('#calData').value=t.trim();$('#calOut').textContent='Örnek veri yüklendi (gerçek ölçüm değil).';};
$('#calRun').onclick=()=>{
  const rows=$('#calData').value.split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(/[;\t|]/).map(parseNum));
  const pts=[];for(const r of rows){if(r.length>=2&&r[0]>0&&r[1]>0)pts.push([r[0],r[1]]);else if(r.length===1&&r[0]>0)pts.push([R.Pcells,r[0]]);}
  if(pts.length<1){$('#calOut').innerHTML='<span style="color:var(--bad)">Geçerli satır bulunamadı. Biçim: ΣHücre_W ; Modül_W</span>';calK=null;$('#calApply').disabled=true;return;}
  const ctm0=R.CTM/100/S.p.kCal;const meas=pts.map(([c,m])=>m/c);const st=stats(meas);
  calK=st.mean/ctm0;
  const rm=k=>Math.sqrt(pts.reduce((s,[c,m])=>s+(m-c*ctm0*k)**2,0)/pts.length);
  $('#calOut').innerHTML=`n = ${pts.length} · ölçülen CTM ort. <b>${f(st.mean*100,2)} %</b> (σ ${f(st.sd*100,2)} %) · model CTM (k_kal hariç) ${f(ctm0*100,2)} %<br>Önerilen k_kal = <b class="mono">${f(calK,4)}</b> · RMSE: mevcut ${f(rm(S.p.kCal),2)} W → kalibre ${f(rm(calK),2)} W`;
  $('#calApply').disabled=false;};
$('#calApply').onclick=()=>{if(calK){S.p.kCal=+calK.toFixed(4);syncInputs();schedule(true);$('#calApply').disabled=true;$('#calOut').insertAdjacentHTML('beforeend','<br><span style="color:var(--good)">k_kal uygulandı.</span>');}};

/* ---- Monte Carlo ---- */
$('#mcRun').onclick=()=>{mcKey='';MC=null;mcAuto();};
function hist(arr,st,o){
  const W=420,H=200,ml=34,mr=10,mt=14,mb=34,nb=36;
  let lo=st.min,hi=st.max;if(o.marks)for(const m of o.marks){lo=Math.min(lo,m.x);hi=Math.max(hi,m.x);}
  const pad=(hi-lo)*0.04||1;lo-=pad;hi+=pad;
  const bw=(hi-lo)/nb,cnt=new Array(nb).fill(0);for(const x of arr){let i=Math.floor((x-lo)/bw);if(i>=nb)i=nb-1;if(i<0)i=0;cnt[i]++;}
  const cm=Math.max(...cnt),X=x=>ml+(x-lo)/(hi-lo)*(W-ml-mr),Y=c=>H-mb-c/cm*(H-mt-mb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title)} histogramı">`;
  s+=`<line class="axis" x1="${ml}" y1="${H-mb}" x2="${W-mr}" y2="${H-mb}"/>`;
  for(let i=0;i<nb;i++)if(cnt[i])s+=`<rect class="bar" x="${X(lo+i*bw)+0.5}" y="${Y(cnt[i])}" width="${Math.max((W-ml-mr)/nb-1,0.5)}" height="${H-mb-Y(cnt[i])}"/>`;
  const ticks=5;for(let i=0;i<=ticks;i++){const v=lo+(hi-lo)*i/ticks;s+=`<text x="${X(v)}" y="${H-mb+14}" text-anchor="middle">${f(v,o.dec)}</text>`;}
  s+=`<text x="${(ml+W-mr)/2}" y="${H-4}" text-anchor="middle">${esc(o.unit)}</text>`;
  s+=`<text x="4" y="${mt}" >n</text><text x="${ml-4}" y="${Y(cm)+4}" text-anchor="end">${cm}</text>`;
  for(const m of o.marks||[])s+=`<line class="${m.cls}" x1="${X(m.x)}" y1="${mt}" x2="${X(m.x)}" y2="${H-mb}"/><text x="${X(m.x)+3}" y="${mt+10}" style="fill:${m.cls==='mk'?'var(--bad)':'var(--fg)'}">${esc(m.l)}</text>`;
  return s+'</svg>';
}
function pill(p){const ppm=p*1e6;const c=p<0.0027?'good':p<0.01?'warn':'bad';return `<span class="pill ${c}">${p<0.0001&&p>0?f(ppm,0)+' ppm':f(p*100,2)+' %'}</span>`;}
function renderMC(){
  const p=MC.p,sP=stats(MC.P),sE=stats(MC.E),sS=stats(MC.eS),sB=stats(MC.eB),sL=stats(MC.Ls),sW=stats(MC.Ws);
  const cpkL=(st,mn)=>(st.mean-mn)/(3*st.sd),cpkU=(st,mx)=>(mx-st.mean)/(3*st.sd);
  const bins={};for(const x of MC.P){const b=Math.floor(x/p.bin)*p.bin;bins[b]=(bins[b]||0)+1;}
  const binRows=Object.keys(bins).map(Number).sort((a,b)=>b-a).map(b=>`<tr><td>${f(b,p.bin%1?1:0)} W</td><td class="n">${f(bins[b]/MC.n*100,2)} %</td><td><span class="share" style="width:${bins[b]/MC.n*160}px"></span></td></tr>`).join('');
  const pr=MC.prob;
  const pr_=(l,v,extra='')=>`<tr><td>${l}</td><td class="n">${pill(v)}</td><td class="n">${extra}</td></tr>`;
  $('#mcState').textContent=`${f(MC.n,0)} iterasyon · ${f(MC.ms,0)} ms · girdiler değiştikçe yenilenir`;
  $('#mcOut').innerHTML=`
  <div class="recbox"><div><i>Önerilen etiket gücü</i><b>${f(MC.plateRec,0)} W</b><small>Modüllerin ≥ %97,7’si bu değerin üstünde (P<sub>2,3</sub> = ${f(sP.sorted[Math.floor(0.0228*(MC.n-1))],1)} W, ${f(p.bin,0)} W adım)</small></div>
    ${MC.plateRec!==p.Pplate?`<button class="btn sm pri" id="plateApply">Etiketi ${f(MC.plateRec,0)} W yap</button>`:'<span class="chip good">● etiket gücü önerilenle aynı</span>'}</div>
  <div class="stats">
    <div class="stat hl"><i>Pmax ort. ± σ</i><b>${f(sP.mean,1)} ± ${f(sP.sd,2)} W</b></div>
    <div class="stat"><i>Pmax P5 / P95</i><b>${f(sP.p5,1)} / ${f(sP.p95,1)}</b></div>
    <div class="stat hl"><i>Verim ort. ± σ</i><b>${f(sE.mean,2)} ± ${f(sE.sd,3)} %</b></div>
    <div class="stat"><i>Etiket altı (&lt; ${f(p.Pplate,0)} W)</i><b>${f(pr.Pplate*100,2)} %</b></div>
    <div class="stat"><i>Ölçü veya kenar ihlali</i><b>${f(pr.dimAny*100,2)} %</b></div>
    <div class="stat"><i>Süre</i><b>${f(MC.n,0)} it. · ${f(MC.ms,0)} ms</b></div>
  </div>
  <div class="grid2">
    <div class="hist"><h3>Pmax dağılımı</h3>${hist(MC.P,sP,{title:'Pmax',unit:'W',dec:0,marks:[{x:p.Pplate,l:'etiket',cls:'mk'},{x:sP.mean,l:'ort.',cls:'mk2'}]})}</div>
    <div class="hist"><h3>Modül verimi dağılımı</h3>${hist(MC.E,sE,{title:'Verim',unit:'%',dec:2,marks:[{x:sE.mean,l:'ort.',cls:'mk2'}]})}</div>
  </div>
  <div class="grid2">
    <div><h3>Sınır ihlali olasılıkları</h3><div class="tw"><table><tr><th>Kontrol</th><th class="n">Olasılık</th><th class="n">Cpk</th></tr>
      ${pr_(`Yan kenar < ${f(p.eMin,1)} mm`,pr.eSide,f(cpkL(sS,p.eMin),2))}
      ${pr_(`Bus–cam kenarı < ${f(p.eMin,1)} mm`,pr.eBus,f(cpkL(sB,p.eMin),2))}
      ${pr_(`Modül boyu > ${f(p.Lmax,0)} mm`,pr.L,f(cpkU(sL,p.Lmax),2))}
      ${pr_(`Modül genişliği > ${f(p.Wmax,0)} mm`,pr.W,f(cpkU(sW,p.Wmax),2))}
      ${pr_(`Herhangi bir hücre boşluğu < ${f(p.gcMin,2)} mm`,pr.gc,'analitik')}
      ${pr_(`Herhangi bir string aralığı < ${f(p.gsMin,2)} mm`,pr.gs,'analitik')}
      ${R.half?pr_(`Orta boşluk < ${f(p.gmMin,2)} mm`,pr.gm,'analitik'):''}
      ${pr_(`Pmax < etiket ${f(p.Pplate,0)} W`,pr.Pplate,'')}
    </table></div>
    <p class="note">Yeşil &lt; 0,27 % (≈3σ), sarı &lt; 1 %, kırmızı ≥ 1 %. Boşluk ihlalleri her boşluğun bağımsız olduğu varsayımıyla 1 − (1 − p)<sup>n</sup> formülünden hesaplanır.</p></div>
    <div><h3>Güç sınıfı dağılımı</h3><div class="tw"><table><tr><th>Sınıf</th><th class="n">Pay</th><th></th></tr>${binRows}</table></div>
    <p class="note">Kenar mesafesi ort.: yan ${f(sS.mean,2)} mm (σ ${f(sS.sd,2)}), bus–kenar ${f(sB.mean,2)} mm (σ ${f(sB.sd,2)}). Dış ölçü ort. ${f(sL.mean,1)} × ${f(sW.mean,1)} mm.</p></div>
  </div>`;
}

/* ---- Maliyet ---- */
function renderCost(){
  const b=R.bom,c=S.p.cur;
  const top=[...b.lines].sort((x,y)=>y.cost-x.cost)[0];
  $('#costStats').innerHTML=[['Modül maliyeti',c+f(b.total,2),1],[c+'/W',f(b.perW,4),1],['Malzeme (BOM)',c+f(b.mat,2)],['Üretim giderleri',c+f(b.sub-b.mat,2)],['Yield karşılığı',c+f(b.yieldLoss,2)],['En büyük kalem',`${top.l} · ${f(top.cost/b.total*100,1)} %`]]
    .map(([i,v,h])=>`<div class="stat${h?' hl':''}"><i>${i}</i><b>${esc(v)}</b></div>`).join('');
  let h=`<tr><th>Kalem</th><th class="n">Miktar</th><th class="n">Birim fiyat</th><th class="n">Fire %</th><th class="n">Tutar</th><th class="n">Pay</th></tr>`;let g='';
  for(const x of b.lines){
    if(x.g!==g){g=x.g;const gs=b.lines.filter(y=>y.g===g).reduce((s,y)=>s+y.cost,0);h+=`<tr class="grp"><td colspan="4">${esc(g)}</td><td class="n">${c}${f(gs,2)}</td><td class="n">${f(gs/b.total*100,1)} %</td></tr>`;}
    const qd=x.q<0.1?4:x.q<10?3:1;
    h+=`<tr><td>${esc(x.l)}<br><small>${esc(x.spec)}</small></td><td class="n">${f(x.q,qd)} ${esc(x.u)}</td>
      <td class="n"><input type="text" inputmode="decimal" data-k="pr_${x.id}" data-pk="1" value="${fmtIn(+x.price.toFixed(4))}" aria-label="${esc(x.l)} birim fiyat"><br><small>${esc(x.pu)}</small></td>
      <td class="n"><input type="text" inputmode="decimal" data-k="fw_${x.id}" data-pk="1" value="${fmtIn(x.w)}" aria-label="${esc(x.l)} fire" style="width:3.6rem"></td>
      <td class="n">${c}${f(x.cost,3)}</td><td class="n">${f(x.cost/b.total*100,1)} %</td></tr>`;
  }
  h+=`<tr class="grp"><td colspan="4">Üretim verimi ${f(S.p.yield,1)} % karşılığı</td><td class="n">${c}${f(b.yieldLoss,2)}</td><td class="n">${f(b.yieldLoss/b.total*100,1)} %</td></tr>`;
  h+=`<tr class="tot"><td colspan="4">Toplam (modül başı) · ${f(R.P,1)} W</td><td class="n">${c}${f(b.total,2)}</td><td class="n">${f(b.perW,4)} ${c}/W</td></tr>`;
  const active=document.activeElement;const ak=active&&active.dataset?active.dataset.k:null;const sel=ak&&active.selectionStart;
  $('#bomTbl').innerHTML=h;
  if(ak&&ak.match(/^(pr|fw)_/)){const el=$(`#bomTbl [data-k="${ak}"]`);if(el){el.focus();try{el.setSelectionRange(sel,sel);}catch(e){}}}
}


/* ---- Karşılaştırma ---- */
function saveLS(){LS.set('pvm.saved',SAVED);LS.set('pvm.cmp',CMP);}
$('#saveSlot').onclick=()=>{const id='d'+Date.now().toString(36);SAVED.push({id,name:S.name,p:JSON.parse(JSON.stringify(S.p)),t:JSON.parse(JSON.stringify(S.t)),at:new Date().toISOString()});CMP.sel.push(id);if(!SAVED.find(x=>x.id===CMP.ref))CMP.ref=id;saveLS();renderCompare();};
function renderCompare(){
  const list=$('#savedList');
  list.innerHTML=SAVED.length?SAVED.map(d=>`<div class="saved"><div><input type="checkbox" data-csel="${d.id}" ${CMP.sel.includes(d.id)?'checked':''} aria-label="Karşılaştır"> <input type="radio" name="cref" data-cref="${d.id}" ${CMP.ref===d.id?'checked':''} aria-label="Referans"></div>
    <div class="nm"><b>${esc(d.name)}${d.ex?'<span class="tag">örnek</span>':''}</b><small>${d.at?new Date(d.at).toLocaleString('tr-TR'):''}</small></div>
    <div class="btns"><button class="btn sm" data-cload="${d.id}">Yükle</button><button class="btn sm" data-cdel="${d.id}">Sil</button></div></div>`).join(''):'<p class="note">Kayıtlı tasarım yok. "Mevcut tasarımı kaydet" ile ekleyin.</p>';
  const ds=SAVED.filter(d=>CMP.sel.includes(d.id));
  if(!ds.length){$('#cmpTbl').innerHTML='<p class="note">Karşılaştırmak için en az bir tasarım işaretleyin.</p>';$('#cmpDiff').innerHTML='';return;}
  const ref=SAVED.find(d=>d.id===CMP.ref)||ds[0];
  const ev=d=>{const b=defaults();const p=cellDerived(Object.assign(b.p,d.p,d.p.Vmp?{}:{Vmp:0}));return {d,p,R:evaluate(p)};};
  const E=[ev(ref),...ds.filter(d=>d!==ref).map(ev)];
  const c=S.p.cur;
  const M=[['Pmax','W',1,r=>r.P,1],['Modül verimi','%',2,r=>r.eta,1],['CTM','%',2,r=>r.CTM,1],['Modül maliyeti',c,2,r=>r.bom.total,-1],[c+'/W','',4,r=>r.bom.perW,-1],
    ['Modül boyu','mm',1,r=>r.L,0],['Modül genişliği','mm',1,r=>r.W,0],['Alan','m²',3,r=>r.Amod/1e6,0],['Aktif alan oranı','%',2,r=>r.AAR,1],['Ağırlık','kg',1,r=>r.mass.total,-1],['Voc','V',2,r=>r.Voc,0],['Isc','A',2,r=>r.Isc,0],['Sınır ihlali','adet',0,r=>r.viol.length,-1]];
  let h=`<table><tr><th>Metrik</th>${E.map((e,i)=>`<th class="n">${i===0?'◉ ':''}${esc(e.d.name)}</th>`).join('')}</tr>`;
  for(const [l,u,d,fn,better] of M){const r0=fn(E[0].R);
    h+=`<tr><td>${esc(l)} <small>${esc(u)}</small></td>`+E.map((e,i)=>{const v=fn(e.R);if(i===0)return `<td class="n">${f(v,d)}</td>`;
      const dv=v-r0,cls=better===0||Math.abs(dv)<1e-12?'':(dv*better>0?'pos':'neg');
      return `<td class="n">${f(v,d)}<br><span class="${cls}" style="font-size:12px">${fs(dv,d)}${r0&&u!=='adet'?` (${fs(dv/r0*100,2)} %)`:''}</span></td>`;}).join('')+'</tr>';}
  $('#cmpTbl').innerHTML=h+'</table><p class="note">Δ değerleri referansa (◉) göredir. Yeşil daha iyi, turuncu daha kötü.</p>';
  // farklı girdiler
  const keys=SCHEMA.map(s=>s.k).filter(k=>!['n','seed','dist','bin','cur'].includes(k));
  const fmtV=(k,v)=>{const s=SCH[k];if(s.type==='lib')return (LIB[s.lib].items[v]||{l:v}).l;if(s.type==='bool')return v?'evet':'hayır';if(s.type==='sel')return v;return f(v,4).replace(/0+$/,'').replace(/,$/,'')+' '+s.u;};
  const rows=keys.filter(k=>E.some(e=>JSON.stringify(e.p[k])!==JSON.stringify(E[0].p[k])));
  $('#cmpDiff').innerHTML=rows.length?`<table><tr><th>Girdi</th>${E.map((e,i)=>`<th>${i===0?'◉ ':''}${esc(e.d.name)}</th>`).join('')}</tr>${rows.map(k=>`<tr><td>${esc(SCH[k].l)}</td>${E.map(e=>`<td>${esc(fmtV(k,e.p[k]))}</td>`).join('')}</tr>`).join('')}</table>`:'<p class="note">Seçili tasarımların girdileri aynı.</p>';
}
$('#savedList').addEventListener('click',e=>{const t=e.target;
  if(t.dataset.cload){const d=SAVED.find(x=>x.id===t.dataset.cload);if(d){const b=defaults();S={name:d.name,p:cellDerived(Object.assign(b.p,JSON.parse(JSON.stringify(d.p)),d.p.Vmp?{}:{Vmp:0})),t:Object.assign(b.t,d.t||{}),tpl:''};MC=null;mcKey='';syncInputs();recompute();go('tasarim');}}
  if(t.dataset.cdel){SAVED=SAVED.filter(x=>x.id!==t.dataset.cdel);CMP.sel=CMP.sel.filter(x=>x!==t.dataset.cdel);if(CMP.ref===t.dataset.cdel)CMP.ref=SAVED[0]?SAVED[0].id:'';saveLS();renderCompare();}});
$('#savedList').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.csel){if(t.checked){if(!CMP.sel.includes(t.dataset.csel))CMP.sel.push(t.dataset.csel);}else CMP.sel=CMP.sel.filter(x=>x!==t.dataset.csel);saveLS();renderCompare();}
  if(t.dataset.cref){CMP.ref=t.dataset.cref;if(!CMP.sel.includes(CMP.ref))CMP.sel.push(CMP.ref);saveLS();renderCompare();}});

/* ---- Kayıt: JSON / Excel ---- */
const designJSON=()=>({schema:'pv-modul-tasarim',version:1,name:S.name,saved:new Date().toISOString(),params:S.p,tolerances:S.t});
function loadDesign(o){
  if(!o||o.schema!=='pv-modul-tasarim'||!o.params)throw new Error('Bu dosya bir PV modül tasarımı değil (schema alanı eksik).');
  const b=defaults();S={name:o.name||'Yüklenen tasarım',p:cellDerived(Object.assign(b.p,o.params,o.params.Vmp?{}:{Vmp:0})),t:Object.assign(b.t,o.tolerances||{}),tpl:''};
  MC=null;mcKey='';syncInputs();recompute();
}
const TRMAP={ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u',Ç:'C',Ğ:'G',İ:'I',Ö:'O',Ş:'S',Ü:'U'};
const safeName=()=>(S.name||'tasarim').replace(/[çğıöşüÇĞİÖŞÜ]/g,c=>TRMAP[c]).replace(/[^\w\-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'tasarim';
async function saveFile(name,data){
  const note=$('#dlNote');
  if(DL){try{await DL.save({filename:name,data});note.className='msg ok';note.textContent=name+' kaydedildi.';}catch(e){note.className='msg er';note.textContent=e&&e.code==='declined'?'Kaydetme iptal edildi.':'Dosya kaydedilemedi ('+(e&&e.code||'hata')+').';}return;}
  if(!window.claude){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);note.className='msg ok';note.textContent=name+' indirildi.';}
}
$('#dlJson').onclick=()=>saveFile(safeName()+'.json',JSON.stringify(designJSON(),null,2));
$('#dlXlsx').onclick=()=>{
  if(!window.XLSX){$('#dlNote').className='msg er';$('#dlNote').textContent='Excel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.';return;}
  const X=window.XLSX,wb=X.utils.book_new(),c=S.p.cur;
  const add=(n,rows,w)=>{const ws=X.utils.aoa_to_sheet(rows);if(w)ws['!cols']=w.map(x=>({wch:x}));X.utils.book_append_sheet(wb,ws,n);};
  add('Girdiler',[['Grup','Parametre','Değer','Birim','Tolerans (±)'],...SCHEMA.map(s=>[GROUPS[s.g],s.l,s.type==='lib'?(LIB[s.lib].items[S.p[s.k]]||{l:S.p[s.k]}).l:S.p[s.k],s.u,S.t[s.k]??''])],[22,40,40,8,12]);
  add('Sonuçlar',[['Metrik','Değer','Birim'],['Tasarım',S.name,''],['Modül Pmax',R.P,'W'],['Modül verimi',R.eta,'%'],['CTM',R.CTM,'%'],['Σ hücre gücü',R.Pcells,'W'],['Voc',R.Voc,'V'],['Isc',R.Isc,'A'],['Vmp',R.Vmp,'V'],['Imp',R.Imp,'A'],['FF',R.FF*100,'%'],
    ['Modül boyu',R.L,'mm'],['Modül genişliği',R.W,'mm'],['Cam boyu',R.Lg,'mm'],['Cam genişliği',R.Wg,'mm'],['Modül alanı',R.Amod/1e6,'m²'],['Aktif alan oranı',R.AAR,'%'],['Ağırlık',R.mass.total,'kg'],
    ['Modül maliyeti',R.bom.total,c],['Birim maliyet',R.bom.perW,c+'/W'],['Sınır ihlalleri',R.viol.map(v=>v.m).join(' | ')||'yok','']],[28,16,8]);
  add('CTM',[['Faktör','Formül','k','Önce (W)','Sonra (W)','ΔW','Δ%'],...R.steps.map(s=>[s.l,s.note,s.k,s.P0,s.P1,s.dW,s.dPct]),['Toplam CTM','',R.CTM/100,R.Pcells,R.P,R.P-R.Pcells,R.CTM-100]],[32,34,10,10,10,10,10]);
  add('BOM',[['Grup','Kalem','Özellik','Miktar','Birim','Birim fiyat','Fiyat birimi','Fire %','Tutar ('+c+')'],...R.bom.lines.map(x=>[x.g,x.l,x.spec,x.q,x.u,x.price*x.mult,x.pu+(x.mult!==1?' (×'+f(x.mult,2)+' W)':''),x.w,x.cost]),['','Yield karşılığı','','','','','','',R.bom.yieldLoss],['','TOPLAM','','','','','','',R.bom.total],['','Birim maliyet ('+c+'/W)','','','','','','',R.bom.perW]],[18,34,40,10,8,12,14,8,12]);
  if(MC){const sP=stats(MC.P),sE=stats(MC.E);const rows=[['Metrik','Değer'],['İterasyon',MC.n],['Pmax ortalama (W)',sP.mean],['Pmax σ (W)',sP.sd],['Pmax P5',sP.p5],['Pmax P95',sP.p95],['Verim ortalama (%)',sE.mean],['Verim σ',sE.sd],
    ['P(yan kenar < min)',MC.prob.eSide],['P(bus–kenar < min)',MC.prob.eBus],['P(L > maks)',MC.prob.L],['P(W > maks)',MC.prob.W],['P(hücre boşluğu < min)',MC.prob.gc],['P(string aralığı < min)',MC.prob.gs],['P(Pmax < etiket)',MC.prob.Pplate],[],['Örnek','Pmax (W)','Verim (%)','L (mm)','W (mm)','Yan kenar min (mm)','Bus–kenar min (mm)']];
    for(let i=0;i<Math.min(MC.n,20000);i++)rows.push([i+1,MC.P[i],MC.E[i],MC.Ls[i],MC.Ws[i],MC.eS[i],MC.eB[i]]);
    add('Monte Carlo',rows,[26,14,12,10,10,16,16]);}
  const ds=SAVED.filter(d=>CMP.sel.includes(d.id));
  if(ds.length){const rows=[['Tasarım','Pmax (W)','Verim (%)','CTM (%)','Maliyet ('+c+')',c+'/W','L (mm)','W (mm)','Ağırlık (kg)','ΔPmax','Δverim','Δmaliyet','Δ'+c+'/W']];
    const ref=SAVED.find(d=>d.id===CMP.ref)||ds[0];const ev=d=>{const b=defaults();return evaluate(cellDerived(Object.assign(b.p,d.p,d.p.Vmp?{}:{Vmp:0})));};const r0=ev(ref);
    for(const d of [ref,...ds.filter(x=>x!==ref)]){const r=ev(d);rows.push([d.name+(d===ref?' (referans)':''),r.P,r.eta,r.CTM,r.bom.total,r.bom.perW,r.L,r.W,r.mass.total,r.P-r0.P,r.eta-r0.eta,r.bom.total-r0.bom.total,r.bom.perW-r0.bom.perW]);}
    add('Karşılaştırma',rows,[40,10,10,10,12,10,10,10,10,10,10,10,10]);}
  const buf=X.write(wb,{bookType:'xlsx',type:'array'});
  saveFile(safeName()+'.xlsx',new Blob([buf]));
};
$('#fileIn').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{try{loadDesign(JSON.parse(rd.result));$('#dlNote').className='msg ok';$('#dlNote').textContent=fl.name+' yüklendi.';}catch(er){$('#dlNote').className='msg er';$('#dlNote').textContent='Yüklenemedi: '+er.message;}};rd.readAsText(fl);e.target.value='';};
$('#jsonShow').onclick=()=>{$('#jsonBox').value=JSON.stringify(designJSON(),null,2);$('#jsonMsg').textContent='';};
$('#jsonCopy').onclick=()=>{const t=$('#jsonBox');if(!t.value)t.value=JSON.stringify(designJSON(),null,2);const m=$('#jsonMsg');
  navigator.clipboard.writeText(t.value).then(()=>{m.className='msg ok';m.textContent='Panoya kopyalandı.';}).catch(()=>{t.focus();t.select();m.className='msg';m.textContent='Metin seçildi; kopyalamak için Ctrl+C / Kopyala kullanın.';});};
$('#jsonLoad').onclick=()=>{const m=$('#jsonMsg');try{loadDesign(JSON.parse($('#jsonBox').value));m.className='msg ok';m.textContent='Tasarım yüklendi.';}catch(e){m.className='msg er';m.textContent='JSON okunamadı: '+e.message;}};
let resetArm=false;
$('#resetBtn').onclick=()=>{const b=$('#resetBtn');if(!resetArm){resetArm=true;b.textContent='Emin misiniz? Tekrar dokunun';setTimeout(()=>{resetArm=false;b.textContent='Varsayılana dön';},3500);return;}
  resetArm=false;b.textContent='Varsayılana dön';S=fromTemplate(TEMPLATES[0].id);MC=null;mcKey='';syncInputs();recompute();};

/* ---- Sekmeler ---- */
const TABS=['tasarim','cizim','ctm','tolerans','maliyet','kutuphane','karsilastir','kayit'];
function go(t){if(!TABS.includes(t))t='tasarim';for(const b of $$('.tab'))b.setAttribute('aria-selected',b.dataset.tab===t);for(const p of $$('[data-panel]'))p.hidden=p.dataset.panel!==t;if(t==='tolerans')mcAuto();if(t==='cizim'&&window.renderSheets)renderSheets();try{history.replaceState(null,'','#'+t);}catch(e){}window.scrollTo(0,0);}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b)go(b.dataset.tab);});

/* ---- Başlat ---- */
buildInputs();syncInputs();recompute();go((location.hash||'').slice(1));
(async()=>{
  const note=$('#dlNote');
  if(!window.claude||!window.claude.use){for(const b of $$('.dl'))b.hidden=false;return;}
  note.textContent='İndirme hazırlanıyor…';
  try{DL=await window.claude.use('downloads');}catch(e){DL=null;}
  if(DL){for(const b of $$('.dl'))b.hidden=false;note.textContent='';}
  else{note.className='msg';note.textContent='Bu görünümde dosya indirme kullanılamıyor. JSON’u aşağıdan kopyalayabilirsiniz.';}
})();

document.addEventListener('click',e=>{if(e.target.id==='plateApply'&&MC){S.p.Pplate=MC.plateRec;syncInputs();schedule();}});
