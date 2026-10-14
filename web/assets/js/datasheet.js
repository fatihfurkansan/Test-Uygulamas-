"use strict";
/* Datasheet (Ö9): A4 dikey iki sayfa (210 × 297 mm), teknik resim paftalarıyla aynı görüntüleyicide (pafta 3 ve 4).
   Güç sınıfları tek diyot modeliyle ölçeklenir: her sınıf için ışık akımı çarpanı, Pmax hedefini verecek şekilde çözülür. */
const DS_C=['#1b5fc0','#0f8a7e','#b07a12','#c1121f','#7c5cc4'];
const DS_CSS=`.dsh{fill:#16263a}.dsw{fill:#fff}.dsa{fill:#2f7dd1}.dsm{fill:#5b6270}.dsk{fill:#141414}
.dsbox{fill:#f2f5f9;stroke:none}.dsth{fill:#e6ecf4}.dsrl{stroke:#c9d1dc;stroke-width:.2}.dsal{stroke:#2f7dd1;stroke-width:.6}
.dsg{stroke:#dde3ea;stroke-width:.15}.dsax{stroke:#5b6270;stroke-width:.25;fill:none}.dsln{fill:none;stroke-width:.5}`;

/* Sınıf gücüne göre IV: kIL çarpanını sekant yöntemiyle bulur */
function dsClassSpec(Pt){
  if(!R.ivSpec)return null;
  const P=k=>moduleIV(Object.assign({},R.ivSpec,{kIL:k})).Pmp;
  let k0=R.ivSpec.kIL,p0=R.iv.Pmp,k1=k0*Pt/p0,p1=P(k1);
  for(let i=0;i<4&&Math.abs(p1-Pt)>0.01;i++){const k2=k1+(Pt-p1)*(k1-k0)/(p1-p0||1e-9);k0=k1;p0=p1;k1=k2;p1=P(k1);}
  return Object.assign({},R.ivSpec,{kIL:k1});
}
function dsClasses(){
  const p=S.p,bin=p.bin>0?p.bin:5,out=[];
  for(let i=0;i<5;i++){const Pt=p.Pplate+i*bin;const sp=dsClassSpec(Pt);
    const stc=sp?moduleIV(sp):null,nm=sp?moduleIV(Object.assign({},sp,{G:800,Tc:p.NMOT})):null,r=Pt/R.P;
    out.push({P:Pt,sp,
      stc:stc?{P:stc.Pmp,Vmp:stc.Vmp,Imp:stc.Imp,Voc:stc.Voc,Isc:stc.Isc}:{P:Pt,Vmp:R.Vmp,Imp:R.Imp*r,Voc:R.Voc,Isc:R.Isc*r},
      nm:nm?{P:nm.Pmp,Vmp:nm.Vmp,Imp:nm.Imp,Voc:nm.Voc,Isc:nm.Isc}:{P:R.ds.P_NMOT*r,Vmp:R.Vmp*0.95,Imp:R.Imp*r*0.8,Voc:R.Voc*0.95,Isc:R.Isc*r*0.8},
      eta:Pt/(R.Amod/1e6*10)});}
  return out;
}
/* mm ölçekli tablo: başlık satırı + satırlar; cols = sütun genişlikleri */
function dsTable(x,y,cols,head,rows,o={}){
  const rh=o.rh||5.2,hh=o.hh||6,W=cols.reduce((s,c)=>s+c,0);let s=`<rect class="dsth" x="${x}" y="${y}" width="${W}" height="${hh}"/>`;
  let cx=x;head.forEach((h,i)=>{s+=t(i?cx+cols[i]-1.5:cx+1.5,y+hh-1.9,2.3,h,{a:i?'end':'start',w:700,c:'dsk'});cx+=cols[i];});
  rows.forEach((r,j)=>{const yy=y+hh+j*rh;if(j%2)s+=`<rect class="dsbox" x="${x}" y="${yy}" width="${W}" height="${rh}"/>`;
    let cx2=x;r.forEach((v,i)=>{s+=t(i?cx2+cols[i]-1.5:cx2+1.5,yy+rh-1.6,i?2.4:2.3,String(v),{a:i?'end':'start',c:i?'dsk':'dsm',w:i&&o.bold===i?700:undefined});cx2+=cols[i];});
    s+=`<line class="dsrl" x1="${x}" y1="${yy+rh}" x2="${x+W}" y2="${yy+rh}"/>`;});
  return {s,h:hh+rows.length*rh};
}
const dsSec=(x,y,w,txt)=>t(x,y,3.2,txt,{w:700,c:'dsk'})+`<line class="dsal" x1="${x}" y1="${y+1.6}" x2="${x+w}" y2="${y+1.6}"/>`;
/* mm ölçekli çizgi grafik */
function dsChart(x,y,w,h,series,o){
  const ml=9,mb=8,mt=2,mr=2,X0=x+ml,Y0=y+h-mb,W=w-ml-mr,H=h-mb-mt;
  const nice=v=>{const e=Math.pow(10,Math.floor(Math.log10(v||1))),m=v/e;return (m<=1?1:m<=2?2:m<=5?5:10)*e;};
  let xmax=0,ymax=0;for(const s of series){for(const v of s.x)xmax=Math.max(xmax,v);for(const v of s.y)ymax=Math.max(ymax,v);}
  const xs=nice(xmax/5),ys=nice(ymax/5);xmax=Math.ceil(xmax/xs)*xs;ymax=Math.ceil(ymax/ys)*ys;
  const X=v=>X0+v/xmax*W,Y=v=>Y0-v/ymax*H;let s='';
  for(let v=0;v<=xmax+1e-9;v+=xs)s+=`<line class="dsg" x1="${X(v)}" y1="${Y0}" x2="${X(v)}" y2="${Y0-H}"/>`+t(X(v),Y0+3,1.9,f(v,xs<1?1:0),{a:'middle',c:'dsm'});
  for(let v=0;v<=ymax+1e-9;v+=ys)s+=`<line class="dsg" x1="${X0}" y1="${Y(v)}" x2="${X0+W}" y2="${Y(v)}"/>`+t(X0-1,Y(v)+0.7,1.9,f(v,ys<1?1:0),{a:'end',c:'dsm'});
  s+=`<path class="dsax" d="M${X0} ${Y0-H}V${Y0}H${X0+W}"/>`+t(X0+W/2,y+h-0.8,2.1,o.xl,{a:'middle',c:'dsm'})+t(x+1.5,y+h/2,2.1,o.yl,{a:'middle',c:'dsm',r:-90});
  series.forEach((sr,i)=>{let d='';for(let k=0;k<sr.x.length;k++){if(sr.y[k]<0||sr.x[k]<0)continue;d+=(d?'L':'M')+X(sr.x[k]).toFixed(2)+' '+Y(sr.y[k]).toFixed(2);}
    s+=`<path class="dsln" style="stroke:${DS_C[i%5]}" d="${d}"/>`;
    if(sr.mark)s+=`<circle cx="${X(sr.mark[0])}" cy="${Y(sr.mark[1])}" r="0.6" style="fill:${DS_C[i%5]}"/>`;
    if(sr.label){const [lx,ly,an]=sr.mark?[X(sr.mark[0])-1.5,Y(sr.mark[1])-1.2,'end']:(k=>[X(sr.x[k])+0.8,Y(sr.y[k])-0.9,'start'])(Math.min(sr.x.length-1,Math.floor(sr.x.length*(sr.lp||0.12))));
      s+=`<text x="${lx}" y="${ly}" font-size="1.9" text-anchor="${an}" style="fill:${DS_C[i%5]}">${esc(sr.label)}</text>`;}});
  return s;
}
function dsHeader(sub,big){
  const p=S.p;let s=`<rect class="dsh" x="0" y="0" width="210" height="${big?36:22}"/>`;
  // başlık genişliği: büyük başlıkta sağdaki güç aralığına, küçükte alt başlığa yer bırakılır
  const fit=(txt,maxW,fs0,fsMin)=>{const k=0.56,fs1=Math.max(fsMin,Math.min(fs0,maxW/(String(txt).length*k)));const n=Math.floor(maxW/(fs1*k));return {fs:fs1,txt:String(txt).length>n?String(txt).slice(0,n-1)+'…':String(txt)};};
  s+=t(10,big?10:8,2.4,(p.company||'PV MODÜL').toLocaleUpperCase('tr-TR'),{w:600,c:'dsw'});
  const T=fit(S.name,big?122:118,big?6.6:4.6,big?3.8:3);s+=t(10,big?21:16,T.fs,T.txt,{w:700,c:'dsw'});
  if(big){const U=fit(sub,128,2.8,2.2);s+=t(10,29,U.fs,U.txt,{c:'dsw'});}else s+=t(200,16,2.6,sub,{a:'end',c:'dsw'});
  return s;
}
function dsFooter(n){const p=S.p;return `<line class="dsrl" x1="10" y1="283" x2="200" y2="283"/>`+t(10,287.5,1.9,`Tasarım aşaması tahmini · PV Modül Tasarım · ${new Date().toLocaleDateString('tr-TR')} · ${p.dwgNo||''} rev. ${p.rev||''}`,{c:'dsm'})+
  t(200,287.5,1.9,`Sayfa ${n} / 2`,{a:'end',c:'dsm'})+t(10,291.5,1.8,'Değerler modelden hesaplanmıştır; seri üretim öncesi flasher ölçümü ve IEC 61215 / 61730 sertifikasyonuyla doğrulanmalıdır. Teknik değişiklik hakkı saklıdır.',{c:'dsm'});}

function dsPage1(){
  const p=S.p,C=dsClasses(),cls=C.map(c=>c.P),d=R.ds,tech=(LIB.tech.items[p.techV]||{}).l||p.tech,bif=d.phi>0.05;
  const sub=`${R.N} ${R.half?'yarım hücre':'hücre'} · ${tech} · ${(LIB.fmt.items[p.fmtV]||{}).l||''}${bif?' · bifasiyal':''}${R.rearKind==='glass'?' · cam-cam':''}`;
  let s=dsHeader(sub,true);
  s+=t(200,21,8,`${f(cls[0],0)}–${f(cls[4],0)} W`,{a:'end',w:700,c:'dsw'})+t(200,29,2.8,`maks. modül verimi %${f(C[4].eta,2)}`,{a:'end',c:'dsw'});
  // KPI kutuları
  const kp=[['Maks. güç',f(cls[4],0)+' W'],['Modül verimi','%'+f(C[4].eta,1)],[bif?'Bifasiyallik':'Ağırlık',bif?'%'+f(d.phi*100,0)+' ± 5':f(R.mass.total,1)+' kg'],['Boyut',`${f(R.L,0)} × ${f(R.W,0)} mm`]];
  kp.forEach(([l,v],i)=>{const x=10+i*48.33,fz=Math.min(4.8,39/(v.length*0.55));s+=`<rect class="dsbox" x="${x}" y="42" width="45" height="18" rx="1"/>`+t(x+3,48,2.3,l,{c:'dsm'})+t(x+3,56,fz,v,{w:700,c:'dsk'});});
  let y=70;const cw=[50,28,28,28,28,28];
  s+=dsSec(10,y,190,'ELEKTRİKSEL ÖZELLİKLER · STC');y+=4;
  let T=dsTable(10,y,cw,['Güç sınıfı',...cls.map(v=>f(v,0)+' W')],[
    ['Maks. güç Pmax (W)',...C.map(c=>f(c.P,0))],['Güç toleransı (W)',...C.map(()=>`0 ~ +${f(p.bin,0)}`)],['MPP gerilimi Vmpp (V)',...C.map(c=>f(c.stc.Vmp,2))],['MPP akımı Impp (A)',...C.map(c=>f(c.stc.Imp,2))],
    ['Açık devre gerilimi Voc (V)',...C.map(c=>f(c.stc.Voc,2))],['Kısa devre akımı Isc (A)',...C.map(c=>f(c.stc.Isc,2))],['Modül verimi (%)',...C.map(c=>f(c.eta,2))]],{bold:5,rh:4.8});
  s+=T.s;y+=T.h+4;s+=t(10,y,1.9,`STC: 1000 W/m², hücre sıcaklığı 25 °C, AM1,5. Pmax ölçüm belirsizliği ±%${f(Math.max(2*p.sMeas,3),0)}. Sınıf değerleri tek diyot modeliyle hesaplanmıştır.`,{c:'dsm'});
  y+=8;s+=dsSec(10,y,190,'ELEKTRİKSEL ÖZELLİKLER · NMOT');y+=4;
  T=dsTable(10,y,cw,['Güç sınıfı (STC)',...cls.map(v=>f(v,0)+' W')],[
    ['Maks. güç Pmax (W)',...C.map(c=>f(c.nm.P,1))],['MPP gerilimi Vmpp (V)',...C.map(c=>f(c.nm.Vmp,2))],['MPP akımı Impp (A)',...C.map(c=>f(c.nm.Imp,2))],
    ['Açık devre gerilimi Voc (V)',...C.map(c=>f(c.nm.Voc,2))],['Kısa devre akımı Isc (A)',...C.map(c=>f(c.nm.Isc,2))]],{rh:4.8});
  s+=T.s;y+=T.h+4;s+=t(10,y,1.9,`NMOT: 800 W/m², ortam 20 °C, rüzgâr 1 m/s; hücre sıcaklığı ${f(p.NMOT,0)} °C (IEC 61215-2).`,{c:'dsm'});
  if(bif){y+=8;s+=dsSec(10,y,190,'BİFASİYAL KAZANÇ · '+f(cls[2],0)+' W sınıfı');y+=4;
    const P0=cls[2],rows=[[10,'Arka ışınım %10'],[20,'Arka ışınım %20'],[30,'Arka ışınım %30']].map(([r,l])=>{const Pb=P0*(1+d.phi*r/100);return [l,f(Pb,0),'+%'+f(d.phi*r,1),f(Pb/(R.Amod/1e6*10),2)];});
    rows.push([`BNPI (${f(p.Grear,0)} W/m² arka)`,f(P0*(1+d.phi*p.Grear/1000),0),'+%'+f(d.phi*p.Grear/10,1),f(P0*(1+d.phi*p.Grear/1000)/(R.Amod/1e6*10),2)]);
    T=dsTable(10,y,[70,40,40,40],['Arka yüz koşulu','Pmax (W)','Kazanç','Eşdeğer verim (%)'],rows,{rh:4.8});s+=T.s;y+=T.h+4;
    s+=t(10,y,1.9,`Bifasiyallik φ = %${f(d.phi*100,0)} ± 5 (Pmax). Kazanç arka/ön ışınım oranı × φ ile hesaplanır (IEC TS 60904-1-2).`,{c:'dsm'});}
  y+=8;const half=93;
  s+=dsSec(10,y,half,'SICAKLIK DEĞERLERİ')+dsSec(10+half+4,y,half,'ÇALIŞMA SINIRLARI');y+=4;
  const T1=dsTable(10,y,[63,30],['Özellik','Değer'],[['NMOT',f(p.NMOT,0)+' ± 2 °C'],['Pmax sıcaklık katsayısı γ',f(p.tc,2)+' %/°C'],['Voc sıcaklık katsayısı β',f(p.bVoc,2)+' %/°C'],['Isc sıcaklık katsayısı α',fs(p.aIsc,3)+' %/°C']],{rh:4.8});
  const T2=dsTable(10+half+4,y,[55,38],['Özellik','Değer'],[['Çalışma sıcaklığı','−40 … +85 °C'],['Maks. sistem gerilimi',f(p.Vsys,0)+' V DC'],['Maks. seri sigorta',R.cur?R.cur.fuse+' A':'–'],
    ['Mekanik yük ön / arka (test)',`${f(R.mech?R.mech.tp:0,0)} / ${f(R.mech?R.mech.tn:0,0)} Pa`],['Voc @ −10 °C',f(d.Voc_m10,1)+' V']],{rh:4.8});
  s+=T1.s+T2.s;y+=Math.max(T1.h,T2.h)+8;
  s+=dsSec(10,y,190,'GÜÇ GARANTİSİ');y+=4;
  // garanti eğrisi (çubuk)
  y+=3;const gx=10,gw=190,gh=Math.max(10,277-y),yr=p.yrs,Y=v=>y+gh-(v-80)/20*gh;
  s+=`<path class="dsax" d="M${gx+12} ${y}V${y+gh}H${gx+gw}"/>`;
  for(const v of [80,85,90,95,100])s+=`<line class="dsg" x1="${gx+12}" y1="${Y(v)}" x2="${gx+gw}" y2="${Y(v)}"/>`+t(gx+11,Y(v)+0.7,1.8,'%'+v,{a:'end',c:'dsm'});
  const X=v=>gx+12+(v/yr)*(gw-14);
  s+=`<path class="dsln" style="stroke:${DS_C[0]}" d="M${X(0)} ${Y(100)}L${X(1)} ${Y(d.y1)}L${X(yr)} ${Y(d.yN)}"/>`;
  s+=t(X(1)+1,Y(d.y1)-1.2,2,`1. yıl ≥ %${f(d.y1,1)}`,{c:'dsk'})+t(X(yr)-1,Y(d.yN)-1.5,2,`${yr}. yıl ≥ %${f(d.yN,1)}`,{a:'end',c:'dsk'})+t(X(yr/2),Y(d.y1-(yr/2-1)*p.ann)-2,1.9,`yıllık ≤ %${f(p.ann,2)}`,{a:'middle',c:'dsm'});
  return s+dsFooter(1);
}
function dsPage2(){
  const p=S.p,g=G();let s=dsHeader('Mekanik çizim, malzeme ve eğriler',false);
  // görünüşler: dikey yerleşim (modül boyu düşey); ön, arka ve temsili kesit yan yana
  const k=[5,10,15,20,25,30,40,50].find(v=>g.L/v<=100&&g.W/v<=50)||50,X1=24,Y1=36,w=g.W/k,h=g.L/k;
  s+=t(10,30,3.2,'MEKANİK ÇİZİM',{w:700,c:'dsk'})+t(200,30,2,`Ölçek 1:${k} · ölçüler mm`,{a:'end',c:'dsm'});
  s+=t(X1+w/2,Y1+h+8,2.2,'Ön görünüş',{a:'middle',c:'dsm'});
  s+=`<g transform="translate(${X1+w} ${Y1}) rotate(90) scale(${1/k})">${dwScene(k,{wires:false})}</g>`;
  s+=dV(Y1,Y1+h,X1,X1-6,f(g.L,0),{ts:2.2})+dH(X1,X1+w,Y1,Y1-3.5,f(g.W,0),{ts:2.2});
  // arka görünüş: arkadan bakış
  const X2=X1+w+28,Q=(u,v)=>[X2+v/k,Y1+u/k];
  s+=t(X2+w/2,Y1+h+8,2.2,'Arka görünüş',{a:'middle',c:'dsm'});
  if(g.fc>0){const fl=Math.max(p.fFl,g.fc)/k;s+=`<rect class="frm" x="${X2}" y="${Y1}" width="${w}" height="${h}" style="stroke-width:.25"/><rect class="gls" x="${X2+fl}" y="${Y1+fl}" width="${w-2*fl}" height="${h-2*fl}"/>`;}
  else s+=`<rect class="gls" x="${X2}" y="${Y1}" width="${w}" height="${h}"/>`;
  const holes=[];if(g.fc>0)for(const m of [p.mh1,p.mh2])if(m>0&&m<g.L)for(const sg of [-1,1])holes.push(g.L/2+sg*m/2);
  for(const u of holes)for(const v of [p.fFl/2,g.W-p.fFl/2]){const [hx,hy]=Q(u,v);s+=`<rect class="hole" x="${hx-p.mhW/2/k}" y="${hy-p.mhL/2/k}" width="${p.mhW/k}" height="${p.mhL/k}" rx="${p.mhW/2/k}"/>`;}
  if(holes.length){const hs=[...holes].sort((a,b)=>a-b),[,ya]=Q(hs[0],0),[,yb]=Q(hs[hs.length-1],0);s+=dV(ya,yb,X2+w,X2+w+5,f(Math.max(p.mh1,p.mh2),0),{ts:2});
    if(p.mh1>0&&p.mh2>0&&hs.length>=4){const [,yc]=Q(hs[1],0),[,yd]=Q(hs[2],0);s+=dV(yc,yd,X2+w,X2+w+10,f(Math.min(p.mh1,p.mh2),0),{ts:2});}}
  const jbs=jbPos();
  for(const b of jbs){const [jx,jy]=Q(b.u,g.W-b.v);s+=`<rect class="jb" x="${jx-p.jbW/2/k}" y="${jy-p.jbL/2/k}" width="${p.jbW/k}" height="${p.jbL/k}"/>`;}
  if(jbs.length){const [jx,jy]=Q(jbs[0].u,g.W-jbs[0].v),cl=Math.min(p.cabL/k,h*0.3);s+=`<path class="cab" d="M${jx} ${jy} c -2 ${-cl*0.4} -1 ${-cl*0.7} 0 ${-cl}"/><path class="cab" d="M${jx} ${jy} c 2 ${cl*0.4} 1 ${cl*0.7} 0 ${cl}"/>`;
    const [,j0]=Q(jbs[0].u,0);s+=dV(Y1,j0,X2,X2-5,f(jbs[0].u,0),{ts:2});}
  // kesit: çerçeve profili ve laminat (temsili, büyütülmüş)
  const sx=X2+w+30,fr=p.frameV!=='none'&&p.fH>0;
  if(fr){const reach=Math.max(p.fFl,R.fc+p.fOv),m=Math.min(2,(198-sx)/reach,Math.max(0.6,h*0.55/p.fH)),H=p.fH*m,Wf=p.fFl*m,et=Math.max(p.fWt*m,0.6),lip=(R.fc+p.fOv)*m,sy=Y1+6;
    const lam=(p.tgf+p.tef+p.ter+(R.rearKind==='glass'?p.tgr:0.4)+0.2)*m;
    s+=t(sx,Y1,2.2,`Kesit · ${f(m,1)}:1 (temsili)`,{c:'dsm'});
    s+=`<rect class="gls2" x="${sx+R.fc*m}" y="${sy+et}" width="${198-sx-R.fc*m}" height="${lam}"/>`;
    s+=`<path class="sec" style="fill:#c9cdd3" d="M${sx} ${sy}H${sx+lip}V${sy+et}H${sx+et}V${sy+et+lam}H${sx+lip}V${sy+2*et+lam}H${sx+et}V${sy+H-et}H${sx+Wf}V${sy+H}H${sx}Z"/>`;
    s+=dV(sy,sy+H,sx,sx-4,f(p.fH,0),{ts:2})+dH(sx,sx+Wf,sy+H,sy+H+4,f(p.fFl,0),{ts:2});}
  else s+=t(sx,Y1,2.2,'Çerçevesiz modül',{c:'dsm'});
  // malzeme ve mekanik: iki sütunlu liste
  const it=(lib,id)=>(LIB[lib].items[id]||{l:'–'}).l,jb=LIB.jbox.items[p.jboxV]||{};
  const mech=[['Hücre',`${(LIB.tech.items[p.techV]||{}).l||p.tech} · ${it('fmt',p.fmtV)}`],['Hücre sayısı',`${R.N} (${R.nc} × ${R.nr})${R.half?' yarım hücre':''}`],
    ['Boyut',`${f(R.L,0)} × ${f(R.W,0)} × ${f(p.frameV==='none'?0:p.fH,0)} mm`],['Ağırlık',f(R.mass.total,1)+' kg'],
    ['Ön cam',it('glassF',p.glassFV)],['Arka katman',it('rear',p.rearV)],
    ['Enkapsülan',`${it('enc',p.encFV)} / ${it('enc',p.encRV)}`],['Çerçeve',it('frame',p.frameV)],
    ['J-box',`${it('jbox',p.jboxV)}${jb.ip?' · '+jb.ip:''}${/diyot/i.test(it('jbox',p.jboxV))?'':' · '+Math.max(1,Math.floor(R.nc/2))+' bypass diyot'}`],['Kablo',`${f(p.cabA,0)} mm² · ${f(p.cabL,0)} mm (her kutup)`],
    ['Konnektör',it('conn',p.connV)],['Hücre bağlantısı',`${p.nbb} tel · Ø${f(p.dw,2)} mm · ${it('join',p.joinV)}`]];
  let my=Y1+h+18;s+=dsSec(10,my,190,'MALZEME VE MEKANİK');my+=4;
  const rows=Math.ceil(mech.length/2),rh=5.2,cw=95;
  mech.forEach(([l,v],i)=>{const col=i<rows?0:1,r=i%rows,x=10+col*cw,y=my+r*rh;
    if(r%2===0)s+=`<rect class="dsbox" x="${x}" y="${y}" width="${cw-2}" height="${rh}"/>`;
    const n=Math.floor((cw-30)/(2.2*0.5));s+=t(x+1.5,y+rh-1.6,2.1,l,{c:'dsm'})+t(x+28,y+rh-1.6,2.2,v.length>n?v.slice(0,n-1)+'…':v,{c:'dsk'});});
  my+=rows*rh+9;
  // eğriler
  if(R.ivSpec){const C=dsClasses(),sp=C[2].sp||R.ivSpec;
    const down=m=>ivCurve(m,110);
    const sG=[1000,800,600,400,200].map(Gv=>{const d=down(moduleIV(Object.assign({},sp,{G:Gv})));return {x:d.x,y:d.y,label:Gv+' W/m²',lp:0.04};});
    const sT=[25,50,75].map(Tv=>{const m=moduleIV(Object.assign({},sp,{Tc:Tv})),d=down(m);return {x:d.x,y:d.P,label:Tv+' °C',mark:[m.Vmp,m.Pmp]};});
    const ch=Math.max(36,Math.min(62,270-my-14));
    s+=dsSec(10,my,92,`I-V EĞRİLERİ · ${f(C[2].P,0)} W · 25 °C`)+dsSec(108,my,92,'P-V EĞRİLERİ · 1000 W/m²');
    s+=dsChart(10,my+4,92,ch,sG,{xl:'Gerilim (V)',yl:'Akım (A)'})+dsChart(108,my+4,92,ch,sT,{xl:'Gerilim (V)',yl:'Güç (W)'});my+=ch+12;}
  // ambalaj
  if(my<276){const palKg=p.nPal*R.mass.total+25;
    s+=dsSec(10,my,190,'AMBALAJ')+t(10,my+6,2.3,`Palet başı ${p.nPal} modül · palet brüt ağırlığı ≈ ${f(palKg,0)} kg · ${(LIB.pack.items[p.packV]||{l:''}).l}`,{c:'dsk'});}
  return s+dsFooter(2);
}
function dsSheetSVG(n){
  const body=n===1?dsPage1():dsPage2();
  return `<svg class="sheet a4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" role="img" aria-label="Datasheet sayfa ${n}">
<style>${SHEET_CSS}${DS_CSS}</style><rect class="paper" x="0" y="0" width="210" height="297"/>${body}</svg>`;
}
window.dsSheetSVG=dsSheetSVG;
