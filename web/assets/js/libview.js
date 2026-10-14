"use strict";
/* =====================================================================
   Kütüphane sekmesi: arama, filtre, detay, karşılaştırma, özel malzeme,
   fiyat listesi içe/dışa aktarım. app.js'deki S, applyLib, syncInputs,
   buildInputs, schedule ve saveFile fonksiyonlarını kullanır.
   ===================================================================== */
let USERLIB=LS.get('pvm.userlib')||{items:[],prices:{}};
if(!USERLIB.items)USERLIB.items=[];if(!USERLIB.prices)USERLIB.prices={};
const LV={q:'',cat:'',era:'',own:false,sort:'cat',sel:[],open:null};
const saveUser=()=>LS.set('pvm.userlib',USERLIB);

function fmtField(c,fd,it){
  const [k,,u,where,type]=fd;const v=where==='set'?(it.set||{})[k]:it[k];
  if(v===undefined||v===''||v===null)return '–';
  if(type==='bool')return v?'evet':'hayır';
  if(type.startsWith('sel:'))return k==='wt'?({round:'yuvarlak',tri:'üçgen',flat:'yassı',struct:'yapılı (LHS)'}[v]||v):k==='kind'?(v==='glass'?'arka cam':'backsheet'):v;
  if(typeof v==='number'){const a=Math.abs(v),d=a<0.1&&v!==0?3:a<10?2:a<1000&&!Number.isInteger(v)?1:0;return f(v,d)+(u?' '+u.replace(/^\//,S.p.cur+'/'):'');}
  return String(v)+(u&&type==='num'?' '+u:'');
}
function priceLabel(c,it){
  const cur=S.p.cur,pu=CATS[c].pu;
  if(c==='pack')return cur+f(it.pal+it.car+it.str,2)+'/palet';
  const v=priceOf(c,it);if(v===undefined)return '–';
  return (c==='coat'&&v>0?'+':'')+cur+f(v,c==='tech'?3:2)+(pu?pu.replace(' ek',''):(it.unit?'/'+it.unit:''));
}
/* Seçili tasarım bağlamında türetilen değerler */
function derived(c,it){
  const p=S.p,out=[],st=it.set||{};
  const rho=p.rho*1e-8*(1+0.00393*(p.Tm-20))*p.kc;
  if(c==='wire'||c==='bus'){
    const A=c==='bus'?st.bw*st.bt:st.wt==='round'?Math.PI*st.dw*st.dw/4:st.wt==='tri'?Math.sqrt(3)/4*st.dw*st.dw:st.dw*st.tr;
    out.push(['Kesit alanı',f(A,4)+' mm²'],['Doğrusal direnç (kaplama dahil)',f(rho/(A*1e-6)*1000,1)+' mΩ/m'],['Birim kütle',f(8.96*A,2)+' g/m']);
  }
  if(c==='tech'){const q=Object.assign({},p,{techV:Object.keys(LIB.tech.items).find(k=>LIB.tech.items[k]===it)});cellFrom(q);
    out.push(['Dolum faktörü (FF)',f(it.eta/(it.Voc*it.Jsc)*100,1)+' %'],[`Mevcut formatta (${LIB.fmt.items[p.fmtV]?.l||'–'}) güç`,f(q.P,2)+' W'],['Isc / Imp',`${f(q.Isc,2)} / ${f(q.Imp,2)} A`]);}
  if(c==='fmt'){const A=(it.a*it.b-4*(it.ch>0?it.ch*it.ch/2:0))/100;const T=LIB.tech.items[p.techV];
    out.push(['Hücre alanı',f(A,2)+' cm²'],[`Mevcut teknolojiyle (${T?.l||'–'}) güç`,T?f(T.eta/100*A*0.1,2)+' W':'–']);}
  if(c==='glassF')out.push(['Birim kütle',f(2.5*st.tgf,2)+' kg/m²']);
  if(c==='rear')out.push(['Birim kütle',it.kind==='glass'?f(2.5*st.tgr,2)+' kg/m²':f(st.bsg/1000,2)+' kg/m²']);
  if(c==='enc')out.push(['0,5 mm’de birim kütle',f(it.rho*500,0)+' g/m²']);
  if(c==='cable'&&R){const r=it.Rkm*st.cabL/1000;out.push(['Kutup başı direnç',f(r,2)+' mΩ'],['Mevcut modülde kayıp (2 kutup)',f(2*r/1000*R.Imod*R.Imod,2)+' W']);}
  if(c==='frame'&&R&&st.fkg)out.push(['Mevcut modülde kütle',f(st.fkg*R.perim,2)+' kg']);
  return out;
}
function catOptions(sel){
  const g={};for(const [k,c] of Object.entries(CATS))(g[c.grp]=g[c.grp]||[]).push([k,c.l]);
  return '<option value="">Tüm kategoriler</option>'+Object.entries(g).map(([gl,arr])=>`<optgroup label="${esc(gl)}">${arr.map(([k,l])=>`<option value="${k}" ${sel===k?'selected':''}>${esc(l)}</option>`).join('')}</optgroup>`).join('');
}
function libItems(){
  const q=LV.q.trim().toLocaleLowerCase('tr');const out=[];
  for(const [c,cat] of Object.entries(LIB)){if(LV.cat&&LV.cat!==c)continue;
    for(const [id,it] of Object.entries(cat.items)){
      if(LV.era&&it.era!==LV.era)continue;if(LV.own&&!it.user)continue;
      if(q){const hay=(it.l+' '+(it.spec||'')+' '+cat.l+' '+id).toLocaleLowerCase('tr');if(!q.split(/\s+/).every(w=>hay.includes(w)))continue;}
      out.push({c,id,it});}}
  if(LV.sort==='price')out.sort((a,b)=>(priceOf(a.c,a.it)??0)-(priceOf(b.c,b.it)??0));
  else if(LV.sort==='name')out.sort((a,b)=>a.it.l.localeCompare(b.it.l,'tr'));
  return out;
}
function inUse(c,id){const k=CATS[c].param;return S.p[k]===id||(c==='enc'&&S.p.encRV===id);}
function renderLibView(){
  const box=$('#libList');if(!box)return;
  const items=libItems();
  $('#libStat').textContent=`${items.length} / ${Object.values(LIB).reduce((s,c)=>s+Object.keys(c.items).length,0)} malzeme · ${Object.keys(CATS).length} kategori · ${USERLIB.items.length} özel`;
  let html='',last='';const LIM=400;
  for(const {c,id,it} of items.slice(0,LIM)){
    if(LV.sort==='cat'&&c!==last){last=c;html+=`<h3 class="libcat">${esc(CATS[c].l)} <small>${Object.keys(LIB[c].items).length}</small></h3>`;}
    const key=c+'/'+id,chips=CATS[c].fields.slice(0,4).map(fd=>{const v=fmtField(c,fd,it);return v==='–'?'':`<span>${esc(fd[1])}: <b>${esc(v)}</b></span>`;}).join('');
    html+=`<div class="libitem${inUse(c,id)?' use':''}"><label class="cmpbox"><input type="checkbox" data-lsel="${key}" ${LV.sel.includes(key)?'checked':''} aria-label="Karşılaştır"></label>
      <button class="libmain" data-lopen="${key}"><span class="t">${esc(it.l)}${it.user?'<span class="tag own">özel</span>':''}${inUse(c,id)?'<span class="tag useg">tasarımda</span>':''}</span>
      <span class="s">${esc(LV.sort==='cat'?'':CATS[c].l+' · ')}${esc(it.spec||'')}${it.era?` · ${ERA_L[it.era]}`:''}</span><span class="chips">${chips}</span></button>
      <span class="pr">${esc(priceLabel(c,it))}</span></div>`;
  }
  if(items.length>LIM)html+=`<p class="note">İlk ${LIM} sonuç gösteriliyor; aramayı daraltın.</p>`;
  box.innerHTML=html||'<p class="note">Eşleşen malzeme yok. Aramayı veya filtreleri değiştirin.</p>';
  renderLibCompare();
}
function renderLibCompare(){
  const box=$('#libCmp');const sel=LV.sel.map(k=>{const [c,id]=k.split('/');return {c,id,it:LIB[c]&&LIB[c].items[id]};}).filter(x=>x.it);
  if(sel.length<2){box.innerHTML=`<p class="note">Karşılaştırmak için aynı kategoriden en az iki malzeme işaretleyin${sel.length?` (seçili: ${sel.length})`:''}.</p>`;return;}
  const c=sel[0].c;const same=sel.filter(x=>x.c===c);
  const rows=[['Fiyat',x=>priceLabel(x.c,x.it)],['Dönem',x=>ERA_L[x.it.era]||'–'],['Açıklama',x=>x.it.spec||'–'],...CATS[c].fields.map(fd=>[fd[1],x=>fmtField(x.c,fd,x.it)])];
  const der=same.map(x=>derived(x.c,x.it));const dl=der[0].map(d=>d[0]);
  box.innerHTML=`${same.length<sel.length?'<p class="note">Farklı kategorideki seçimler tabloda gösterilmez.</p>':''}<div class="tw"><table><tr><th></th>${same.map(x=>`<th>${esc(x.it.l)}</th>`).join('')}</tr>
    ${rows.map(([l,fn])=>`<tr><td>${esc(l)}</td>${same.map(x=>`<td>${esc(fn(x))}</td>`).join('')}</tr>`).join('')}
    ${dl.map((l,i)=>`<tr><td>${esc(l)}</td>${der.map(d=>`<td>${esc(d[i]?d[i][1]:'–')}</td>`).join('')}</tr>`).join('')}</table></div>
    <div class="btns" style="margin-top:8px"><button class="btn sm" id="libCmpClear">Seçimi temizle</button></div>`;
}
/* ---- Detay penceresi ---- */
function openItem(key){
  const [c,id]=key.split('/');const it=LIB[c].items[id];if(!it)return;LV.open=key;
  const cat=CATS[c],pv=priceOf(c,it);
  const rows=cat.fields.map(fd=>`<tr><td>${esc(fd[1])}${fd[3]==='set'?' <small title="Tasarıma uygulanır">●</small>':''}</td><td class="n">${esc(fmtField(c,fd,it))}</td></tr>`).join('');
  const der=derived(c,it).map(([l,v])=>`<tr><td>${esc(l)}</td><td class="n">${esc(v)}</td></tr>`).join('');
  const apply=c==='enc'?(it.rb===undefined?`<button class="btn pri" data-lapply="encFV">Ön enkapsülan yap</button>`:'')+`<button class="btn pri" data-lapply="encRV">Arka enkapsülan yap</button>`
    :`<button class="btn pri" data-lapply="${cat.param}">Tasarıma uygula</button>`;
  const def=BUILTIN_PRICE[key];
  $('#libDlgBody').innerHTML=`<p class="eyebrow">${esc(cat.l)} · ${esc(ERA_L[it.era]||'')}${it.user?' · özel malzeme':''}</p><h2>${esc(it.l)}</h2><p class="note">${esc(it.spec||'')}</p>
    <div class="tw"><table>${rows}${der?`<tr class="grp"><td colspan="2">Mevcut tasarıma göre</td></tr>${der}`:''}</table></div>
    ${pv!==undefined?`<div class="row wide" style="margin-top:8px"><label for="libPrice">Birim fiyat <small>${esc(S.p.cur+(cat.pu||'/'+(it.unit||'')))}${def!==undefined&&def!==pv?` · varsayılan ${f(def,3)}`:''}</small></label><input type="text" inputmode="decimal" id="libPrice" value="${fmtIn(pv)}"></div>`:''}
    <p class="note">● işaretli alanlar seçildiğinde tasarım parametrelerine yazılır. Fiyat değişikliği bu cihazdaki fiyat listenize kaydedilir.</p>
    <div class="btns">${apply}<button class="btn" data-ledit="dup">Kopyala ve düzenle</button>${it.user?'<button class="btn" data-ledit="edit">Düzenle</button><button class="btn" data-ledit="del">Sil</button>':''}<button class="btn" data-lclose>Kapat</button></div>
    <p class="msg" id="libDlgMsg"></p>`;
  const dlg=$('#libDlg');if(!dlg.open)dlg.showModal();
}
/* ---- Özel malzeme editörü ---- */
function editItem(c,baseId,mode){
  const base=baseId?LIB[c].items[baseId]:{era:'now',spec:'',set:{}};
  const it=JSON.parse(JSON.stringify(base));delete it.user;
  const id=mode==='edit'?baseId:'u_'+Date.now().toString(36);
  if(mode!=='edit')it.l=(base.l?base.l+' (kopya)':'Yeni malzeme');
  const fieldHTML=CATS[c].fields.map(([k,l,u,where,type])=>{
    const v=where==='set'?(it.set||{})[k]:it[k];const nm=`fe-${where}-${k}`;
    if(type==='bool')return `<div class="row"><label for="${nm}">${esc(l)}</label><div class="val"><input type="checkbox" id="${nm}" ${v?'checked':''}></div><div></div></div>`;
    if(type.startsWith('sel:'))return `<div class="row wide"><label for="${nm}">${esc(l)}</label><select id="${nm}">${type.slice(4).split('|').map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select></div>`;
    return `<div class="row wide"><label for="${nm}">${esc(l)} <small>${esc(u)}</small></label><input type="text" ${type==='num'?'inputmode="decimal"':''} id="${nm}" value="${v===undefined?'':esc(typeof v==='number'?fmtIn(v):v)}"></div>`;}).join('');
  const pv=priceOf(c,it);
  $('#libDlgBody').innerHTML=`<p class="eyebrow">${esc(CATS[c].l)} · ${mode==='edit'?'özel malzemeyi düzenle':'yeni özel malzeme'}</p>
    <div class="rows" style="padding:0">
    <div class="row wide"><label for="fe-name">Ad</label><input type="text" id="fe-name" value="${esc(it.l)}" style="text-align:left;font-family:var(--f-body)"></div>
    <div class="row wide"><label for="fe-spec">Açıklama</label><input type="text" id="fe-spec" value="${esc(it.spec||'')}" style="text-align:left;font-family:var(--f-body)"></div>
    <div class="row wide"><label for="fe-era">Dönem</label><select id="fe-era">${Object.entries(ERA_L).map(([k,l])=>`<option value="${k}" ${it.era===k?'selected':''}>${l}</option>`).join('')}</select></div>
    ${c==='pack'?'':`<div class="row wide"><label for="fe-price">Birim fiyat <small>${esc(S.p.cur+(CATS[c].pu||''))}</small></label><input type="text" inputmode="decimal" id="fe-price" value="${pv===undefined?'':fmtIn(pv)}"></div>`}
    ${fieldHTML}</div>
    <div class="btns" style="margin-top:10px"><button class="btn pri" id="feSave">Kaydet</button><button class="btn" data-lclose>Vazgeç</button></div><p class="msg" id="libDlgMsg"></p>`;
  $('#feSave').onclick=()=>{
    const m=$('#libDlgMsg');const name=$('#fe-name').value.trim();if(!name){m.className='msg er';m.textContent='Ad boş olamaz.';return;}
    it.l=name;it.spec=$('#fe-spec').value.trim();it.era=$('#fe-era').value;it.set=it.set||{};
    for(const [k,l,,where,type] of CATS[c].fields){const el=$(`#fe-${where}-${k}`);let v;
      if(type==='bool')v=el.checked;else if(type==='num'){if(el.value.trim()===''){v=undefined;}else{v=parseNum(el.value);if(!Number.isFinite(v)){m.className='msg er';m.textContent=l+' sayı olmalı.';el.focus();return;}}}else v=el.value.trim();
      if(where==='set'){if(v===undefined)delete it.set[k];else it.set[k]=v;}else{if(v===undefined)delete it[k];else it[k]=v;}}
    if(c!=='pack'){const pe=parseNum($('#fe-price').value);if(Number.isFinite(pe))setPriceOf(c,it,pe);}
    if(!Object.keys(it.set).length)delete it.set;
    USERLIB.items=USERLIB.items.filter(x=>!(x.cat===c&&x.id===id));USERLIB.items.push({cat:c,id,it});saveUser();
    it.user=true;LIB[c].items[id]=it;refreshDesignLists();openItem(c+'/'+id);$('#libDlgMsg').className='msg ok';$('#libDlgMsg').textContent='Kaydedildi.';
  };
}
function refreshDesignLists(){buildInputs();syncInputs();schedule();renderLibView();}

/* ---- Fiyat listesi ve kütüphane dışa/içe aktarım ---- */
function priceCSV(){
  let t='kategori;id;malzeme;birim_fiyat;birim\n';
  for(const [c,cat] of Object.entries(LIB))for(const [id,it] of Object.entries(cat.items)){const v=priceOf(c,it);if(v===undefined)continue;t+=`${c};${id};"${it.l.replace(/"/g,"'")}";${String(v).replace('.',',')};${S.p.cur}${CATS[c].pu||(it.unit?'/'+it.unit:'')}\n`;}
  return t;
}
function importPriceCSV(text){
  let n=0,bad=0;
  for(const line of text.split(/\r?\n/)){if(!line.trim()||/^kategori/i.test(line))continue;
    const cols=line.match(/("([^"]*)"|[^;\t]+)/g)||[];const c=(cols[0]||'').trim(),id=(cols[1]||'').trim();
    const v=parseNum((cols.length>=4?cols[3]:cols[2]||'').replace(/"/g,''));
    const it=LIB[c]&&LIB[c].items[id];
    if(it&&Number.isFinite(v)&&priceOf(c,it)!==undefined){setPriceOf(c,it,v);USERLIB.prices[c+'/'+id]=v;n++;}else bad++;}
  saveUser();return {n,bad};
}
function libMsg(t,ok){const m=$('#libMsg');m.className='msg '+(ok?'ok':'er');m.textContent=t;}

/* ---- Olaylar ---- */
function initLibView(){
  $('#libCat').innerHTML=catOptions('');
  $('#libEra').innerHTML='<option value="">Tüm dönemler</option>'+Object.entries(ERA_L).map(([k,l])=>`<option value="${k}">${l}</option>`).join('');
  $('#libNewCat').innerHTML=catOptions('').replace('<option value="">Tüm kategoriler</option>','');
  $('#libQ').addEventListener('input',e=>{LV.q=e.target.value;renderLibView();});
  $('#libCat').addEventListener('change',e=>{LV.cat=e.target.value;renderLibView();});
  $('#libEra').addEventListener('change',e=>{LV.era=e.target.value;renderLibView();});
  $('#libSort').addEventListener('change',e=>{LV.sort=e.target.value;renderLibView();});
  $('#libOwn').addEventListener('change',e=>{LV.own=e.target.checked;renderLibView();});
  $('#libList').addEventListener('click',e=>{const b=e.target.closest('[data-lopen]');if(b)openItem(b.dataset.lopen);});
  $('#libList').addEventListener('change',e=>{const t=e.target;if(t.dataset.lsel){LV.sel=t.checked?[...LV.sel,t.dataset.lsel]:LV.sel.filter(k=>k!==t.dataset.lsel);renderLibCompare();}});
  $('#libCmp').addEventListener('click',e=>{if(e.target.id==='libCmpClear'){LV.sel=[];renderLibView();}});
  $('#libNew').onclick=()=>{const c=$('#libNewCat').value;editItem(c,null,'new');const d=$('#libDlg');if(!d.open)d.showModal();};
  const dlg=$('#libDlg');
  dlg.addEventListener('click',e=>{
    if(e.target===dlg||e.target.closest('[data-lclose]')){dlg.close();return;}
    const ap=e.target.closest('[data-lapply]');const [c,id]=(LV.open||'/').split('/');
    if(ap){applyLib(S.p,ap.dataset.lapply,id);syncInputs();schedule(true);const m=$('#libDlgMsg');m.className='msg ok';m.textContent='Tasarıma uygulandı. Sonuçlar güncellendi.';renderLibView();return;}
    const ed=e.target.closest('[data-ledit]');
    if(ed){const a=ed.dataset.ledit;
      if(a==='del'){if(ed.dataset.arm!=='1'){ed.dataset.arm='1';ed.textContent='Silmeyi onayla';return;}
        USERLIB.items=USERLIB.items.filter(x=>!(x.cat===c&&x.id===id));saveUser();delete LIB[c].items[id];dlg.close();refreshDesignLists();libMsg('Özel malzeme silindi.',true);return;}
      editItem(c,id,a==='edit'?'edit':'dup');}
  });
  dlg.addEventListener('change',e=>{if(e.target.id!=='libPrice')return;const [c,id]=LV.open.split('/');const v=parseNum(e.target.value);const m=$('#libDlgMsg');
    if(!(v>=-100)){m.className='msg er';m.textContent='Geçerli bir fiyat girin.';return;}
    setPriceOf(c,LIB[c].items[id],v);if(LIB[c].items[id].user){const u=USERLIB.items.find(x=>x.cat===c&&x.id===id);if(u)setPriceOf(c,u.it,v);}else USERLIB.prices[c+'/'+id]=v;saveUser();
    for(const k of Object.keys(S.p))if(k.startsWith('pr_'))delete S.p[k];schedule(true);renderLibView();m.className='msg ok';m.textContent='Fiyat kaydedildi; BOM bu fiyatla yeniden hesaplandı.';});
  $('#libPriceDl').onclick=()=>saveFile('pv_fiyat_listesi.csv','﻿'+priceCSV());
  $('#libPriceUp').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{const r=importPriceCSV(rd.result);for(const k of Object.keys(S.p))if(k.startsWith('pr_'))delete S.p[k];schedule(true);renderLibView();libMsg(`${r.n} fiyat güncellendi${r.bad?`, ${r.bad} satır eşleşmedi`:''}.`,r.n>0);};rd.readAsText(fl);e.target.value='';};
  $('#libJsonDl').onclick=()=>saveFile('pv_kutuphanem.json',JSON.stringify({schema:'pv-modul-kutuphane',version:1,saved:new Date().toISOString(),...USERLIB},null,2));
  $('#libJsonUp').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{try{const o=JSON.parse(rd.result);if(o.schema!=='pv-modul-kutuphane')throw new Error('kütüphane dosyası değil');
      for(const x of o.items||[]){USERLIB.items=USERLIB.items.filter(y=>!(y.cat===x.cat&&y.id===x.id));USERLIB.items.push(x);}Object.assign(USERLIB.prices,o.prices||{});saveUser();libApplyUser(USERLIB);refreshDesignLists();libMsg(`${(o.items||[]).length} özel malzeme ve ${Object.keys(o.prices||{}).length} fiyat yüklendi.`,true);}
    catch(er){libMsg('Yüklenemedi: '+er.message,false);}};rd.readAsText(fl);e.target.value='';};
  let arm=false;$('#libReset').onclick=e=>{const b=e.target;if(!arm){arm=true;b.textContent='Emin misiniz? Tekrar dokunun';setTimeout(()=>{arm=false;b.textContent='Fiyatları varsayılana döndür';},3500);return;}
    arm=false;b.textContent='Fiyatları varsayılana döndür';
    for(const [key,v] of Object.entries(BUILTIN_PRICE)){const [c,id]=key.split('/');const it=LIB[c].items[id];if(it&&v!==undefined)setPriceOf(c,it,v);}
    USERLIB.prices={};saveUser();for(const k of Object.keys(S.p))if(k.startsWith('pr_'))delete S.p[k];schedule(true);renderLibView();libMsg('Yerleşik fiyatlar geri yüklendi. Özel malzemeler korunur.',true);};
  renderLibView();
}
initLibView();
const _recompute=recompute;recompute=function(){_recompute();if(!$('[data-panel="kutuphane"]').hidden)renderLibView();};
