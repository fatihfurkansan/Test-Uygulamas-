"use strict";
/* =====================================================================
   PV modül hammadde kütüphanesi
   Her kategori: etiket, fiyat birimi, tasarım parametresi ve alan şeması.
   Alan tanımı: [anahtar, etiket, birim, konum('set'|'item'), tip('num'|'text'|'bool'|'sel:a|b')]
   'set' alanları seçildiğinde tasarım parametrelerine yazılır; 'item' alanları
   hesapta veya bilgi olarak kullanılır. Fiyatlar örnek değerlerdir.
   ===================================================================== */
const ERA_L={now:'Güncel',mid:'Geçiş',old:'Eski tip',rd:'Ar-Ge'};
const fx=(x,d)=>Number(x).toFixed(d).replace('.',',');
const n10=x=>Math.round(x*10),n100=x=>Math.round(x*100);

const CATS={
  fmt:{l:'Wafer / hücre formatı',grp:'Hücre',param:'fmtV',pu:'',fields:[
    ['a','Genişlik','mm','item','num'],['b','Boy','mm','item','num'],['ch','Köşe pahı','mm','item','num'],['diag','Külçe çapı','mm','item','num']]},
  tech:{l:'Hücre teknolojisi',grp:'Hücre',param:'techV',pu:'/W',fields:[
    ['cat','Sınıf','','item','sel:Al-BSF|PERC|PERT|MWT|TOPCon|HJT|BC|Tandem'],['eta','Verim','%','item','num'],['Voc','Voc','V','item','num'],['Jsc','Jsc','mA/cm²','item','num'],
    ['jmp','Jmp/Jsc','–','item','num'],['th','Kalınlık','µm','item','num'],['tc','γ Pmax','%/°C','item','num'],['bVoc','β Voc','%/°C','item','num'],['aIsc','α Isc','%/°C','item','num'],
    ['bif','Bifasiyallik','–','item','num'],['ag','Gümüş tüketimi','mg/W','item','num'],['lid','İlk yıl kaybı','%','item','num'],['ann','Yıllık degradasyon','%/yıl','item','num']]},
  wire:{l:'Hücre bağlantı teli / ribbon',grp:'Bağlantı',param:'wireV',pu:'/kg',fields:[
    ['wt','Kesit','','set','sel:round|tri|flat|struct'],['dw','Çap / genişlik','mm','set','num'],['tr','Kalınlık (yassı)','mm','set','num'],['mat','Çekirdek','','item','text'],['ys','Akma dayanımı','MPa','item','num']]},
  coat:{l:'Tel / ribbon kaplaması',grp:'Bağlantı',param:'coatV',pu:'/kg ek',fields:[
    ['kc','Direnç çarpanı','–','set','num'],['add','Fiyat farkı','/kg','item','num'],['mp','Erime noktası','°C','item','num'],['cth','Kaplama kalınlığı','µm','item','num']]},
  join:{l:'Bağlantı yöntemi',grp:'Bağlantı',param:'joinV',pu:'/modül',fields:[
    ['flux','Flux gerekir','','item','bool'],['cost','Ek maliyet','/modül','item','num'],['temp','Proses sıcaklığı','°C','item','num']]},
  bus:{l:'Bus ribbon',grp:'Bağlantı',param:'busV',pu:'/kg',fields:[
    ['bw','Genişlik','mm','set','num'],['bt','Kalınlık','mm','set','num']]},
  insul:{l:'Bus yalıtım şeridi',grp:'Bağlantı',param:'insV',pu:'/m',fields:[['th','Kalınlık','µm','item','num']]},
  flux:{l:'Lehim flux’ı',grp:'Bağlantı',param:'fluxV',pu:'/kg',fields:[['solid','Katı oranı','%','item','num']]},
  glassF:{l:'Ön cam',grp:'Cam ve katmanlar',param:'glassFV',pu:'/m²',fields:[
    ['tgf','Kalınlık','mm','set','num'],['ar','AR kaplama','','set','bool'],['Rf','Yüzey yansıması','%','set','num'],['Tsol','Güneş geçirgenliği','%','item','num'],['temper','Isıl işlem','','item','text']]},
  rear:{l:'Arka katman',grp:'Cam ve katmanlar',param:'rearV',pu:'/m²',fields:[
    ['kind','Tip','','item','sel:glass|bs'],['tgr','Arka cam kalınlığı','mm','set','num'],['bsg','Backsheet kütlesi','g/m²','set','num'],['Rb','Gap bölgesi yansıtma','–','item','num'],
    ['tau','Arka geçirgenlik (bifasiyal)','–','item','num'],['layers','Katman yapısı','','item','text'],['wvtr','Su buharı geçirgenliği','g/m²·gün','item','num']]},
  enc:{l:'Enkapsülan',grp:'Cam ve katmanlar',param:'encFV',pu:'/kg',fields:[
    ['rho','Yoğunluk','g/cm³','item','num'],['T','Etkin geçirgenlik','%','item','num'],['rb','Arka yansıtma (beyaz/siyah)','–','item','num'],['vr','Hacim direnci','Ω·cm','item','text'],
    ['uv','UV kesme','nm','item','num'],['lam','Laminasyon','°C / dk','item','text']]},
  jbox:{l:'J-box gövdesi',grp:'Elektrik',param:'jboxV',pu:'/set',fields:[
    ['nJB','Parça sayısı','adet','set','num'],['Irat','Anma akımı','A','item','num'],['diode','Diyot','','item','text'],['ip','Koruma','','item','text'],['Vmax','Maks. sistem gerilimi','V','item','num']]},
  cable:{l:'Solar kablo (H1Z2Z2-K)',grp:'Elektrik',param:'cableV',pu:'/m',fields:[
    ['cabA','Kesit','mm²','set','num'],['cabL','Boy (her kutup)','mm','set','num'],['Rkm','İletken direnci (20 °C)','Ω/km','item','num'],['od','Dış çap','mm','item','num']]},
  conn:{l:'Konnektör',grp:'Elektrik',param:'connV',pu:'/çift',fields:[
    ['conR','Kontak direnci (çift)','mΩ','set','num'],['Irat','Anma akımı','A','item','num'],['Vmax','Anma gerilimi','V','item','num'],['ip','Koruma','','item','text']]},
  pot:{l:'J-box potting',grp:'Elektrik',param:'potV',pu:'/kg',fields:[['cure','Kürlenme','','item','text']]},
  frame:{l:'Çerçeve',grp:'Çerçeve ve montaj',param:'frameV',pu:'/kg',fields:[
    ['fc','Kenar payı (cam → dış)','mm','set','num'],['fkg','Birim kütle','kg/m','set','num'],['h','Profil yüksekliği','mm','item','num'],['alloy','Malzeme','','item','text'],['finish','Yüzey','','item','text']]},
  fseal:{l:'Çerçeve yapıştırma',grp:'Çerçeve ve montaj',param:'fsealV',pu:'',fields:[['unit','Birim','','item','sel:kg|m']]},
  edge:{l:'Kenar koruma (çerçevesiz)',grp:'Çerçeve ve montaj',param:'edgeV',pu:'',fields:[['unit','Birim','','item','sel:m|adet']]},
  pack:{l:'Ambalaj tipi',grp:'Ambalaj',param:'packV',pu:'/palet',fields:[
    ['nPal','Palet başı modül','adet','set','num'],['pal','Palet / kasa','/palet','item','num'],['car','Karton seti','/palet','item','num'],['str','Çember, streç','/palet','item','num']]}
};
const LIB={};for(const [k,c] of Object.entries(CATS))LIB[k]={l:c.l,items:{}};
const add=(cat,id,o)=>{LIB[cat].items[id]=Object.assign({era:'now',spec:''},o);};
const mk=(cat,arr,fn)=>{for(const x of arr){const [id,o]=fn(x);add(cat,id,o);}};

/* ---- Wafer formatları ---- */
for(const [id,l,a,b,ch,diag,era,spec] of [
  ['f125','125×125 (5 inç) psödo-kare',125,125,8.65,165,'old','çok eski tip'],
  ['f156sq','M0 156×156 tam kare (multi)',156,156,0,0,'old','multi döküm'],
  ['f156m0','M0 156×156 psödo-kare (mono)',156,156,15.4,200,'old','mono Cz'],
  ['m1','M1 156,75×156,75 psödo-kare',156.75,156.75,12.3,205,'old',''],
  ['m2','M2 156,75×156,75 psödo-kare',156.75,156.75,8.5,210,'old','2016–19'],
  ['m2sq','M2 156,75×156,75 tam kare (multi)',156.75,156.75,0,0,'old','2016–19 multi'],
  ['g1','G1 158,75×158,75',158.75,158.75,1.1,223,'mid','2019–20'],
  ['m4','M4 161,7×161,7 psödo-kare',161.7,161.7,13.1,211,'mid','2019'],
  ['m6','M6 166×166 psödo-kare',166,166,8.5,223,'mid','2020–21'],
  ['m10','M10 182×182 psödo-kare',182,182,7.5,247,'mid','2021–23'],
  ['m10r','M10R 182,2×183,75 tam kare',182.2,183.75,0,0,'now','2023 →'],
  ['r191','182,2×191,6 dikdörtgen (210R-191)',182.2,191.6,0,0,'now','2023 →'],
  ['g12r','G12R 182,2×210 dikdörtgen (210R)',182.2,210,0,0,'now','2023 →'],
  ['g12','G12 210×210',210,210,1.4,295,'now','2020 →']])
  add('fmt',id,{l,a,b,ch,diag,era,spec:`${fx(a,2)}×${fx(b,2)} mm · ${spec}`});

/* ---- Hücre teknolojileri ---- */
for(const [id,l,era,cat,eta,Voc,Jsc,jmp,th,tc,bVoc,aIsc,bif,ag,lid,ann,price,spec] of [
  ['bsf_mc','Al-BSF multi (mc-Si)','old','Al-BSF',18.5,0.636,36.9,0.945,190,-0.41,-0.31,0.060,0,25,2.5,0.70,0.022,'p-tipi, 2–4BB'],
  ['bsf_mono','Al-BSF mono (Cz)','old','Al-BSF',19.8,0.645,38.5,0.945,190,-0.42,-0.31,0.050,0,22,3.0,0.70,0.025,'p-tipi, 3–5BB, LID belirgin'],
  ['perc_mc','PERC multi (black-Si)','old','PERC',20.5,0.660,38.5,0.945,180,-0.39,-0.29,0.050,0,18,2.5,0.55,0.026,'p-tipi, 5BB, LeTID riski'],
  ['perc','PERC mono (tek yüz)','mid','PERC',23.0,0.690,41.2,0.948,160,-0.35,-0.27,0.048,0,12,2.0,0.55,0.030,'p-tipi, 5BB–MBB, Ga katkılı'],
  ['perc_bi','PERC mono bifasiyal','mid','PERC',22.9,0.690,41.0,0.948,160,-0.35,-0.27,0.048,0.70,13,2.0,0.45,0.031,'p-tipi, arka yüz Al grid'],
  ['pert','n-PERT bifasiyal','mid','PERT',22.0,0.670,40.5,0.948,170,-0.37,-0.28,0.046,0.85,18,1.0,0.40,0.034,'n-tipi, B difüzyon'],
  ['mwt','MWT (metal wrap-through)','mid','MWT',22.5,0.685,41.0,0.948,170,-0.37,-0.28,0.050,0,10,2.0,0.55,0.035,'önde busbar yok, iletken backsheet'],
  ['topcon','TOPCon n-tipi','now','TOPCon',26.0,0.728,42.0,0.952,130,-0.30,-0.25,0.046,0.80,10,1.0,0.40,0.040,'16–20BB, LECO'],
  ['topcon0bb','TOPCon 0BB (busbarsız)','now','TOPCon',26.3,0.730,42.2,0.952,130,-0.29,-0.25,0.046,0.80,8,1.0,0.40,0.041,'film / nokta yapıştırma'],
  ['hjt','HJT heteroeklem','now','HJT',26.2,0.750,40.3,0.955,110,-0.24,-0.22,0.040,0.90,16,1.0,0.25,0.048,'n-tipi, düşük sıcaklık, Ag kaplı Cu pasta'],
  ['hjt_cu','HJT bakır kaplama (Cu plating)','now','HJT',26.3,0.751,40.4,0.955,110,-0.24,-0.22,0.040,0.90,2,1.0,0.25,0.046,'gümüşsüz metalizasyon'],
  ['bc','Arka kontaklı BC (HPBC / ABC / TBC / IBC)','now','BC',27.0,0.740,42.5,0.952,130,-0.26,-0.23,0.045,0.70,9,1.0,0.35,0.050,'önde metal yok'],
  ['tandem','Perovskit/Si tandem (pilot)','rd','Tandem',29.0,1.900,19.5,0.940,130,-0.22,-0.20,0.030,0,10,2.0,0.80,0.120,'iki terminal; kararlılık verisi sınırlı']])
  add('tech',id,{l,era,cat,eta,Voc,Jsc,jmp,th,tc,bVoc,aIsc,bif,ag,lid,ann,price,spec});

/* ---- Tel / ribbon ---- */
mk('wire',[[0.16,'0BB / 24BB+','now'],[0.18,'0BB / 20BB+','now'],[0.20,'18–20BB','now'],[0.22,'16–18BB','now'],[0.24,'16BB','now'],[0.26,'12–16BB','now'],[0.28,'12BB','mid'],[0.30,'MBB 10–12BB','mid'],[0.32,'MBB 10BB','mid'],[0.35,'MBB 9BB','mid'],[0.40,'MBB 6–9BB (ilk nesil)','mid']],
  ([d,s,era])=>['r'+n100(d),{l:`Yuvarlak tel Ø${fx(d,2)} mm`,spec:s,era,mat:'Cu (OFC)',ys:d<0.25?110:90,set:{wt:'round',dw:d},price:+(11+(0.4-d)*8).toFixed(2)}]);
mk('wire',[[0.20,'0BB'],[0.22,'0BB'],[0.25,'0BB / MBB']],([d,s])=>['t'+n100(d),{l:`Üçgen kesitli tel ${fx(d,2)} mm`,spec:s+', ışığı hücreye yönlendirir',mat:'Cu (OFC)',ys:110,set:{wt:'tri',dw:d},price:14}]);
add('wire','seg26',{l:'Segment tel Ø0,26 mm (aralıkta yassılaştırılmış)',spec:'paving / sıfır aralık dizilim',mat:'Cu (OFC)',ys:100,set:{wt:'round',dw:0.26},price:13.5});
mk('wire',[[0.6,0.20,'12BB yassı','mid'],[0.7,0.20,'MBB yassı','mid'],[0.8,0.20,'6BB','old'],[0.8,0.25,'6BB','old'],[0.9,0.20,'5BB / MBB','mid'],[0.9,0.23,'5BB','old'],[1.0,0.20,'4–5BB','old'],[1.0,0.25,'4BB','old'],[1.2,0.20,'4BB','old'],[1.2,0.25,'4–5BB','old'],[1.5,0.15,'3BB','old'],[1.5,0.20,'3BB','old'],[1.6,0.20,'3BB','old'],[2.0,0.15,'2BB','old'],[2.0,0.18,'2BB','old'],[2.0,0.20,'2BB','old']],
  ([w,t,s,era])=>[`f${n10(w)}x${n100(t)}`,{l:`Yassı ribbon ${fx(w,1)}×${fx(t,2)} mm`,spec:s,era,mat:'Cu (ETP / OFC)',ys:80,set:{wt:'flat',dw:w,tr:t},price:10.5}]);
mk('wire',[[1.2,0.20],[1.5,0.20]],([w,t])=>[`s${n10(w)}x${n100(t)}`,{l:`Yapılı (LHS) ribbon ${fx(w,1)}×${fx(t,2)} mm`,spec:'desenli yüzey ışığı geri yansıtır',era:'old',mat:'Cu',ys:80,set:{wt:'struct',dw:w,tr:t},price:12}]);

/* ---- Kaplama, bağlantı, bus, yalıtım, flux ---- */
for(const [id,l,kc,ad,mp,cth,era,spec] of [
  ['snpb','Sn60Pb40 kaplama',1.05,0,183,20,'now','standart IR lehim'],
  ['snpbag','Sn62Pb36Ag2 kaplama',1.05,0.8,179,20,'now','gümüş katkılı'],
  ['snbi','Sn42Bi58 düşük sıcaklık',1.07,1.5,138,15,'now','HJT'],
  ['snbiag','SnBiAg düşük sıcaklık',1.07,2.0,140,15,'now','HJT, yorulma dayanımı yüksek'],
  ['pbfree','Kurşunsuz SnAgCu / SnCu',1.04,1.2,217,20,'now','RoHS uyumlu'],
  ['bare','Çıplak Cu / Ag kaplı Cu',1.00,-0.5,0,1,'now','ECA veya 0BB film ile']])
  add('coat',id,{l,spec,era,add:ad,mp,cth,set:{kc}});
for(const [id,l,flux,cost,temp,era,spec] of [
  ['ir','Kızılötesi (IR) lehim',true,0,230,'now','stringer standart'],
  ['ind','İndüksiyon / sıcak hava lehim',true,0,250,'old',''],
  ['lt','Düşük sıcaklık lehim',true,0,170,'now','HJT'],
  ['film','0BB taşıyıcı film',false,0.35,150,'now','lehimsiz, laminasyonda bağlanır'],
  ['dot','0BB nokta yapıştırıcı (UV/ısıl kür)',false,0.25,150,'now','lehimsiz'],
  ['eca','İletken yapıştırıcı (ECA)',false,0.60,150,'mid','HJT / shingle / MWT']])
  add('join',id,{l,spec,era,flux,cost,temp});
mk('bus',[[3,0.30],[4,0.30],[4,0.40],[5,0.30],[5,0.35],[5,0.40],[6,0.30],[6,0.40],[6,0.50],[8,0.30],[8,0.40],[10,0.40],[10,0.50]],
  ([w,t])=>[`b${w}x${n100(t)}`,{l:`Bus ribbon ${w}×${fx(t,2)} mm`,spec:w>=8?'yüksek akım':w<=4?'dar kenar tasarımı':'',era:w>=6&&t>=0.4?'old':'now',set:{bw:w,bt:t},price:11}]);
add('bus','b5x35n',{l:'Bus ribbon 5×0,35 mm, çentikli',spec:'termal gerilme giderici',set:{bw:5,bt:0.35},price:12});
for(const [id,l,th,price,era] of [['epe','EPE köpük şerit',300,0.05,'now'],['pet','PET film şerit',100,0.04,'now'],['tpt','TPT şerit',300,0.08,'old'],['evapet','EVA + PET kompozit şerit',250,0.06,'now']])add('insul',id,{l,th,price,era});
add('flux','nc',{l:'No-clean, düşük katı oranlı',solid:2,price:8});
add('flux','rma',{l:'Alkol bazlı RMA',solid:5,price:7,era:'old'});

/* ---- Ön cam ---- */
for(const [t,base] of [[1.6,2.7],[2.0,3.0],[2.5,3.5],[2.8,3.8],[3.2,4.0],[4.0,5.0]]){
  const temper=t<=2.5?'yarı temperli (ısıl güçlendirilmiş)':'tam temperli',k=n10(t),dT=(t-2)*0.4,era=t>=3.2?'mid':'now';
  add('glassF','g'+k+'ar',{l:`${fx(t,1)} mm, AR kaplı`,spec:'düşük demirli, desenli',era,temper,Tsol:+(94.0-dT).toFixed(1),set:{tgf:t,ar:true,Rf:1.5},price:+(base+0.3).toFixed(2)});
  if(t===2.0||t===3.2)add('glassF','g'+k+'ar2',{l:`${fx(t,1)} mm, çift katman AR`,spec:'daha düşük yansıma',era:'now',temper,Tsol:+(94.6-dT).toFixed(1),set:{tgf:t,ar:true,Rf:1.2},price:+(base+0.5).toFixed(2)});
  add('glassF','g'+k+'no',{l:`${fx(t,1)} mm, AR kaplamasız`,spec:'desenli (prizmatik)',era:'old',temper,Tsol:+(91.6-dT).toFixed(1),set:{tgf:t,ar:false},price:base});
}

/* ---- Arka katman ---- */
for(const [t,base] of [[1.6,2.7],[2.0,3.0],[2.5,3.5],[3.2,4.0]]){const k=n10(t);
  add('rear','gc'+k,{l:`${fx(t,1)} mm arka cam, şeffaf`,spec:'en yüksek bifasiyallik, J-box delikli',kind:'glass',Rb:0.08,tau:0.91,layers:'cam',wvtr:0,set:{tgr:t},price:base});
  add('rear','gr'+k,{l:`${fx(t,1)} mm arka cam, beyaz sırlı grid`,spec:'gap bölgesi beyaz baskı',kind:'glass',Rb:0.75,tau:0.90,layers:'cam + seramik baskı',wvtr:0,set:{tgr:t},price:+(base+0.4).toFixed(2)});
  add('rear','gb'+k,{l:`${fx(t,1)} mm arka cam, siyah sırlı grid`,spec:'all-black görünüm',kind:'glass',Rb:0.05,tau:0.90,layers:'cam + seramik baskı',wvtr:0,set:{tgr:t},price:+(base+0.5).toFixed(2)});}
for(const [id,l,Rb,tau,bsg,layers,wvtr,price,era,spec] of [
  ['bsKPK','Backsheet KPK',0.80,0,480,'PVDF / PET / PVDF',1.5,2.6,'mid','beyaz, iki yüz florlu'],
  ['bsKPf','Backsheet KPf',0.80,0,450,'PVDF / PET / F-kaplama',1.6,2.0,'mid','beyaz'],
  ['bsKPC','Backsheet KPC',0.80,0,440,'PVDF / PET / kaplama',1.7,1.9,'mid','beyaz'],
  ['bsKPE','Backsheet KPE',0.80,0,430,'PVDF / PET / PE',1.8,2.0,'old','iç katman PE'],
  ['bsTPT','Backsheet TPT',0.80,0,470,'PVF / PET / PVF',1.4,3.0,'old','Tedlar, klasik'],
  ['bsTPE','Backsheet TPE',0.80,0,430,'PVF / PET / EVA-PE',1.8,2.2,'old','iç katman PE'],
  ['bsCPC','Backsheet CPC',0.78,0,420,'kaplama / PET / kaplama',2.0,1.6,'now','ince florlu kaplama'],
  ['bsPPE','Backsheet PPE / florsuz PET',0.78,0,400,'PET / PET / PE',2.2,1.3,'now','düşük maliyet'],
  ['bsPO','Backsheet tam poliolefin',0.78,0,420,'PO / PP çok katman',1.0,1.8,'now','florsuz, PET’siz'],
  ['bsPA','Backsheet poliamid (AAA)',0.80,0,420,'PA / PA / PA',3.0,1.7,'old','tarihi; sahada çatlama sorunu bilinir'],
  ['bsBLK','Siyah backsheet',0.05,0,460,'PVDF / PET / siyah kaplama',1.6,2.4,'now','all-black estetik'],
  ['bsTR','Şeffaf backsheet',0.12,0.85,430,'şeffaf florlu / PET / kaplama',1.5,2.8,'now','bifasiyal'],
  ['bsTRG','Şeffaf grid backsheet',0.55,0.83,440,'şeffaf + beyaz grid baskı',1.5,3.0,'now','bifasiyal, gap yansıtıcı'],
  ['bsMWT','İletken backsheet (MWT)',0.80,0,600,'Cu devre / PET / PVDF',1.5,6.0,'mid','devre baskılı']])
  add('rear',id,{l,spec,era,kind:'bs',Rb,tau,layers,wvtr,set:{bsg},price});

/* ---- Enkapsülan ---- */
for(const [id,l,rho,T,rb,vr,uv,lam,price,era,spec] of [
  ['EVA','EVA hızlı kür (UV-cut)',0.95,99.0,undefined,'1e14','360','145 / 10','1.9','now','standart, %28–33 VA'],
  ['EVAold','EVA yavaş kür',0.95,98.6,undefined,'1e14','360','150 / 18','1.8','old','UV emici'],
  ['EVAUVT','EVA UV-geçirgen (UVT)',0.95,99.5,undefined,'1e14','290','145 / 10','2.0','now','ön yüz, kısa dalga kazancı'],
  ['EVAHT','EVA yüksek geçirgenlik',0.95,99.3,undefined,'1e14','330','145 / 10','2.0','now','ön yüz'],
  ['EVAPID','Anti-PID EVA',0.95,99.0,undefined,'1e15','360','145 / 10','2.1','mid','yüksek hacim direnci'],
  ['POE','POE',0.88,99.3,undefined,'1e16','360','150 / 14','3.0','now','PID direnci yüksek, düşük WVTR'],
  ['EPE','EPE (EVA / POE / EVA)',0.92,99.2,undefined,'1e15','360','148 / 12','2.5','now','ko-ekstrüzyon'],
  ['UVDC','UV dönüşüm (down-conversion) POE',0.89,100.3,undefined,'1e16','—','150 / 14','3.4','now','UV→görünür, TOPCon UV kararlılığı'],
  ['UVDCE','UV dönüşüm EPE',0.92,100.2,undefined,'1e15','—','148 / 12','2.9','now','UV→görünür'],
  ['TPO','TPO (termoplastik poliolefin)',0.89,99.3,undefined,'1e16','360','160 / 8','3.2','now','kürsüz, geri dönüştürülebilir'],
  ['ION','İyonomer',0.95,99.4,undefined,'1e16','360','150 / 12','6.0','now','nem bariyeri yüksek'],
  ['PVB','PVB',1.07,98.8,undefined,'1e12','380','140 / otoklav','4.0','mid','BIPV, emniyet camı'],
  ['SIL','Silikon enkapsülan',1.00,99.6,undefined,'1e15','—','oda / 30','15','rd','yüksek UV dayanımı'],
  ['EVAW','Beyaz EVA (yalnız arka)',0.98,0,0.85,'1e14','—','145 / 10','2.2','mid','yansıtıcı arka katman'],
  ['EPEW','Beyaz EPE (yalnız arka)',0.95,0,0.85,'1e15','—','148 / 12','2.7','now','yansıtıcı, PID dirençli'],
  ['POEW','Beyaz POE (yalnız arka)',0.92,0,0.85,'1e16','—','150 / 14','3.2','now','yansıtıcı'],
  ['EVAB','Siyah EVA (yalnız arka)',0.98,0,0.05,'1e14','—','145 / 10','2.4','now','all-black estetik']]){
  const o={l,spec,era,rho,T,vr,uv:uv==='—'?undefined:+uv,lam,price:+price};if(rb!==undefined)o.rb=rb;add('enc',id,o);}

/* ---- Elektrik ---- */
for(const [id,l,nJB,Irat,diode,Vmax,price,era,spec] of [
  ['split25','3 parçalı split, 25 A',3,25,'Schottky, 3 adet',1500,1.4,'mid','M6 / M10'],
  ['split30','3 parçalı split, 30 A',3,30,'Schottky, 3 adet',1500,1.5,'now','M10 / G12R'],
  ['split35','3 parçalı split, 35 A',3,35,'Schottky, 3 adet',1500,1.7,'now','G12'],
  ['split40','3 parçalı split, 40 A',3,40,'Schottky, 3 adet',1500,1.9,'now','yüksek akım G12'],
  ['edge','Kenar tipi split (cam-cam)',3,30,'Schottky, 3 adet',1500,2.0,'now','kenara monte'],
  ['one3','Tek parça, 3 diyot',1,15,'Schottky, 3 adet',1000,1.4,'old','klasik 60/72 hücre'],
  ['one2','Tek parça, 2 diyot',1,12,'Schottky, 2 adet',1000,1.1,'old','36 hücre (12 V)'],
  ['one4','Tek parça, 4 diyot / 6 giriş',1,12,'Schottky, 4 adet',1000,1.7,'old','96 hücre'],
  ['rsd','Hızlı kapatma (rapid shutdown) entegre',1,20,'Schottky + MOSFET',1500,9.0,'now','NEC 690.12'],
  ['smart','Akıllı J-box (optimizer entegre)',1,15,'MLPE',1000,18.0,'now','izleme, MPPT']])
  add('jbox',id,{l,spec,era,Irat,diode,ip:'IP68',Vmax,set:{nJB},price});
for(const [A,pm,Rkm,od] of [[2.5,0.45,8.21,5.4],[4,0.60,5.09,6.0],[6,0.85,3.39,6.7]])for(const L of [300,350,400,900,1000,1200,1400])
  add('cable',`c${n10(A)}_${L}`,{l:`${fx(A,1)} mm² × ${L} mm`,spec:L>=900?'dikey montaj / eski tip':'yatay montaj',era:L>=900?'old':'now',Rkm,od,set:{cabA:A,cabL:L},price:pm});
for(const [id,l,conR,Irat,price,spec] of [['mc4c','MC4 uyumlu (genel)',0.5,30,0.25,''],['stb','Stäubli MC4',0.3,30,1.0,'orijinal'],['evo2','Stäubli MC4-EVO2',0.3,45,1.2,'orijinal'],['h4','Amphenol H4',0.35,40,0.9,''],['te','TE Connectivity SOLARLOK',0.4,30,0.8,'']])
  add('conn',id,{l,spec,Irat,Vmax:1500,ip:'IP68',set:{conR},price});
for(const [id,l,cure,price,era] of [['si2k','2K silikon','oda sıc., 2–4 saat',6.0,'now'],['si1k','1K silikon','nem, 24 saat',4.5,'mid'],['pu','Poliüretan','oda sıc.',5.0,'mid'],['none','Yok (contalı kutu)','—',0,'old']])
  add('pot',id,{l,cure,price,era});

/* ---- Çerçeve ve montaj ---- */
add('frame','none',{l:'Çerçevesiz (cam-cam)',spec:'kenar koruma ile',h:0,alloy:'—',finish:'—',set:{fc:0,fkg:0},price:0});
for(const [h,kg,fc] of [[25,0.36,3],[30,0.42,3],[33,0.46,3],[35,0.50,3],[40,0.60,3],[45,0.68,3],[50,0.80,3.5]]){
  const era=h>=40?'old':h>=35?'mid':'now';
  add('frame','al'+h,{l:`Al 6063-T5, ${h} mm, gümüş eloksal`,spec:h>=40?'yüksek yük':'',era,h,alloy:'Al 6063-T5',finish:'eloksal 15 µm',set:{fc,fkg:kg},price:4.6});
  add('frame','al'+h+'b',{l:`Al 6063-T5, ${h} mm, siyah eloksal`,spec:'all-black',era,h,alloy:'Al 6063-T5',finish:'siyah eloksal',set:{fc,fkg:kg},price:5.0});}
add('frame','al35t6',{l:'Al 6005-T6, 35 mm',spec:'yüksek dayanım',h:35,alloy:'Al 6005-T6',finish:'eloksal',set:{fc:3,fkg:0.50},price:4.9});
add('frame','st30',{l:'Çelik Zn-Al-Mg kaplı, 30 mm',spec:'düşük karbon / maliyet',h:30,alloy:'çelik S350GD',finish:'ZM310',set:{fc:3,fkg:0.62},price:1.6});
add('frame','st35',{l:'Çelik Zn-Al-Mg kaplı, 35 mm',spec:'',h:35,alloy:'çelik S350GD',finish:'ZM310',set:{fc:3,fkg:0.70},price:1.6});
add('frame','cmp35',{l:'Kompozit (PU / cam elyafı), 35 mm',spec:'metalsiz, topraklama gerekmez',era:'rd',h:35,alloy:'PU + cam elyafı',finish:'—',set:{fc:3,fkg:0.35},price:3.8});
for(const [id,l,unit,price,spec] of [['sil','1K silikon (çerçeve oluğu)','kg',4.0,'nem kürlenen'],['ms','MS polimer hibrit yapıştırıcı','kg',5.0,''],['tape','Çift taraflı köpük bant','m',0.12,'hızlı montaj']])add('fseal',id,{l,unit,price,spec});
for(const [id,l,unit,price,spec] of [['none','Yok','adet',0,''],['tape','Kenar koruma bandı','m',0.10,'cam kenarı boyunca'],['butyl','Butil kenar sızdırmazlığı','m',0.25,'cam-cam nem bariyeri'],['corner','Plastik köşe koruyucu ×4','adet',0.05,'']])add('edge',id,{l,unit,price,spec});
for(const [id,l,n,pal,car,str,era] of [['vert','Dikey: karton + ahşap palet',36,14,9,2.5,'now'],['horiz','Yatay: karton + ahşap palet',30,12,10,2.5,'old'],['crate','Ahşap kasa (ihracat)',30,35,2,2,'now'],['rack','Geri dönüşlü çelik raf (iç pazar)',40,4,1,0.5,'now']])
  add('pack',id,{l,era,pal,car,str,set:{nPal:n}});

const TECHS=['Al-BSF','PERC','PERT','MWT','TOPCon','HJT','BC','Tandem'];

/* ---- Format × teknoloji → hücre parametreleri ---- */
function cellAreaCm2(p){return (p.a*p.b-4*(p.ch>0?p.ch*p.ch/2:0))/100;}
function cellFrom(p,etaOv){
  const F=LIB.fmt.items[p.fmtV],T=LIB.tech.items[p.techV];if(!F||!T)return;
  p.a=F.a;p.b=F.b;p.ch=F.ch;p.tech=T.cat;
  const A=cellAreaCm2(p),eta=etaOv||T.eta,k=eta/T.eta;
  p.eta=+eta.toFixed(3);p.P=+(eta/100*A*0.1).toFixed(3);
  p.Voc=+(T.Voc*Math.pow(k,0.4)).toFixed(4);
  p.Isc=+(T.Jsc*A/1000*Math.pow(k,0.6)).toFixed(3);
  p.Imp=+(T.Jsc*A/1000*T.jmp*Math.pow(k,0.6)).toFixed(3);
  p.mc=+(A*T.th*1e-4*2.33+0.3).toFixed(2);
  for(const k2 of ['tc','bVoc','aIsc','bif','ag','lid','ann'])p[k2]=T[k2];
}

/* ---- Kullanıcı kütüphanesi: özel malzemeler ve fiyat listesi ---- */
const BUILTIN_PRICE={};
for(const [c,cat] of Object.entries(LIB))for(const [id,it] of Object.entries(cat.items))BUILTIN_PRICE[c+'/'+id]=priceOf(c,it);
function priceOf(c,it){return c==='coat'?it.add:c==='join'?it.cost:c==='pack'?undefined:it.price;}
function setPriceOf(c,it,v){if(c==='coat')it.add=v;else if(c==='join')it.cost=v;else it.price=v;}
function libApplyUser(U){
  if(!U)return;
  for(const x of U.items||[]){if(!LIB[x.cat])continue;const it=JSON.parse(JSON.stringify(x.it));it.user=true;LIB[x.cat].items[x.id]=it;}
  for(const [key,v] of Object.entries(U.prices||{})){const [c,id]=key.split('/');const it=LIB[c]&&LIB[c].items[id];if(it&&Number.isFinite(v))setPriceOf(c,it,v);}
}
