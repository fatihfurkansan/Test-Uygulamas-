"use strict";
/* ---- Parametre şeması: grup, etiket, birim, varsayılan, tolerans ---- */
const S_=(k,g,l,u,v,o={})=>Object.assign({k,g,l,u,v},o);
const SCHEMA=[
  // Hücre
  S_('fmtV','cell','Wafer / hücre formatı','','g12r',{type:'lib',lib:'fmt'}),
  S_('techV','cell','Hücre teknolojisi (hazır)','','topcon',{type:'lib',lib:'tech',hint:'Format ile birlikte verim, Voc, Isc, Imp ve kütleyi doldurur'}),
  S_('tech','cell','Teknoloji sınıfı','','TOPCon',{type:'sel',opts:TECHS.map(t=>[t,t]),hint:'BC ve MWT: önde tel gölgesi yok'}),
  S_('a','cell','Hücre genişliği','mm',182.2,{tol:0.2,min:50}),
  S_('b','cell','Hücre boyu','mm',210,{tol:0.2,min:50}),
  S_('ch','cell','Köşe pahı (kenar)','mm',0,{min:0,hint:'Tam kare için 0'}),
  S_('eta','cell','Hücre verimi','%',26.0,{min:1,max:40,hint:'Pmax ile bağlı'}),
  S_('P','cell','Hücre Pmax (tam hücre)','W',9.95,{min:0.1}),
  S_('Voc','cell','Hücre Voc','V',0.728,{min:0.1}),
  S_('Isc','cell','Hücre Isc','A',16.30,{min:0.1}),
  S_('Imp','cell','Hücre Imp','A',15.79,{min:0.1}),
  S_('mc','cell','Hücre kütlesi','g',12.0,{min:0}),
  S_('sP','cell','Modül ort. hücre gücü saçılımı σ','%',0.30,{min:0,hint:'Bin içi + lotlar arası, Monte Carlo'}),
  S_('cvI','cell','Bin içi Isc değişkenliği (CV)','%',1.5,{min:0}),
  S_('tc','ds','Pmax sıcaklık katsayısı γ','%/°C',-0.30,{hint:'Teknoloji seçimiyle dolar'}),
  S_('bVoc','ds','Voc sıcaklık katsayısı β','%/°C',-0.25),
  S_('aIsc','ds','Isc sıcaklık katsayısı α','%/°C',0.046),
  S_('bif','ds','Hücre bifasiyalliği φ','–',0.80,{min:0,max:1}),
  S_('ag','ds','Gümüş tüketimi','mg/W',10,{min:0}),
  S_('lid','ds','İlk yıl güç kaybı','%',1.0,{min:0}),
  S_('ann','ds','Yıllık degradasyon','%/yıl',0.40,{min:0}),
  S_('NMOT','ds','NMOT sıcaklığı','°C',43,{hint:'IEC 61215; cam-cam ~44 °C'}),
  S_('Grear','ds','Arka ışınım (BNPI)','W/m²',135,{min:0,hint:'IEC TS 60904-1-2'}),
  S_('yrs','ds','Garanti süresi','yıl',30,{int:1,min:1,max:50}),
  // Dizilim
  S_('half','lay','Half-cut (yarım hücre)','',true,{type:'bool'}),
  S_('nc','lay','String (sütun) sayısı','adet',6,{int:1,min:1,max:40}),
  S_('nr','lay','Sütun başına hücre parçası','adet',22,{int:1,min:1,max:200,hint:'Half-cut: üst + alt toplam'}),
  S_('gc','lay','Hücre arası boşluk','mm',1.0,{tol:0.3,min:-1,hint:'Tol.: stringer adım hatası'}),
  S_('gs','lay','String aralığı','mm',2.5,{tol:0.5,min:0,hint:'Tol.: lay-up konumlama'}),
  S_('gm','lay','Orta boşluk (half-cut)','mm',6.0,{tol:0.5,min:0}),
  S_('eL','lay','Üst/alt kenar mesafesi','mm',20.0,{min:0,hint:'Cam kenarı → hücre'}),
  S_('eW','lay','Yan kenar mesafesi','mm',11.15,{min:0,hint:'Cam kenarı → hücre'}),
  S_('pl','lay','Lay-up konum kaçıklığı','mm',0,{tol:1.0,hint:'Nominal 0; toleransı MC kenar mesafesine yansır'}),
  // Bağlantı
  S_('wireV','int','Tel / ribbon (hazır)','','r24',{type:'lib',lib:'wire'}),
  S_('coatV','int','Tel kaplaması','','snpb',{type:'lib',lib:'coat'}),
  S_('joinV','int','Bağlantı yöntemi','','ir',{type:'lib',lib:'join'}),
  S_('nbb','int','Busbar (tel) sayısı','adet',16,{int:1,min:1,max:40}),
  S_('wt','int','Tel kesiti','','round',{type:'sel',opts:[['round','Yuvarlak'],['tri','Üçgen'],['flat','Yassı'],['struct','Yapılı (LHS) yassı']]}),
  S_('dw','int','Tel çapı / ribbon genişliği','mm',0.24,{tol:0.01,min:0.05}),
  S_('tr','int','Ribbon kalınlığı (yassı)','mm',0.20,{min:0.05}),
  S_('wpad','int','Hücredeki baskı busbar genişliği','mm',0.05,{min:0,hint:'Hücre ölçümünde zaten gölgede'}),
  S_('ov','int','Tel uç boşluğu (hücre kenarına)','mm',2.5,{min:0}),
  S_('busV','int','Bus ribbon (hazır)','','b5x35',{type:'lib',lib:'bus'}),
  S_('insV','int','Bus yalıtım şeridi','','epe',{type:'lib',lib:'insul'}),
  S_('bw','int','Bus ribbon genişliği','mm',5,{min:0.5}),
  S_('bt','int','Bus ribbon kalınlığı','mm',0.35,{min:0.05}),
  S_('bg','int','Bus ribbon – hücre mesafesi','mm',3.0,{min:0}),
  S_('lead','int','J-box çıkış ribbon boyu','mm',25,{min:0}),
  // Cam ve katmanlar
  S_('glassFV','mat','Ön cam (hazır)','','g20ar',{type:'lib',lib:'glassF'}),
  S_('tgf','mat','Ön cam kalınlığı','mm',2.0,{tol:0.1,min:0.5}),
  S_('ar','mat','Ön camda AR kaplama','',true,{type:'bool'}),
  S_('rearV','mat','Arka katman (hazır)','','gr20',{type:'lib',lib:'rear'}),
  S_('tgr','mat','Arka cam kalınlığı','mm',2.0,{tol:0.1,min:0}),
  S_('bsg','mat','Backsheet birim kütlesi','g/m²',450,{min:0}),
  S_('encFV','mat','Ön enkapsülan','','EPE',{type:'lib',lib:'enc',filter:it=>it.rb===undefined}),
  S_('tef','mat','Ön enkapsülan kalınlığı','mm',0.50,{min:0.1}),
  S_('Tf','mat','Ön enkapsülan etkin geçirgenlik','%',99.2,{min:80,max:105}),
  S_('encRV','mat','Arka enkapsülan','','POE',{type:'lib',lib:'enc'}),
  S_('ter','mat','Arka enkapsülan kalınlığı','mm',0.45,{min:0.1}),
  S_('Rb','mat','Gap bölgesi arka yansıtma','–',0.75,{min:0,max:1,hint:'Arka katman / beyaz enkapsülan seçimiyle güncellenir'}),
  // Çerçeve ve J-box
  S_('frameV','fr','Çerçeve (hazır)','','al30',{type:'lib',lib:'frame'}),
  S_('fc','fr','Çerçeve kenar payı (cam → dış)','mm',3.0,{min:0}),
  S_('fkg','fr','Çerçeve birim kütlesi','kg/m',0.42,{min:0}),
  S_('fsealV','fr','Çerçeve yapıştırma','','sil',{type:'lib',lib:'fseal'}),
  S_('sil','fr','Silikon tüketimi','g/m',15,{min:0}),
  S_('edgeV','fr','Kenar koruma (çerçevesiz)','','none',{type:'lib',lib:'edge'}),
  S_('jboxV','fr','J-box gövdesi','','split30',{type:'lib',lib:'jbox'}),
  S_('cableV','fr','Solar kablo (hazır)','','c40_300',{type:'lib',lib:'cable'}),
  S_('connV','fr','Konnektör','','mc4c',{type:'lib',lib:'conn'}),
  S_('potV','fr','J-box potting','','si2k',{type:'lib',lib:'pot'}),
  S_('nJB','fr','J-box parça sayısı','adet',3,{int:1,min:1,max:3}),
  S_('cabL','fr','Kablo boyu (her kutup)','mm',300,{min:0}),
  S_('cabA','fr','Kablo kesiti','mm²',4,{min:1}),
  S_('potG','fr','Potting silikonu (kutu başı)','g',20,{min:0}),
  S_('jbAdhG','fr','J-box yapıştırma silikonu','g',15,{min:0}),
  S_('jbm','fr','J-box takımı kütlesi','kg',0.30,{min:0}),
  // Mekanik ve çizim
  S_('fH','mech','Çerçeve yüksekliği','mm',30,{min:0,hint:'Çerçeve seçimiyle dolar'}),
  S_('fOv','mech','Çerçeve dudağının cama binmesi','mm',4,{min:0,hint:'Hücreye kadar uzanırsa gölge ihlali'}),
  S_('fFl','mech','Çerçeve alt flanş genişliği','mm',20,{min:0}),
  S_('fWt','mech','Çerçeve et kalınlığı','mm',1.6,{min:0.5}),
  S_('mh1','mech','Montaj deliği aralığı 1','mm',1400,{min:0,hint:'Uzun kenar, merkeze simetrik'}),
  S_('mh2','mech','Montaj deliği aralığı 2','mm',400,{min:0,hint:'0 = yok'}),
  S_('mhW','mech','Montaj deliği (oval) genişlik','mm',9,{min:0}),
  S_('mhL','mech','Montaj deliği (oval) boy','mm',14,{min:0}),
  S_('gh','mech','Topraklama deliği çapı','mm',4.2,{min:0}),
  S_('jbW','mech','J-box genişliği','mm',60,{min:0}),
  S_('jbL','mech','J-box boyu','mm',40,{min:0}),
  S_('jbU','mech','J-box konumu (modül ucundan)','mm',0,{min:0,hint:'0 = otomatik: half-cut ortada, tam hücre üst uçta'}),
  S_('lblW','mech','Arka etiket boyutu (genişlik)','mm',140,{min:0}),
  S_('lblH','mech','Arka etiket boyutu (yükseklik)','mm',90,{min:0}),
  S_('Vsys','mech','Maks. sistem gerilimi','V DC',1500,{min:0}),
  S_('company','mech','Firma','','',{type:'text'}),
  S_('dwgNo','mech','Çizim numarası','','PVM-001',{type:'text'}),
  S_('rev','mech','Revizyon','','A',{type:'text'}),
  S_('drawer','mech','Çizen','','',{type:'text'}),
  S_('checker','mech','Kontrol / onay','','',{type:'text'}),
  // Sınırlar
  S_('eMin','lim','Min. kenar mesafesi (gerilimli parça)','mm',10,{min:0}),
  S_('gcMin','lim','Min. hücre arası boşluk','mm',0.5),
  S_('gsMin','lim','Min. string aralığı','mm',1.5),
  S_('gmMin','lim','Min. orta boşluk','mm',3.0),
  S_('Lmax','lim','Maks. modül boyu','mm',2384,{min:0}),
  S_('Wmax','lim','Maks. modül genişliği','mm',1136,{min:0}),
  // CTM katsayıları
  S_('dCut','ctm','Kesme (LSC/TLS) kaybı','%',0.30,{min:0}),
  S_('Rf','ctm','Ön cam yansıması (AR’li)','%',1.5,{min:0}),
  S_('RfNo','ctm','Ön cam yansıması (AR’siz)','%',4.0,{min:0}),
  S_('aG','ctm','Cam soğurma katsayısı α','1/mm',0.002,{min:0}),
  S_('Gim','ctm','İndeks uyumu kazancı G_IM','%',2.0),
  S_('fy','ctm','Gap ışık yakalama oranı f_yak','–',0.30,{min:0,max:1}),
  S_('wE','ctm','Kenar bandı etkin genişliği','mm',5,{min:0}),
  S_('rwR','ctm','Yuvarlak tel geri yönlendirme r_w','–',0.45,{min:0,max:1}),
  S_('rwT','ctm','Üçgen tel geri yönlendirme r_w','–',0.70,{min:0,max:1}),
  S_('rwF','ctm','Yassı ribbon geri yönlendirme r_w','–',0.0,{min:0,max:1}),
  S_('rwS','ctm','Yapılı (LHS) ribbon geri yönlendirme r_w','–',0.40,{min:0,max:1}),
  S_('rho','ctm','Bakır özdirenci (20 °C)','µΩ·cm',1.724,{min:1}),
  S_('kc','ctm','Kaplama/alaşım direnç çarpanı','–',1.05,{min:0.5}),
  S_('Tm','ctm','Ölçüm sıcaklığı','°C',25),
  S_('Rj','ctm','J-box terminal + diyot yolu direnci','mΩ',1.0,{min:0}),
  S_('conR','ctm','Konnektör çifti direnci','mΩ',0.5,{min:0}),
  S_('mmMode','ctm','Mismatch’i Isc CV’den hesapla','',false,{type:'bool',hint:'δ = β·CV²'}),
  S_('dMM','ctm','Mismatch kaybı','%',0.30,{min:0}),
  S_('beta','ctm','Mismatch katsayısı β','–',0.13,{min:0}),
  S_('kCal','ctm','Kalibrasyon çarpanı k_kal','–',1.000,{min:0.5,max:1.5}),
  // Monte Carlo
  S_('n','mc','İterasyon sayısı','adet',10000,{int:1,min:100,max:200000}),
  S_('dist','mc','Tolerans dağılımı','','normal',{type:'sel',opts:[['normal','Normal (σ = tol/3)'],['uniform','Düzgün (±tol)']]}),
  S_('seed','mc','Rastgele tohum','',42,{int:1}),
  S_('gT','mc','Cam kesim toleransı','± mm',1.0,{min:0}),
  S_('fT','mc','Çerçeve montaj toleransı','± mm',1.0,{min:0}),
  S_('sCTM','mc','Proses CTM saçılımı σ','%',0.40,{min:0}),
  S_('sMeas','mc','Ölçüm (flasher) belirsizliği σ','%',0.50,{min:0}),
  S_('Pplate','mc','Etiket gücü (alt sınır)','W',620,{min:0}),
  S_('bin','mc','Güç sınıfı adımı','W',5,{min:0.5}),
  // Maliyet (fiyat dışı)
  S_('cur','cost','Para birimi','','$',{type:'sel',opts:[['$','USD ($)'],['€','EUR (€)'],['₺','TRY (₺)']]}),
  S_('fluxV','cost','Flux tipi','','nc',{type:'lib',lib:'flux'}),
  S_('fluxG','cost','Flux tüketimi','g/modül',3,{min:0}),
  S_('packV','cost','Ambalaj tipi','','vert',{type:'lib',lib:'pack'}),
  S_('nPal','cost','Palet başı modül','adet',36,{int:1,min:1}),
  S_('yield','cost','Üretim verimi (yield)','%',99.0,{min:50,max:100,hint:'Hurda/düşük sınıf karşılığı maliyete eklenir'})
];
const GROUPS={cell:'Hücre',lay:'Dizilim ve aralıklar',int:'Hücre bağlantısı',mat:'Cam ve katmanlar',fr:'Çerçeve ve J-box',lim:'Sınırlar',ctm:'CTM katsayıları',mc:'Monte Carlo ayarları',mech:'Mekanik ve teknik resim',ds:'Datasheet ve saha',cost:'Maliyet ayarları'};
const SCH=Object.fromEntries(SCHEMA.map(s=>[s.k,s]));

/* ---- BOM satır tanımları: fiyat birimi, varsayılan fiyat ve fire ---- */
const BOMDEF=[
  {id:'cell',g:'Hücre ve bağlantı',w:1.0},{id:'wire',g:'Hücre ve bağlantı',w:2.0},{id:'join',g:'Hücre ve bağlantı',w:0},
  {id:'flux',g:'Hücre ve bağlantı',w:5,price:8},{id:'bus',g:'Hücre ve bağlantı',w:3.0},{id:'insul',g:'Hücre ve bağlantı',w:3,price:0.05},
  {id:'glassF',g:'Cam ve katmanlar',w:0.5},{id:'rear',g:'Cam ve katmanlar',w:0.5},{id:'encF',g:'Cam ve katmanlar',w:3.0},{id:'encR',g:'Cam ve katmanlar',w:3.0},
  {id:'label',g:'Cam ve katmanlar',w:1,price:0.06},
  {id:'jbox',g:'Elektrik ve montaj',w:0.5},{id:'cable',g:'Elektrik ve montaj',w:1},{id:'conn',g:'Elektrik ve montaj',w:0.5},{id:'pot',g:'Elektrik ve montaj',w:5,price:6.0},{id:'jbadh',g:'Elektrik ve montaj',w:5,price:4.0},
  {id:'frame',g:'Elektrik ve montaj',w:1.0},{id:'corner',g:'Elektrik ve montaj',w:1,price:0.03},{id:'fseal',g:'Elektrik ve montaj',w:5},{id:'edge',g:'Elektrik ve montaj',w:2},
  {id:'pallet',g:'Ambalaj',w:0,price:14},{id:'carton',g:'Ambalaj',w:0,price:9},{id:'strap',g:'Ambalaj',w:0,price:2.5},
  {id:'cons',g:'Üretim giderleri',w:0,price:0.25},{id:'labor',g:'Üretim giderleri',w:0,price:1.6},{id:'energy',g:'Üretim giderleri',w:0,price:0.6},
  {id:'dep',g:'Üretim giderleri',w:0,price:1.0},{id:'qa',g:'Üretim giderleri',w:0,price:0.2},{id:'oh',g:'Üretim giderleri',w:0,price:0.8}
];
const BOMD=Object.fromEntries(BOMDEF.map(d=>[d.id,d]));

function defaults(){
  const p={};for(const s of SCHEMA)p[s.k]=s.v;
  const t={};for(const s of SCHEMA)if(s.tol!==undefined)t[s.k]=s.tol;
  for(const d of BOMDEF)p['fw_'+d.id]=d.w;
  return {p,t};
}

/* Hazır varyant seçilince ilgili fiziksel parametreleri doldurur */
function applyLib(p,key,id){
  const s=SCH[key];if(!s||s.type!=='lib')return;
  const it=LIB[s.lib].items[id];if(!it)return;
  p[key]=id;
  if(it.set)Object.assign(p,it.set);
  const priceKey={techV:'cell',wireV:'wire',coatV:'wire',busV:'bus',insV:'insul',glassFV:'glassF',rearV:'rear',encFV:'encF',encRV:'encR',jboxV:'jbox',cableV:'cable',connV:'conn',potV:'pot',
    frameV:'frame',fsealV:'fseal',edgeV:'edge',joinV:'join',fluxV:'flux',packV:['pallet','carton','strap']}[key];
  if(priceKey)for(const pk of [].concat(priceKey))delete p['pr_'+pk];
  if(key==='fmtV'||key==='techV')cellFrom(p);
  if(key==='encFV')p.Tf=it.T;
  if(key==='frameV'&&it.h!==undefined)p.fH=it.h;
  if(key==='rearV'||key==='encRV')p.Rb=rearRb(p);
}
function rearRb(p){const e=LIB.enc.items[p.encRV];if(e&&e.rb!==undefined)return e.rb;const r=LIB.rear.items[p.rearV];return r?r.Rb:0.08;}
function cellAreaCm2(p){return (p.a*p.b-4*(p.ch>0?p.ch*p.ch/2:0))/100;}

/* ---- Ana hesap: geometri, CTM, elektrik, ağırlık, BOM ---- */
function evaluate(p,light){
  const half=!!p.half,Np=half?2:1;
  const nc=Math.max(1,Math.round(p.nc)),nr=Math.max(1,Math.round(p.nr));
  const a=p.a,h=half?p.b/2:p.b;
  const up=half?Math.ceil(nr/2):nr,lo=half?nr-up:0;
  const nGapCol=Math.max(up-1,0)+Math.max(lo-1,0);
  const gmUse=half&&lo>0?p.gm:0;
  const blockL=nr*h+nGapCol*p.gc+gmUse;
  const blockW=nc*a+(nc-1)*p.gs;
  const Lg=blockL+2*p.eL,Wg=blockW+2*p.eW;
  const fc=p.frameV==='none'?0:p.fc;
  const L=Lg+2*fc,W=Wg+2*fc;
  const N=nc*nr,Nfull=half?N/2:N,Ns=N/Np;
  const chA=p.ch>0?p.ch*p.ch/2:0;
  const Apiece=a*h-(half?2:4)*chA;
  const Acells=N*Apiece,Amod=L*W,Aglass=Lg*Wg;
  // elektrik
  const Pp=half?p.P/2:p.P,Ip=half?p.Imp/2:p.Imp,Iscp=half?p.Isc/2:p.Isc;
  const Pcells=N*Pp;
  const steps=[];const add=(id,l,k,kind,note)=>steps.push({id,l,k,kind,note});
  add('cut','Kesme (half-cut) kaybı',half?1-p.dCut/100:1,'loss','δ_kes');
  const Rf=(p.ar?p.Rf:p.RfNo)/100;
  add('refl','Ön cam yüzey yansıması',1-Rf,'opt','1 − R_ön');
  add('abs','Ön cam soğurması',Math.exp(-p.aG*p.tgf),'opt','exp(−α·t_cam)');
  add('enc','Enkapsülan geçirgenliği',p.Tf/100,'opt',(LIB.enc.items[p.encFV]||{}).l||'');
  add('im','İndeks uyumu kazancı',1+p.Gim/100,'opt','1 + G_IM');
  const Agint=nc*(nGapCol*p.gc*a+gmUse*a)+(nc-1)*p.gs*blockL+N*(a*h-Apiece);
  const Aedge=2*Math.min(p.wE,Math.max(p.eL,0))*blockW+2*Math.min(p.wE,Math.max(p.eW,0))*blockL;
  const Agap=Math.max(Agint,0)+Aedge;
  add('gap','Gap geri yansıma kazancı',1+p.Rb*p.fy*Agap/Acells,'opt','1 + R_arka·f_yak·A_gap/A_hücre');
  const rw=p.wt==='round'?p.rwR:p.wt==='tri'?p.rwT:p.wt==='struct'?p.rwS:p.rwF;
  const lOn=Math.max(h-2*p.ov,0);
  const shade=(p.tech==='BC'||p.tech==='MWT')?0:p.nbb*Math.max(p.dw-p.wpad,0)*lOn*(1-rw)/Apiece;
  add('shade','Tel gölgelemesi',1-shade,'opt',(p.tech==='BC'||p.tech==='MWT')?p.tech+' hücre: önde tel yok':'N_bb·(d−w_pad)·ℓ·(1−r_w)/A');
  let kI=1;for(const s of steps)if(s.kind==='opt')kI*=s.k;
  const kCut=steps[0].k;
  const P1=Pcells*kCut*kI;
  const rhoT=p.rho*1e-8*(1+0.00393*(p.Tm-20))*p.kc; // Ω·m
  const Aw=p.wt==='round'?Math.PI*p.dw*p.dw/4:p.wt==='tri'?Math.sqrt(3)/4*p.dw*p.dw:p.dw*p.tr; // mm²
  const Rw=rhoT/(Aw*1e-6);
  const Ipe=Ip*kI,Iw=Ipe/p.nbb;
  const Pw=N*p.nbb*Iw*Iw*Rw*(2*lOn/3+Math.max(p.gc,0))/1000;
  const Ab=p.bw*p.bt,Rbus=rhoT/(Ab*1e-6);
  const Leq=Np*((nc/2)*p.gs+nc*2*a/3)/1000;
  const Imod=Np*Ipe;
  const Pbus=Ipe*Ipe*Rbus*Leq+2*Imod*Imod*Rbus*p.lead/1000;
  const rhoCab=1.85e-8*(1+0.00393*(p.Tm-20));
  const Rcab=2*rhoCab*(p.cabL/1000)/(p.cabA*1e-6); // Ω
  const Rjt=Rcab+(p.Rj+p.conR)/1000;
  const Pj=Imod*Imod*Rjt;
  add('rw','Tel / ara bağlantı direnç kaybı',1-Pw/P1,'res','N·N_bb·I_w²·R′·(2ℓ/3 + g)');
  add('rb','Bus ribbon direnç kaybı',1-Pbus/P1,'res','I²·R′_bus·L_eş');
  add('rj','J-box, kablo, konnektör kaybı',1-Pj/P1,'res','I_mod²·(R_kablo + R_term + R_kon)');
  const dmm=p.mmMode?p.beta*p.cvI*p.cvI:p.dMM;
  add('mm','Mismatch',1-dmm/100,'loss',p.mmMode?'β·CV²':'girilen değer');
  add('cal','Kalibrasyon çarpanı',p.kCal,'cal','k_kal');
  let P=Pcells;for(const s of steps){s.P0=P;P*=s.k;s.P1=P;s.dW=s.P1-s.P0;s.dPct=(s.k-1)*100;}
  const Voc=Ns*p.Voc,Isc=Np*Iscp*kI,Imp=Imod,Vmp=P/Imp,FF=P/(Voc*Isc);
  const eta=P/(Amod/1e6*10),etaG=P/(Aglass/1e6*10);
  const R={half,Np,Ns,N,Nfull,nc,nr,up,lo,h,nGapCol,gmUse,blockL,blockW,Lg,Wg,L,W,fc,Apiece,Acells,Amod,Aglass,
    AAR:Acells/Amod*100,Pcells,steps,P,CTM:P/Pcells*100,eta,etaG,Voc,Isc,Imp,Vmp,FF,kI,Agap,Pw,Pbus,Pj,Rw,Rbus,Rjt,Rcab,Iw,Ipe,Imod,lOn,Aw,Ab,dmm};
  if(light)return R;
  // datasheet: sıcaklık, bifasiyal, garanti
  const rr=LIB.rear.items[p.rearV]||{},er=LIB.enc.items[p.encRV]||{};
  const tau=(rr.tau||0)*(er.rb!==undefined?0:1);
  const phi=p.bif*tau*(1-shade);
  const ds={phi,P_NMOT:P*0.8*(1+p.tc/100*(p.NMOT-25)),P_BNPI:P*(1+phi*p.Grear/1000),P_b10:P*(1+phi*0.10),P_b20:P*(1+phi*0.20),P_b30:P*(1+phi*0.30),
    y1:100-p.lid,yN:100-p.lid-(p.yrs-1)*p.ann,agG:p.ag*Pcells/1000,Voc_m10:Voc*(1+p.bVoc/100*(-10-25))};
  R.ds=ds;
  // ağırlık
  const Ag=Aglass/1e6,perim=2*(L+W)/1000;
  const rear=LIB.rear.items[p.rearV]||{kind:'glass'};
  const eF=LIB.enc.items[p.encFV]||{rho:0.95},eR=LIB.enc.items[p.encRV]||{rho:0.95};
  const wireLen=N*p.nbb*(2*lOn+Math.max(p.gc,0))/1000;
  const busLen=Np*2*blockW/1000+2*p.lead/1000;
  const fr=p.frameV!=='none';
  const m={
    gF:2.5*p.tgf*Ag, gR:rear.kind==='glass'?2.5*p.tgr*Ag:p.bsg*Ag/1000,
    eF:eF.rho*p.tef*Ag, eR:eR.rho*p.ter*Ag, cells:Nfull*p.mc/1000,
    wire:8.96*Aw*wireLen*1.05/1000, bus:8.96*Ab*busLen*1.05/1000,
    frame:fr?p.fkg*perim:0, sil:fr&&p.fsealV!=='tape'?p.sil*perim/1000:0,
    jb:p.jbm+(p.potG*p.nJB+p.jbAdhG)/1000
  };
  m.total=Object.values(m).reduce((s,x)=>s+x,0);
  R.mass=m;R.wireLen=wireLen;R.busLen=busLen;R.perim=perim;R.rearKind=rear.kind;
  // sınır kontrolleri
  const V=[];
  const eBus=p.eL-p.bg-p.bw;R.eBus=eBus;
  if(p.eW<p.eMin)V.push({id:'eW',m:`Yan kenar mesafesi ${f(p.eW,2)} mm < min. ${f(p.eMin,1)} mm`});
  if(eBus<p.eMin)V.push({id:'eL',m:`Üst/alt kenarda bus ribbon–cam kenarı mesafesi ${f(eBus,2)} mm < min. ${f(p.eMin,1)} mm`});
  if(p.gc<p.gcMin)V.push({id:'gc',m:`Hücre arası boşluk ${f(p.gc,2)} mm < min. ${f(p.gcMin,2)} mm`});
  if(nc>1&&p.gs<p.gsMin)V.push({id:'gs',m:`String aralığı ${f(p.gs,2)} mm < min. ${f(p.gsMin,2)} mm`});
  if(half&&p.gm<p.gmMin)V.push({id:'gm',m:`Orta boşluk ${f(p.gm,2)} mm < min. ${f(p.gmMin,2)} mm`});
  if(L>p.Lmax)V.push({id:'L',m:`Modül boyu ${f(L,1)} mm > maks. ${f(p.Lmax,1)} mm`});
  if(W>p.Wmax)V.push({id:'W',m:`Modül genişliği ${f(W,1)} mm > maks. ${f(p.Wmax,1)} mm`});
  if(half&&nr%2)V.push({id:'nr',m:'Half-cut dizilimde sütun başına parça sayısı çift olmalı'});
  if(lOn<=0)V.push({id:'ov',m:'Tel uç boşluğu hücre boyunun yarısından büyük'});
  if(p.frameV!=='none'&&p.fOv>=Math.min(p.eW,p.eL))V.push({id:'fOv',m:`Çerçeve dudağı (${f(p.fOv,1)} mm) hücreye kadar uzanıyor; kenar mesafesinden küçük olmalı`});
  if(p.frameV==='none'&&rear.kind==='bs')V.push({id:'fr',m:'Backsheet’li modül çerçevesiz olamaz'});
  if((LIB.enc.items[p.encFV]||{}).white)V.push({id:'enc',m:'Beyaz enkapsülan ön yüzde kullanılamaz'});
  R.viol=V;R.bad=new Set(V.map(v=>v.id));
  R.bom=bom(p,R);
  return R;
}

function bom(p,R){
  const out=[],Ag=R.Aglass/1e6,perim=R.perim;
  const L=(id,l,spec,q,u,pu,defPrice,mult=1)=>{
    const price=p['pr_'+id]!==undefined?p['pr_'+id]:defPrice;
    const w=p['fw_'+id]!==undefined?p['fw_'+id]:BOMD[id].w;
    out.push({id,g:BOMD[id].g,l,spec,q,u,pu,price,w,mult,cost:q*mult*price*(1+w/100)});
  };
  const it=(lib,id)=>LIB[lib].items[id]||{l:'?',price:0,spec:''};
  const c=it('tech',p.techV),fm=it('fmt',p.fmtV),wi=it('wire',p.wireV),co=it('coat',p.coatV),jo=it('join',p.joinV),bu=it('bus',p.busV),gF=it('glassF',p.glassFV),
        rr=it('rear',p.rearV),eF=it('enc',p.encFV),eR=it('enc',p.encRV),jb=it('jbox',p.jboxV),cb=it('cable',p.cableV),cn=it('conn',p.connV),
        fr=it('frame',p.frameV),fs=it('fseal',p.fsealV),ed=it('edge',p.edgeV),po=it('pot',p.potV),ins=it('insul',p.insV),fl=it('flux',p.fluxV),pk=it('pack',p.packV);
  const cur=p.cur;
  L('cell','Hücre',`${c.l} · ${fm.l} · ${f(p.P,2)} W`,R.Nfull,'adet',cur+'/W',c.price,p.P);
  L('wire','Bağlantı teli / ribbon',`${wi.l} · ${co.l}`,R.mass.wire,'kg',cur+'/kg',+((wi.price||0)+(co.add||0)).toFixed(2));
  if(jo.cost>0)L('join',jo.l,jo.spec,1,'modül',cur+'/modül',jo.cost);
  if(jo.flux)L('flux','Lehim flux’ı',fl.l,p.fluxG/1000,'kg',cur+'/kg',fl.price);
  L('bus','Bus ribbon',bu.l,R.mass.bus,'kg',cur+'/kg',bu.price);
  L('insul','Bus yalıtım şeridi',ins.l,R.busLen,'m',cur+'/m',ins.price);
  L('glassF','Ön cam',gF.l,Ag,'m²',cur+'/m²',gF.price);
  L('rear',R.rearKind==='glass'?'Arka cam':'Backsheet',rr.l,Ag,'m²',cur+'/m²',rr.price);
  L('encF','Ön enkapsülan',`${eF.l} · ${f(p.tef,2)} mm`,R.mass.eF,'kg',cur+'/kg',eF.price);
  L('encR','Arka enkapsülan',`${eR.l} · ${f(p.ter,2)} mm`,R.mass.eR,'kg',cur+'/kg',eR.price);
  L('label','Etiket + laminat içi barkod','',1,'set',cur+'/set',BOMD.label.price);
  L('jbox','J-box gövdesi (diyotlu)',jb.l,1,'set',cur+'/set',jb.price);
  L('cable','Solar kablo',cb.l,2*p.cabL/1000,'m',cur+'/m',cb.price);
  L('conn','Konnektör çifti',cn.l,1,'çift',cur+'/çift',cn.price);
  if(p.potV!=='none')L('pot','J-box potting',`${po.l} · ${p.nJB} kutu × ${f(p.potG,0)} g`,p.potG*p.nJB/1000,'kg',cur+'/kg',po.price);
  L('jbadh','J-box yapıştırma silikonu','',p.jbAdhG/1000,'kg',cur+'/kg',BOMD.jbadh.price);
  if(p.frameV!=='none'){
    L('frame','Çerçeve',fr.l,R.mass.frame,'kg',cur+'/kg',fr.price);
    L('corner','Köşe takozu','',4,'adet',cur+'/adet',BOMD.corner.price);
    if(fs.unit==='kg')L('fseal','Çerçeve yapıştırıcısı',fs.l,R.mass.sil,'kg',cur+'/kg',fs.price);
    else L('fseal','Çerçeve bandı',fs.l,perim,'m',cur+'/m',fs.price);
  }else if(p.edgeV!=='none'){
    L('edge',ed.l,ed.spec,ed.unit==='m'?perim:4,ed.unit,cur+'/'+ed.unit,ed.price);
  }
  const np=1/p.nPal;
  L('pallet','Palet / kasa / raf',pk.l,np,'palet',cur+'/palet',pk.pal);
  L('carton','Karton, köşe koruyucu, ara karton',pk.l,np,'palet',cur+'/palet',pk.car);
  L('strap','Çember, streç film, palet etiketi','',np,'palet',cur+'/palet',pk.str);
  L('cons','Proses sarfları','teflon, membran, IPA, EL sarfı',1,'modül',cur+'/modül',BOMD.cons.price);
  L('labor','Direkt işçilik','',1,'modül',cur+'/modül',BOMD.labor.price);
  L('energy','Enerji','',1,'modül',cur+'/modül',BOMD.energy.price);
  L('dep','Amortisman','',1,'modül',cur+'/modül',BOMD.dep.price);
  L('qa','Kalite / test (EL, flasher, Hi-pot)','',1,'modül',cur+'/modül',BOMD.qa.price);
  L('oh','Genel gider','',1,'modül',cur+'/modül',BOMD.oh.price);
  const sub=out.reduce((s,x)=>s+x.cost,0);
  const yl=sub*(100/p.yield-1);
  const total=sub+yl;
  return {lines:out,sub,yieldLoss:yl,total,perW:total/R.P,mat:out.filter(x=>!['Üretim giderleri'].includes(x.g)).reduce((s,x)=>s+x.cost,0)};
}

/* ---- Monte Carlo ---- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function erf(x){const s=Math.sign(x);x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;}
const Phi=z=>0.5*(1+erf(z/Math.SQRT2));
/* Monte Carlo — üretim gerçekçi ölçü modeli:
   • Dizi (string) boyu stringer adımıyla belirlenir: her hücre adımı bağımsız ±tol(g) hatası taşır,
     hücre boyu değişimi dizi boyunu değil boşluğu etkiler.
   • Dizilerin yanal konumu lay-up robotuyla belirlenir: kenar dizilerin konum hatası σ_gs/√2.
   • Kenar mesafesini kenar sütundaki en geniş hücre belirler (her parça için bağımsız genişlik sapması).
   • Cam kesim, lay-up kaçıklığı ve çerçeve montajı ayrı bileşenlerdir. */
function runMC(p,tol){
  const n=Math.round(p.n),rng=mulberry32(Math.round(p.seed)||1);
  let spare=null;const gauss=()=>{if(spare!==null){const s=spare;spare=null;return s;}let u=0,v=0;while(u===0)u=rng();v=rng();const r=Math.sqrt(-2*Math.log(u));spare=r*Math.sin(2*Math.PI*v);return r*Math.cos(2*Math.PI*v);};
  const uni=p.dist==='uniform';
  const T=k=>tol[k]||0;
  const sdT=t=>t>0?(uni?t/Math.sqrt(3):t/3):0;
  const dev=t=>t>0?(uni?(rng()*2-1)*t:gauss()*t/3):0;
  const R0=evaluate(p,true);
  const nc=R0.nc,nr=R0.nr,ng=R0.nGapCol;
  const P=new Float64Array(n),E=new Float64Array(n),Ls=new Float64Array(n),Ws=new Float64Array(n),eS=new Float64Array(n),eB=new Float64Array(n);
  let vE=0,vB=0,vL=0,vW=0,vP=0,vAny=0;
  const q=Object.assign({},p);
  const sx=sdT(T('gs'))/Math.SQRT2;
  const maxDev=(t,k)=>{let m=-1e9;for(let j=0;j<k;j++){const d=dev(t);if(d>m)m=d;}return m;};
  for(let i=0;i<n;i++){
    const sGc=ng>0?ng*p.gc+gauss()*sdT(T('gc'))*Math.sqrt(ng):0;
    const gm=R0.gmUse?p.gm+dev(T('gm')):0;
    const blockL=nr*R0.h+sGc+gm;
    const Lg=R0.Lg+dev(p.gT),Wg=R0.Wg+dev(p.gT);
    const oy=dev(T('pl')),ox=dev(T('pl'));
    const eL=(Lg-blockL)/2,eW0=(Wg-R0.blockW)/2;
    const eLeft=eW0+ox+gauss()*sx-maxDev(T('a'),nr)/2;
    const eRight=eW0-ox-gauss()*sx-maxDev(T('a'),nr)/2;
    q.gc=ng?sGc/ng:p.gc;q.gm=R0.gmUse?gm:p.gm;q.eL=eL;q.eW=eW0;
    q.tgf=p.tgf+dev(T('tgf'));q.tgr=p.tgr+dev(T('tgr'));q.dw=p.dw+dev(T('dw'));
    const r=evaluate(q,true);
    const Lm=r.L+dev(p.fT),Wm=r.W+dev(p.fT);
    const Pi=r.P*(1+gauss()*p.sP/100)*(1+gauss()*p.sCTM/100)*(1+gauss()*p.sMeas/100);
    const es=Math.min(eLeft,eRight),eb=Math.min(eL+oy,eL-oy)-p.bg-p.bw;
    P[i]=Pi;E[i]=Pi/(Lm*Wm/1e6*10);Ls[i]=Lm;Ws[i]=Wm;eS[i]=es;eB[i]=eb;
    const a1=es<p.eMin,a2=eb<p.eMin,a3=Lm>p.Lmax,a4=Wm>p.Wmax,a5=Pi<p.Pplate;
    vE+=a1;vB+=a2;vL+=a3;vW+=a4;vP+=a5;vAny+=(a1||a2||a3||a4);
  }
  // boşluk ihlali: her boşluk = adım hatası − komşu hücre boyutu sapmalarının ortalaması
  const hTol=R0.half?T('b'):T('b');
  const pg=(mu,sd,mn,count)=>{if(count<=0)return 0;if(!(sd>0))return mu<mn?1:0;const ps=Phi((mn-mu)/sd);return 1-Math.pow(1-ps,count);};
  const sdGc=Math.sqrt(sdT(T('gc'))**2+sdT(hTol)**2/2), sdGs=Math.sqrt(sdT(T('gs'))**2+sdT(T('a'))**2/2), sdGm=Math.sqrt(sdT(T('gm'))**2+sdT(hTol)**2/2);
  const st=stats(P);const lo=st.sorted[Math.floor(0.0228*(n-1))];
  return {n,P,E,Ls,Ws,eS,eB,p:JSON.parse(JSON.stringify(p)),
    plateRec:Math.floor(lo/p.bin)*p.bin,
    prob:{eSide:vE/n,eBus:vB/n,L:vL/n,W:vW/n,Pplate:vP/n,dimAny:vAny/n,
      gc:pg(p.gc,sdGc,p.gcMin,ng*nc),gs:pg(p.gs,sdGs,p.gsMin,(nc-1)*nr),gm:R0.gmUse?pg(p.gm,sdGm,p.gmMin,nc):0},
    nom:R0};
}
function stats(arr){const s=Float64Array.from(arr).sort();const n=s.length;let m=0;for(const x of s)m+=x;m/=n;let v=0;for(const x of s)v+=(x-m)*(x-m);const sd=Math.sqrt(v/(n-1));const q=pp=>s[Math.min(n-1,Math.max(0,Math.round(pp*(n-1))))];return {mean:m,sd,min:s[0],max:s[n-1],p5:q(.05),p50:q(.5),p95:q(.95),sorted:s};}

/* ---- Biçimlendirme ---- */
function f(x,d=1){return Number.isFinite(x)?x.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d}):'–';}
function fs(x,d=1){if(!Number.isFinite(x))return '–';const r=Number(x.toFixed(d));return (r>0?'+':r<0?'−':'±')+f(Math.abs(r),d);}
